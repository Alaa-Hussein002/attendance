import { BadRequestException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { DUMMY_HASH, generateOtp, hashOtp, hashPassword, newToken, sha256, verifyPassword } from './crypto';
import { evaluateOtp, OTP_MAX_PER_HOUR, OTP_TTL_MINUTES } from './otp';
import { OtpSender } from './otp-sender';
import { validateNewPassword } from './password';
import { Prisma } from '@prisma/client';

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const WEB_ROLES = ['HR', 'COMPANY_ADMIN', 'SUPER_ADMIN', 'TEAM_LEAD', 'BRANCH_MANAGER']; // may sign in without a bound phone
const pwdSecret = () => `${process.env.JWT_SECRET}:pwd`; // distinct key so a password-change token can never act as an access token

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private sender: OtpSender) {}

  /** Single-company installs need no company code. */
  private async companyId(code?: string) {
    if (code) return (await this.prisma.company.findUnique({ where: { slug: code } }))?.id ?? null;
    const all = await this.prisma.company.findMany({ select: { id: true }, take: 2 });
    if (all.length === 1) return all[0].id;
    throw new BadRequestException('COMPANY_CODE_REQUIRED');
  }

  async login(dto: { companyCode?: string; email: string; password: string; deviceUid?: string }) {
    const now = new Date();
    const cid = await this.companyId(dto.companyCode?.trim() || undefined);
    const user = cid ? await this.prisma.user.findFirst({
      where: { email: String(dto.email ?? '').trim().toLowerCase(), companyId: cid, active: true },
      include: { devices: { where: { active: true } } } }) : null;
    if (user?.lockedUntil && user.lockedUntil > now) throw new HttpException({ code: 'ACCOUNT_LOCKED' }, 429);

    const ok = verifyPassword(String(dto.password ?? ''), user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      if (user) {
        const f = user.failedLogins + 1;
        await this.prisma.user.update({ where: { id: user.id }, data: f >= MAX_FAILED
          ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) } : { failedLogins: f } });
      }
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
    if (user.failedLogins || user.lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    // First login with the shared default password: always confirm by email OTP, then force a new password.
    if (user.mustChangePassword) return this.startOtp(user, dto.deviceUid ?? 'web', 'FIRST_LOGIN');

    if (!dto.deviceUid) {
      if (!WEB_ROLES.includes(user.role)) throw new BadRequestException('DEVICE_REQUIRED');
      return this.issueTokens(user, null);
    }
    const bound = user.devices[0];
    if (bound?.deviceUid === dto.deviceUid) return this.issueTokens(user, dto.deviceUid);
    return this.startOtp(user, dto.deviceUid, bound ? 'DEVICE_CHANGE' : 'FIRST_LOGIN');
  }

  async startOtp(user: { id: string; email: string; phone: string | null; name: string }, deviceUid: string, purpose: string) {
    const recent = await this.prisma.otpChallenge.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600000) } } });
    if (recent >= OTP_MAX_PER_HOUR) throw new HttpException({ code: 'OTP_RATE_LIMIT' }, 429);
    const code = generateOtp();
    const ch = await this.prisma.otpChallenge.create({ data: {
      userId: user.id, deviceUid, purpose, codeHash: 'pending', expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60000) } });
    await this.prisma.otpChallenge.update({ where: { id: ch.id }, data: { codeHash: hashOtp(ch.id, code) } });
    await this.sender.send({ email: user.email, phone: user.phone, name: user.name, code, purpose });
    return { status: 'OTP_REQUIRED', challengeId: ch.id, purpose };
  }

  async verifyOtp(dto: { challengeId: string; code: string; deviceUid?: string }) {
    const deviceUid = dto.deviceUid || 'web';
    const ch = await this.prisma.otpChallenge.findUnique({ where: { id: String(dto.challengeId ?? '') }, include: { user: true } });
    if (!ch || ch.deviceUid !== deviceUid) throw new UnauthorizedException('INVALID_CHALLENGE');
    // a setup challenge belongs to a not-yet-active admin; every other purpose needs an active user
    if (!ch.user.active && ch.purpose !== 'SETUP') throw new UnauthorizedException('INVALID_CHALLENGE');
    const r = evaluateOtp(ch, String(dto.code ?? '').trim(), new Date());
    if (!r.ok) {
      if (r.countAttempt) await this.prisma.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException(r.reason);
    }
    const bindDevice = deviceUid !== 'web';
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
      await tx.user.update({ where: { id: ch.userId }, data: { emailVerifiedAt: new Date(), ...(ch.purpose === 'SETUP' ? { active: true } : {}) } });
      if (bindDevice) {
        const old = await tx.device.findMany({ where: { userId: ch.userId, active: true } });
        await tx.device.updateMany({ where: { userId: ch.userId, active: true }, data: { active: false } });
        await tx.device.upsert({ where: { userId_deviceUid: { userId: ch.userId, deviceUid } },
          create: { userId: ch.userId, deviceUid }, update: { active: true, boundAt: new Date() } });
        await tx.refreshToken.updateMany({ where: { userId: ch.userId, revokedAt: null }, data: { revokedAt: new Date() } }); // sign out the old device
        await tx.auditLog.create({ data: { companyId: ch.user.companyId, actorId: ch.userId, action: 'DEVICE_BOUND',
          entity: 'Device', entityId: deviceUid, before: old.map((d: { deviceUid: string }) => d.deviceUid) as any, after: [deviceUid] as any, reason: ch.purpose } });
      }
    });
    if (ch.user.mustChangePassword) {
      const changeToken = await this.jwt.signAsync({ sub: ch.userId, dev: bindDevice ? deviceUid : null }, { secret: pwdSecret(), expiresIn: '10m' });
      return { status: 'PASSWORD_CHANGE_REQUIRED', changeToken };
    }
    return this.issueTokens(ch.user, bindDevice ? deviceUid : null);
  }

  /** Step after the first OTP: the employee replaces the shared default password. */
  async setPassword(dto: { changeToken: string; newPassword: string }) {
    let payload: { sub: string; dev: string | null };
    try { payload = await this.jwt.verifyAsync(String(dto.changeToken ?? ''), { secret: pwdSecret() }); }
    catch { throw new UnauthorizedException('INVALID_CHANGE_TOKEN'); }
    const err = validateNewPassword(dto.newPassword);
    if (err) throw new BadRequestException(err);
    const user = await this.prisma.user.findFirst({ where: { id: payload.sub, active: true } });
    if (!user) throw new UnauthorizedException('INVALID_CHANGE_TOKEN');
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(dto.newPassword), mustChangePassword: false, failedLogins: 0, lockedUntil: null } });
    await this.prisma.auditLog.create({ data: { companyId: user.companyId, actorId: user.id, action: 'PASSWORD_CHANGED', entity: 'User', entityId: user.id } });
    return this.issueTokens(user, payload.dev);
  }

  async refresh(dto: { refreshToken: string; deviceUid?: string }) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(String(dto.refreshToken ?? '')) }, include: { user: true } });
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
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(String(refreshToken ?? '')), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async issueTokens(user: { id: string; companyId: string; role: string; name: string }, deviceUid: string | null) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, cid: user.companyId, role: user.role });
    const refreshToken = newToken();
    await this.prisma.refreshToken.create({ data: { userId: user.id, tokenHash: sha256(refreshToken), deviceUid,
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86400000) } });
    return { status: 'OK', accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC, user: { id: user.id, name: user.name, role: user.role } };
  }
}
