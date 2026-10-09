import { Injectable, UnauthorizedException } from '@nestjs/common';
import { localToUtc, tierForMinutes, hhmmToMinutes, toLocalParts } from '@attendance/shared';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../common/prisma.service';
import { sha256 } from '../auth/crypto';

const TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;
export const normalizeTime = (t: string) => { const x = t.replace(' ', 'T'); return x.length === 16 ? `${x}:00` : x; };
export interface Punch { biometricId: string; time: string }
export type PunchResult = 'RECORDED' | 'IMPROVED' | 'DUPLICATE_DAY' | 'UNMAPPED' | 'NOT_TRACKED' | 'TOO_LATE' | 'NO_POLICY';

@Injectable()
export class AgentService {
  constructor(private prisma: PrismaService, private attendance: AttendanceService) {}

  async auth(key?: string) {
    if (!key || key.length < 20) throw new UnauthorizedException('INVALID_DEVICE_KEY');
    const dev = await this.prisma.biometricDevice.findFirst({ where: { apiKeyHash: sha256(key), active: true }, include: { company: true } });
    if (!dev) throw new UnauthorizedException('INVALID_DEVICE_KEY');
    return dev;
  }

  async heartbeat(dev: any, b: { deviceTime?: string }) {
    const now = new Date(); let clockOffsetMs: number | undefined;
    if (b.deviceTime && TIME_RE.test(b.deviceTime)) { const t = normalizeTime(b.deviceTime); clockOffsetMs = localToUtc(t.slice(0, 10), t.slice(11, 16), dev.company.timezone).getTime() - now.getTime(); }
    await this.prisma.biometricDevice.update({ where: { id: dev.id }, data: { lastSeenAt: now, ...(clockOffsetMs !== undefined ? { clockOffsetMs: Math.round(clockOffsetMs) } : {}) } });
    return { ok: true, serverTime: now.toISOString() };
  }

  /** What to do with ONE punch. The first punch of a day is the check-in; later ones that day are ignored. */
  async processOne(dev: any, p: Punch): Promise<{ result: PunchResult; userId?: string; status?: string }> {
    const tz = dev.company.timezone; const t = normalizeTime(p.time); const localDate = t.slice(0, 10); const hhmm = t.slice(11, 16);
    const user = await this.prisma.user.findFirst({ where: { companyId: dev.companyId, biometricId: p.biometricId, active: true }, include: { branch: true } });
    if (!user) return { result: 'UNMAPPED' };
    if (!user.tracksAttendance) return { result: 'NOT_TRACKED', userId: user.id };
    const at = localToUtc(localDate, hhmm, tz);
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_localDate: { userId: user.id, localDate } } });
    // the first punch of the day is the check-in: anything later that day (leaving, going out) is just a repeat
    if (existing && (existing.source === 'MANUAL' || existing.checkInAt <= at)) return { result: 'DUPLICATE_DAY', userId: user.id };
    let policy; try { policy = await this.attendance.resolvePolicy(dev.companyId, user); } catch { return { result: 'NO_POLICY', userId: user.id }; }
    const tier = tierForMinutes(policy, hhmmToMinutes(hhmm));
    if (!tier) return existing ? { result: 'DUPLICATE_DAY', userId: user.id } : { result: 'TOO_LATE', userId: user.id, status: policy.absentTier.key };
    const flags = Math.abs(dev.clockOffsetMs ?? 0) > 5 * 60000 ? ['DEVICE_CLOCK_SKEW'] : [];
    if (!existing) {
      await this.prisma.attendanceRecord.create({ data: { companyId: dev.companyId, userId: user.id, localDate, checkInAt: at, source: 'FINGERPRINT', status: tier.key, deviceUid: dev.id, flags } });
      return { result: 'RECORDED', userId: user.id, status: tier.key };
    }
    await this.prisma.attendanceRecord.update({ where: { id: existing.id }, data: { checkInAt: at, source: 'FINGERPRINT', status: tier.key, taskId: null, flags } });
    return { result: 'IMPROVED', userId: user.id, status: tier.key };
  }

  async punches(dev: any, list: Punch[]) {
    const counts: Record<string, number> = { received: list.length, repeated: 0 };
    for (const p of list) {
      const t = normalizeTime(p.time);
      if (await this.prisma.punchLog.findUnique({ where: { deviceId_biometricId_punchedAtLocal: { deviceId: dev.id, biometricId: p.biometricId, punchedAtLocal: t } } })) { counts.repeated++; continue; }
      const r = await this.processOne(dev, p);
      await this.prisma.punchLog.create({ data: { companyId: dev.companyId, deviceId: dev.id, biometricId: p.biometricId, punchedAtLocal: t, localDate: t.slice(0, 10), userId: r.userId ?? null, result: r.result, status: r.status ?? null } });
      counts[r.result] = (counts[r.result] ?? 0) + 1;
    }
    await this.prisma.biometricDevice.update({ where: { id: dev.id }, data: { lastSyncAt: new Date(), lastSeenAt: new Date() } });
    return counts;
  }

  /** After HR maps a biometric id to an employee, earlier UNMAPPED punches can finally be applied. */
  async reprocess(companyId: string) {
    const rows = await this.prisma.punchLog.findMany({ where: { companyId, result: 'UNMAPPED' }, include: { device: { include: { company: true } } }, orderBy: { punchedAtLocal: 'asc' }, take: 2000 });
    let applied = 0;
    for (const row of rows) {
      const r = await this.processOne(row.device, { biometricId: row.biometricId, time: row.punchedAtLocal });
      if (r.result === 'UNMAPPED') continue;
      await this.prisma.punchLog.update({ where: { id: row.id }, data: { result: r.result, userId: r.userId ?? null, status: r.status ?? null } }); applied++;
    }
    return { checked: rows.length, applied };
  }
}
