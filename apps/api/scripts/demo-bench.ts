// Scale test (no database): npm run demo:bench -w @attendance/api -- 5000
import { performance } from 'perf_hooks';
import { calculateMonth, DEFAULT_POLICY, expandDateRange, periodBounds } from '@attendance/shared';
import { generate, mulberry32, PATTERNS } from './demo-lib';

const N = Number(process.argv[2] ?? 1000); const p = DEFAULT_POLICY;
const { from, to } = periodBounds(2026, 10, p.payrollStartDay); const days = expandDateRange(from, to);
type Agg = { n: number; net: number; ded: number; bonus: number; redeemed: number }; const agg = new Map<string, Agg>();
const t0 = performance.now(); let records = 0;
for (let i = 0; i < N; i++) {
  const [key] = PATTERNS[i % PATTERNS.length]; const g = generate(key, days, p, mulberry32(i + 1)); records += g.records.length;
  const r = calculateMonth({ year: 2026, month: 10, baseSalary: 300000 + (i % 10) * 50000, policy: p, records: g.records.map((x) => ({ date: x.date, checkInMinutes: x.minutes })), leaveDays: g.leaveDays, excusedDays: g.excusedDays, activeFrom: g.activeFrom });
  const a = agg.get(key) ?? { n: 0, net: 0, ded: 0, bonus: 0, redeemed: 0 }; a.n++; a.net += r.netAdjustment; a.ded += r.totalDeductions; a.bonus += r.bonus; a.redeemed += r.counts.REDEEMED; agg.set(key, a);
}
const ms = performance.now() - t0;
console.log(`\nفترة ${from} → ${to} · ${N} موظف · ${records} تسجيل حضور`);
console.log('النمط'.padEnd(18) + 'العدد'.padStart(7) + 'متوسط الخصم'.padStart(14) + 'متوسط المكافأة'.padStart(16) + 'تعويضات'.padStart(10));
for (const [k] of PATTERNS) { const a = agg.get(k); if (a) console.log(k.padEnd(18) + String(a.n).padStart(7) + (a.ded / a.n / 100).toFixed(2).padStart(14) + (a.bonus / a.n / 100).toFixed(2).padStart(16) + String(a.redeemed).padStart(10)); }
console.log(`\nالزمن: ${ms.toFixed(0)} ms إجمالاً · ${(ms / N).toFixed(3)} ms للموظف الواحد · ذاكرة ${(process.memoryUsage().heapUsed / 1048576).toFixed(0)} MB\n`);
