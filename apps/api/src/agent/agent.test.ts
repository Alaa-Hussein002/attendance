import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '@attendance/shared';
import { AgentService } from './agent.service';

// In-memory database: tests the real punch rules without PostgreSQL or a physical terminal.
let users: any[]; let records: any[]; let punchLogs: any[];
const dev: any = { id: 'd1', companyId: 'c1', clockOffsetMs: 0, company: { timezone: 'Asia/Riyadh' } };
const prisma: any = {
  user: { findFirst: async ({ where }: any) => users.find((u) => u.companyId === where.companyId && u.biometricId === where.biometricId && u.active) ?? null },
  attendanceRecord: {
    findUnique: async ({ where }: any) => records.find((r) => r.userId === where.userId_localDate.userId && r.localDate === where.userId_localDate.localDate) ?? null,
    create: async ({ data }: any) => { records.push({ id: `r${records.length}`, ...data }); }, update: async ({ where, data }: any) => { Object.assign(records.find((r) => r.id === where.id), data); },
  },
  punchLog: { findUnique: async ({ where }: any) => { const k = where.deviceId_biometricId_punchedAtLocal; return punchLogs.find((p) => p.deviceId === k.deviceId && p.biometricId === k.biometricId && p.punchedAtLocal === k.punchedAtLocal) ?? null; }, create: async ({ data }: any) => { punchLogs.push(data); } },
  biometricDevice: { update: async () => ({}) },
};
const attendance: any = { resolvePolicy: async () => DEFAULT_POLICY };
const svc = () => new AgentService(prisma, attendance);

beforeEach(() => { records = []; punchLogs = [];
  users = [{ id: 'u7', companyId: 'c1', biometricId: '7', active: true, tracksAttendance: true, policyId: null, branch: null }, { id: 'u8', companyId: 'c1', biometricId: '8', active: true, tracksAttendance: true, policyId: null, branch: null }, { id: 'u9', companyId: 'c1', biometricId: '9', active: true, tracksAttendance: false, policyId: null, branch: null }]; });

describe('fingerprint punches', () => {
  it('the first punch of the day is the check-in (Riyadh time converted to UTC)', async () => {
    const r = await svc().processOne(dev, { biometricId: '7', time: '2026-10-06 09:58' });
    expect(r).toMatchObject({ result: 'RECORDED', status: 'GREEN' }); expect(records[0].checkInAt.toISOString()).toBe('2026-10-06T06:58:00.000Z'); expect(records[0].source).toBe('FINGERPRINT');
  });
  it('later punches the same day are duplicates (e.g. leaving the office)', async () => {
    const s = svc(); await s.processOne(dev, { biometricId: '7', time: '2026-10-06 09:58' });
    expect((await s.processOne(dev, { biometricId: '7', time: '2026-10-06 18:00' })).result).toBe('DUPLICATE_DAY'); expect(records).toHaveLength(1);
  });
  it('a late punch is RED, and an earlier punch arriving afterwards improves it to GREEN', async () => {
    const s = svc(); expect((await s.processOne(dev, { biometricId: '8', time: '2026-10-06 10:40' })).status).toBe('RED');
    expect(await s.processOne(dev, { biometricId: '8', time: '2026-10-06 10:05' })).toMatchObject({ result: 'IMPROVED', status: 'GREEN' }); expect(records[0].status).toBe('GREEN');
  });
  it('a punch after the last allowed time creates no attendance (day stays absent)', async () => {
    expect(await svc().processOne(dev, { biometricId: '7', time: '2026-10-06 13:00' })).toMatchObject({ result: 'TOO_LATE' }); expect(records).toHaveLength(0);
  });
  it('unknown fingerprint id is kept as UNMAPPED, not lost', async () => { expect((await svc().processOne(dev, { biometricId: '55', time: '2026-10-06 09:00' })).result).toBe('UNMAPPED'); });
  it('staff outside attendance tracking are ignored', async () => { expect((await svc().processOne(dev, { biometricId: '9', time: '2026-10-06 09:00' })).result).toBe('NOT_TRACKED'); expect(records).toHaveLength(0); });
  it('a manual HR entry is never overwritten by a later-arriving earlier punch', async () => {
    records.push({ id: 'm', userId: 'u7', localDate: '2026-10-06', checkInAt: new Date('2026-10-06T08:00:00Z'), source: 'MANUAL', status: 'RED' });
    expect((await svc().processOne(dev, { biometricId: '7', time: '2026-10-06 09:30' })).result).toBe('DUPLICATE_DAY'); expect(records[0].source).toBe('MANUAL');
  });
  it('device clock far from the server is flagged on the record', async () => {
    await svc().processOne({ ...dev, clockOffsetMs: 20 * 60000 }, { biometricId: '7', time: '2026-10-06 09:58' }); expect(records[0].flags).toContain('DEVICE_CLOCK_SKEW');
  });
  it('sending the same batch twice is harmless (agent retries)', async () => {
    const s = svc(); const batch = [{ biometricId: '7', time: '2026-10-06 09:58' }, { biometricId: '8', time: '2026-10-06 10:40' }];
    expect(await s.punches(dev, batch)).toMatchObject({ received: 2, RECORDED: 2 }); expect(await s.punches(dev, batch)).toMatchObject({ received: 2, repeated: 2 }); expect(records).toHaveLength(2);
  });
});
