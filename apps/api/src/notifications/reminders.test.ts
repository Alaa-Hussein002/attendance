import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotificationService } from './notification.service';
import { RemindersService } from './reminders.service';

// In-memory stand-ins: this tests the REAL scheduling + idempotency logic, with no database or SMTP.
const company = { id: 'c1', timezone: 'Asia/Riyadh' };
const user = { id: 'u1', name: 'علي', email: 'ali@example.com', phone: null, active: true };
const T = (id: string, startZ: string, endZ: string) => ({ id, companyId: 'c1', title: `مهمة ${id}`, details: null, address: 'جدة', latitude: 21.5, longitude: 39.1, startsAt: new Date(startZ), endsAt: new Date(endZ), status: 'SCHEDULED', updatedAt: new Date(), assignees: [{ userId: 'u1', user }] });

let tasks: any[]; let sent: { to: string; subject: string; text: string }[]; let logKeys: Set<string>;
const inRange = (d: Date, w: any) => (w.gt ? d > w.gt : true) && (w.gte ? d >= w.gte : true) && (w.lt ? d < w.lt : true) && (w.lte ? d <= w.lte : true);
const prisma: any = {
  task: { findMany: async ({ where }: any) => tasks.filter((t) => t.status === where.status && inRange(t.startsAt, where.startsAt)) },
  company: { findMany: async () => [company], findUnique: async () => company },
  user: { findMany: async () => [user] },
  notificationLog: {
    create: async ({ data }: any) => { const k = [data.userId, data.kind, data.refKey, data.channel].join('|'); if (logKeys.has(k)) throw Object.assign(new Error('dup'), { code: 'P2002' }); logKeys.add(k); return { id: k }; },
    update: async () => ({}),
  },
};
const mail: any = { send: async (m: any) => { sent.push(m); } };
const wa: any = { ready: async () => null };
const svc = () => new RemindersService(prisma, new NotificationService(prisma, mail, wa));

beforeEach(() => { sent = []; logKeys = new Set(); tasks = [T('A', '2026-10-06T10:00:00Z', '2026-10-06T13:00:00Z'), T('B', '2026-10-06T05:00:00Z', '2026-10-06T07:00:00Z')]; });

describe('reminders (07:30 Riyadh = 04:30Z)', () => {
  it('sends ONE morning digest with both of today\'s tasks, plus the hour-before reminder for the task starting in 30 min', async () => {
    await svc().runOnce(new Date('2026-10-06T04:30:00Z'));
    const digest = sent.filter((m) => m.subject.includes('مهام اليوم')); const rem = sent.filter((m) => m.subject.includes('تذكير'));
    expect(digest).toHaveLength(1); expect(digest[0].text).toContain('مهمة A'); expect(digest[0].text).toContain('مهمة B'); expect(digest[0].to).toBe('ali@example.com');
    expect(rem).toHaveLength(1); expect(rem[0].text).toContain('مهمة B');
  });
  it('is idempotent: running the scheduler again the same minute (or restart) sends nothing new', async () => {
    const s = svc(); await s.runOnce(new Date('2026-10-06T04:30:00Z')); const n = sent.length;
    await s.runOnce(new Date('2026-10-06T04:30:00Z')); await s.runOnce(new Date('2026-10-06T04:31:00Z'));
    expect(sent).toHaveLength(n);
  });
  it('later in the morning there is no second digest and no reminder for a task that already started', async () => {
    const s = svc(); await s.runOnce(new Date('2026-10-06T04:30:00Z')); const n = sent.length; await s.runOnce(new Date('2026-10-06T05:40:00Z')); expect(sent).toHaveLength(n);
  });
  it('the reminder for the afternoon task fires 30 minutes before it, and no digest after noon', async () => {
    const s = svc(); await s.runOnce(new Date('2026-10-06T04:30:00Z')); const n = sent.length;
    await s.runOnce(new Date('2026-10-06T09:30:00Z')); // 12:30 local, task A starts 13:00 local
    expect(sent).toHaveLength(n + 1); expect(sent[n].subject).toContain('تذكير'); expect(sent[n].text).toContain('مهمة A');
  });
  it('cancelled tasks are never announced', async () => {
    tasks.forEach((t) => (t.status = 'CANCELLED')); await svc().runOnce(new Date('2026-10-06T04:30:00Z')); expect(sent).toHaveLength(0);
  });
  it('does nothing before 07:00 local', async () => {
    tasks = [T('C', '2026-10-06T10:00:00Z', '2026-10-06T12:00:00Z')]; await svc().runOnce(new Date('2026-10-06T03:30:00Z')); expect(sent).toHaveLength(0); // 06:30 local
  });
});
