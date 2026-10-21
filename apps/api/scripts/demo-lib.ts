/** Deterministic demo attendance for many employees. PURE: used by the benchmark, the DB loader and the tests. */
import { AttendancePolicy, hhmmToMinutes } from '@attendance/shared';

export type PatternKey = 'PERFECT' | 'LATE_REDEEMED' | 'LATE_END' | 'ABSENT_REDEEMED' | 'ABSENT_END' | 'EXCUSED' | 'ON_LEAVE' | 'MIXED_SOURCES' | 'HEAVY_LATE' | 'NEW_HIRE';
export const PATTERNS: [PatternKey, string][] = [
  ['PERFECT', 'ملتزم طوال الفترة (يستحق المكافأة)'], ['LATE_REDEEMED', '3 أيام تأخر وسطية تُعوَّض بأيام لاحقة'], ['LATE_END', '3 أيام تأخر في آخر الفترة (لا تعويض)'],
  ['ABSENT_REDEEMED', 'غياب يوم واحد تُعوّضه أيام لاحقة'], ['ABSENT_END', 'غياب في آخر يوم (خصم يوم كامل)'], ['EXCUSED', 'غياب بعذر مقبول من الموارد البشرية'],
  ['ON_LEAVE', 'إجازة معتمدة 5 أيام عمل'], ['MIXED_SOURCES', 'حضور بكل الطرق: موقع/شبكة/مهمة/بصمة/يدوي'], ['HEAVY_LATE', 'كثير التأخر (حوالي 40% من الأيام)'], ['NEW_HIRE', 'موظف باشر في منتصف الفترة'],
];
export type Source = 'GPS' | 'NETWORK' | 'TASK' | 'FINGERPRINT' | 'MANUAL';
export interface DayRecord { date: string; minutes: number; source: Source }
export interface Generated { records: DayRecord[]; leaveDays: string[]; excusedDays: string[]; activeFrom?: string }

export function mulberry32(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
export const workingDays = (days: string[], p: AttendancePolicy, holidays: string[] = []) => days.filter((d) => !p.weeklyOffDays.includes(dow(d)) && !holidays.includes(d));

export function generate(pattern: PatternKey, periodDays: string[], p: AttendancePolicy, rng: () => number): Generated {
  const w = workingDays(periodDays, p); const start = hhmmToMinutes(p.shiftStart);
  const green = () => start - Math.floor(rng() * 10);                                   // up to 10 min early
  const firstLate = p.tiers.find((t) => t.kind === 'LATE'); const red = () => (firstLate ? hhmmToMinutes(firstLate.until!) - 1 - Math.floor(rng() * 5) : start + 30);
  const sources: Source[] = ['GPS', 'NETWORK', 'TASK', 'FINGERPRINT', 'MANUAL'];
  const rec = (i: number, bad = false, src: Source = 'GPS'): DayRecord => ({ date: w[i], minutes: bad ? red() : green(), source: src });
  const g: Generated = { records: [], leaveDays: [], excusedDays: [] };
  const n = w.length; const last = n - 1;
  for (let i = 0; i < n; i++) {
    const bad3 = { LATE_REDEEMED: [2, 8, 14], LATE_END: [last - 2, last - 1, last] }[pattern as 'LATE_REDEEMED' | 'LATE_END'] ?? [];
    switch (pattern) {
      case 'ABSENT_REDEEMED': if (i === 5) continue; g.records.push(rec(i)); break;
      case 'ABSENT_END': if (i === last) continue; g.records.push(rec(i)); break;
      case 'EXCUSED': if (i === last) { g.excusedDays.push(w[i]); continue; } g.records.push(rec(i)); break;
      case 'ON_LEAVE': if (i >= 8 && i <= 12) { g.leaveDays.push(w[i]); continue; } g.records.push(rec(i)); break;
      case 'MIXED_SOURCES': g.records.push(rec(i, false, sources[i % sources.length])); break;
      case 'HEAVY_LATE': g.records.push(rec(i, rng() < 0.4)); break;
      case 'NEW_HIRE': if (i < Math.floor(n / 2)) continue; g.records.push(rec(i)); break;
      default: g.records.push(rec(i, bad3.includes(i)));
    }
  }
  if (pattern === 'NEW_HIRE') g.activeFrom = w[Math.floor(n / 2)];
  return g;
}
