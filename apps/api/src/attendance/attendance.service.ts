import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AttendancePolicy, BranchConfig, decideCheckIn, hhmmToMinutes, localToUtc, toLocalParts } from '@attendance/shared';
import { AuthCtx } from '../common/auth-context';
import { check, DATE_RE } from '../common/http';
import { PrismaService } from '../common/prisma.service';

export interface CheckInDto { deviceUid: string; lat?: number; lng?: number; mockLocation?: boolean; clientTime?: string }

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  /** Resolution order: employee override > branch > company default. */
  private async resolvePolicy(companyId: string, user: { policyId: string | null; branch: { policyId: string | null } | null }) {
    const id = user.policyId ?? user.branch?.policyId;
    const row = id
      ? await this.prisma.attendancePolicy.findFirst({ where: { id, companyId } })
      : await this.prisma.attendancePolicy.findFirst({ where: { companyId, isDefault: true, active: true } });
    if (!row) throw new NotFoundException('POLICY_NOT_CONFIGURED');
    return row.config as unknown as AttendancePolicy;
  }

  async checkIn(companyId: string, userId: string, ip: string | undefined, dto: CheckInDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, active: true },
      include: { branch: true, devices: { where: { active: true } }, company: true } });
    if (!user || !user.branch) throw new ForbiddenException('NO_BRANCH');
    const b = user.branch;
    const branch: BranchConfig = {
      latitude: b.latitude ? Number(b.latitude) : undefined, longitude: b.longitude ? Number(b.longitude) : undefined,
      radiusMeters: b.radiusMeters ?? undefined, allowedIpRanges: b.allowedIpRanges, modes: b.verificationModes as any,
    };
    const policy = await this.resolvePolicy(companyId, user);
    const serverTime = new Date(); // authoritative
    const d = decideCheckIn(branch, policy, {
      serverTime, clientTime: dto.clientTime ? new Date(dto.clientTime) : undefined, ip,
      lat: dto.lat, lng: dto.lng, mockLocation: dto.mockLocation,
      deviceUid: dto.deviceUid, boundDeviceUid: user.devices[0]?.deviceUid ?? null,
    }, user.company.timezone);

    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_localDate: { userId, localDate: d.localDate } } });
    if (existing) throw new ConflictException({ code: 'ALREADY_CHECKED_IN', status: existing.status });
    if (!d.allowed) throw new UnprocessableEntityException({ code: d.code, status: d.status, flags: d.flags });

    return this.prisma.attendanceRecord.create({ data: {
      companyId, userId, localDate: d.localDate, checkInAt: serverTime,
      clientTime: dto.clientTime ? new Date(dto.clientTime) : null, source: d.source!, status: d.status!,
      ip, deviceUid: dto.deviceUid, latitude: dto.lat, longitude: dto.lng, flags: d.flags } });
  }

  private async target(a: AuthCtx, userId: string, date: string, reason: string) {
    check(DATE_RE.test(date ?? ''), 'INVALID_DATE');
    check(reason?.trim().length >= 3, 'REASON_REQUIRED');
    const u = await this.prisma.user.findFirst({ where: { id: userId, companyId: a.companyId }, include: { branch: true, company: true } });
    if (!u) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    return u;
  }

  /** HR excuses a late/absent day (mandatory reason, audited). The engine then treats the day as neutral. */
  async excuse(a: AuthCtx, d: { userId: string; date: string; reason: string }) {
    await this.target(a, d.userId, d.date, d.reason);
    const row = await this.prisma.excuse.upsert({ where: { userId_localDate: { userId: d.userId, localDate: d.date } },
      create: { companyId: a.companyId, userId: d.userId, localDate: d.date, reason: d.reason.trim(), createdById: a.userId },
      update: { reason: d.reason.trim(), createdById: a.userId } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'EXCUSE', entity: 'Excuse', entityId: row.id, after: row as any, reason: d.reason } });
    return row;
  }
  async removeExcuse(a: AuthCtx, userId: string, date: string, reason: string) {
    await this.target(a, userId, date, reason);
    const res = await this.prisma.excuse.deleteMany({ where: { companyId: a.companyId, userId, localDate: date } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'EXCUSE_REMOVE', entity: 'Excuse', entityId: `${userId}:${date}`, reason } });
    return { removed: res.count };
  }

  /** HR enters/corrects a check-in by hand (dead phone, etc.). Status comes from the employee's policy, never from the caller. */
  async manual(a: AuthCtx, d: { userId: string; date: string; time: string; reason: string }) {
    check(/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time ?? ''), 'INVALID_TIME');
    const u = await this.target(a, d.userId, d.date, d.reason);
    const policy = await this.resolvePolicy(a.companyId, u as any);
    const min = hhmmToMinutes(d.time);
    const tier = policy.tiers.find((t) => min <= hhmmToMinutes(t.until!)) ?? policy.absentTier;
    const before = await this.prisma.attendanceRecord.findUnique({ where: { userId_localDate: { userId: d.userId, localDate: d.date } } });
    const data = { companyId: a.companyId, userId: d.userId, localDate: d.date, checkInAt: localToUtc(d.date, d.time, u.company.timezone),
      source: 'MANUAL' as any, status: tier.key, flags: ['MANUAL_EDIT'] };
    const row = before
      ? await this.prisma.attendanceRecord.update({ where: { id: before.id }, data })
      : await this.prisma.attendanceRecord.create({ data });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'ATTENDANCE_MANUAL', entity: 'AttendanceRecord', entityId: row.id, before: before as any, after: row as any, reason: d.reason } });
    return row;
  }
}
