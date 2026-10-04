import { BadRequestException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { DUMMY_HASH, generateOtp, hashOtp, newToken, sha256, verifyPassword } from './crypto';
import { evaluateOtp, OTP_MAX_PER_HOUR, OTP_TTL_MINUTES } from './otp';
import { OtpSender } from './otp-sender';

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const WEB_ROLES = ['HR', 'COMPANY_ADMIN', 'SUPER_ADMIN']; // may log in without a device

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private sender: OtpSender) {}

  async login(dto: { companyCode: string; email: string; password: string; deviceUid?: string }) {
    const now = new Date();
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.trim().toLowerCase(), company: { slug: dto.companyCode }, active: true },
      include: { devices: { where: { active: true } } } });
    if (user?.lockedUntil && user.lockedUntil > now) throw new HttpException({ code: 'ACCOUNT_LOCKED' }, 429);

    const ok = verifyPassword(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      if (user) {
        const f = user.failedLogins + 1;
        await this.prisma.user.update({ where: { id: user.id }, data: f >= MAX_FAILED
          ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) } : { failedLogins: f } });
      }
      throw new UnauthorizedException('INVALID_CREDENTIALS'); // same error either way
    }
    if (user.failedLogins || user.lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    if (!dto.deviceUid) {
      if (!WEB_ROLES.includes(user.role)) throw new BadRequestException('DEVICE_REQUIRED');
      return this.issueTokens(user, null);
    }
    const bound = user.devices[0];
    if (bound?.deviceUid === dto.deviceUid) return this.issueTokens(user, dto.deviceUid);
    return this.startOtp(user, dto.deviceUid, bound ? 'DEVICE_CHANGE' : 'FIRST_LOGIN');
  }

  private async startOtp(user: { id: string; email: string; phone: string | null }, deviceUid: string, purpose: string) {
    const recent = await this.prisma.otpChallenge.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600000) } } });
    if (recent >= OTP_MAX_PER_HOUR) throw new HttpException({ code: 'OTP_RATE_LIMIT' }, 429);
    const code = generateOtp();
    const ch = await this.prisma.otpChallenge.create({ data: {
      userId: user.id, deviceUid, purpose, codeHash: 'pending', expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60000) } });
    await this.prisma.otpChallenge.update({ where: { id: ch.id }, data: { codeHash: hashOtp(ch.id, code) } });
    await this.sender.send({ email: user.email, phone: user.phone, code, purpose });
    return { status: 'OTP_REQUIRED', challengeId: ch.id, purpose };
  }

  async verifyOtp(dto: { challengeId: string; code: string; deviceUid: string }) {
    const ch = await this.prisma.otpChallenge.findUnique({ where: { id: dto.challengeId }, include: { user: true } });
    if (!ch || ch.deviceUid !== dto.deviceUid || !ch.user.active) throw new UnauthorizedException('INVALID_CHALLENGE');
    const r = evaluateOtp(ch, dto.code, new Date());
    if (!r.ok) {
      if (r.countAttempt) await this.prisma.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException(r.reason);
    }
    await this.prisma.$transaction(async (tx: any) => {
      await tx.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
      const old = await tx.device.findMany({ where: { userId: ch.userId, active: true } });
      await tx.device.updateMany({ where: { userId: ch.userId, active: true }, data: { active: false } });
      await tx.device.upsert({ where: { userId_deviceUid: { userId: ch.userId, deviceUid: dto.deviceUid } },
        create: { userId: ch.userId, deviceUid: dto.deviceUid }, update: { active: true, boundAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: ch.userId, revokedAt: null }, data: { revokedAt: new Date() } }); // sign out the old device
      await tx.auditLog.create({ data: { companyId: ch.user.companyId, actorId: ch.userId, action: 'DEVICE_BOUND',
        entity: 'Device', entityId: dto.deviceUid, before: old.map((d: any) => d.deviceUid) as any, after: [dto.deviceUid] as any, reason: ch.purpose } });
    });
    return this.issueTokens(ch.user, dto.deviceUid);
  }

  async refresh(dto: { refreshToken: string; deviceUid?: string }) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(dto.refreshToken) }, include: { user: true } });
    if (!row) throw new UnauthorizedException('INVALID_REFRESH');
    if (row.revokedAt) { // reuse of a rotated token => assume theft, kill all sessions
      await this.prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('REFRESH_REUSE_DETECTED');
    }
    if (row.expiresAt <= new Date() || !row.user.active || (row.deviceUid ?? null) !== (dto.deviceUid ?? null)) throw new UnauthorizedException('INVALID_REFRESH');
    if (row.deviceUid) {
      const dev = await this.prisma.device.findFirst({ where: { userId: row.userId, deviceUid: row.deviceUid, active: true } });
      if (!dev) throw new UnauthorizedException('DEVICE_REVOKED');
    }
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } }); // rotate
    return this.issueTokens(row.user, row.deviceUid);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  private async issueTokens(user: { id: string; companyId: string; role: string; name: string }, deviceUid: string | null) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, cid: user.companyId, role: user.role });
    const refreshToken = newToken();
    await this.prisma.refreshToken.create({ data: { userId: user.id, tokenHash: sha256(refreshToken), deviceUid,
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86400000) } });
    return { status: 'OK', accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC, user: { id: user.id, name: user.name, role: user.role } };
  }
}
