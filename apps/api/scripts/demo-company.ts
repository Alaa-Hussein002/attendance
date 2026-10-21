// Loads N demo employees with realistic attendance into the CURRENT database (never in production).
//   npm run demo:data  -w @attendance/api -- 50        (adds 50)
//   npm run demo:clean -w @attendance/api              (removes everything it added)
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { expandDateRange, localToUtc, normalizePolicy, periodBounds, periodOf, tierForMinutes, toLocalParts } from '@attendance/shared';
import { hashPassword } from '../src/auth/crypto';
import { generate, mulberry32, PATTERNS } from './demo-lib';

const prisma = new PrismaClient(); const DOMAIN = '@demo.test';
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

async function clean(companyId: string) {
  const ids = (await prisma.user.findMany({ where: { companyId, email: { endsWith: DOMAIN } }, select: { id: true } })).map((u: { id: string }) => u.id); if (!ids.length) return 0;
  const byUser = { userId: { in: ids } };
  await prisma.$transaction([prisma.attendanceRecord.deleteMany({ where: byUser }), prisma.leaveRequest.deleteMany({ where: byUser }), prisma.excuse.deleteMany({ where: byUser }), prisma.excuseRequest.deleteMany({ where: byUser }),
    prisma.taskAssignee.deleteMany({ where: byUser }), prisma.punchLog.deleteMany({ where: { userId: { in: ids } } }), prisma.monthlySummary.deleteMany({ where: byUser }),
    prisma.otpChallenge.deleteMany({ where: byUser }), prisma.refreshToken.deleteMany({ where: byUser }), prisma.device.deleteMany({ where: byUser }), prisma.user.deleteMany({ where: { id: { in: ids } } })]);
  return ids.length;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run in production.');
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } }); if (!company) throw new Error('Run the setup wizard first (no company yet).');
  if (process.argv.includes('--clean')) { console.log(`Removed ${await clean(company.id)} demo employees.`); return; }
  const N = Math.min(2000, Math.max(1, Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 50)));
  const row = await prisma.attendancePolicy.findFirst({ where: { companyId: company.id, isDefault: true, active: true } }); if (!row) throw new Error('No default policy.');
  const policy = normalizePolicy(row.config); const tz = company.timezone;
  const today = toLocalParts(new Date(), tz).date; const pm = periodOf(today, policy.payrollStartDay); const { from, to } = periodBounds(pm.year, pm.month, policy.payrollStartDay);
  const days = expandDateRange(from, to).filter((d) => d <= today); // only days that already happened
  let branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) branch = await prisma.branch.create({ data: { companyId: company.id, name: 'فرع تجريبي', latitude: 21.5433, longitude: 39.1728, radiusMeters: 150, allowedIpRanges: [], verificationModes: ['GPS', 'NETWORK'] } });
  await clean(company.id); const pw = hashPassword(process.env.DEMO_PASSWORD ?? '12345678'); const now = new Date();

  const users = Array.from({ length: N }, (_, i) => ({ id: undefined as string | undefined, i, key: PATTERNS[i % PATTERNS.length][0] }));
  await prisma.user.createMany({ data: users.map((u) => ({ companyId: company.id, branchId: branch!.id, role: (u.i % 3 === 0 ? 'EMPLOYEE' : 'PHOTOGRAPHER') as any, name: `موظف تجريبي ${u.i + 1} (${u.key})`, email: `demo.${u.i + 1}${DOMAIN}`, passwordHash: pw,
    baseSalary: 3000 + (u.i % 10) * 500, biometricId: String(u.i + 1), startDate: '2020-01-01', emailVerifiedAt: now, mustChangePassword: false, tracksAttendance: true })) });
  const created = await prisma.user.findMany({ where: { companyId: company.id, email: { endsWith: DOMAIN } }, select: { id: true, email: true } });
  const idOf = (i: number) => created.find((c: { email: string }) => c.email === `demo.${i + 1}${DOMAIN}`)!.id;

  const rec: any[] = []; const leaves: any[] = []; const exc: any[] = [];
  for (const u of users) {
    const g = generate(u.key, days, policy, mulberry32(u.i + 1)); const userId = idOf(u.i);
    if (g.activeFrom) await prisma.user.update({ where: { id: userId }, data: { startDate: g.activeFrom } });
    for (const r of g.records) { const t = tierForMinutes(policy, r.minutes); rec.push({ companyId: company.id, userId, localDate: r.date, checkInAt: localToUtc(r.date, hhmm(r.minutes), tz), source: r.source, status: (t ?? policy.absentTier).key, flags: [] }); }
    if (g.leaveDays.length) leaves.push({ companyId: company.id, userId, fromDate: g.leaveDays[0], toDate: g.leaveDays[g.leaveDays.length - 1], status: 'APPROVED', reason: 'إجازة تجريبية' });
    for (const d of g.excusedDays) exc.push({ companyId: company.id, userId, localDate: d, reason: 'عذر تجريبي', createdById: userId });
  }
  for (let i = 0; i < rec.length; i += 1000) await prisma.attendanceRecord.createMany({ data: rec.slice(i, i + 1000), skipDuplicates: true });
  if (leaves.length) await prisma.leaveRequest.createMany({ data: leaves }); if (exc.length) await prisma.excuse.createMany({ data: exc, skipDuplicates: true });
  console.log(`\n✓ ${N} موظفاً تجريبياً (${DOMAIN}) و${rec.length} تسجيل حضور للفترة ${from} → ${to}\n  كلمة مرورهم: ${process.env.DEMO_PASSWORD ?? '12345678'} · أرقام بصماتهم: 1..${N}\n  افتح «التقارير والرواتب» لرؤية النتائج. للحذف: npm run demo:clean -w @attendance/api\n`);
}
main().finally(() => prisma.$disconnect());
