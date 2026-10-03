/**
 * Attendance points engine v2 — PURE, fully POLICY-DRIVEN (HR edits the policy, never the code).
 * Money = INTEGER minor units (halalas). Times = LOCAL company time (see toLocalParts).
 */
import { hhmmToMinutes } from './time';

export type Kind = 'ON_TIME' | 'LATE' | 'ABSENT';
export type NeutralKind = 'EXCUSED' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'FUTURE';

export interface DeductionRule {
  type: 'FIXED' | 'PER_MINUTE' | 'SALARY_FRACTION' | 'PERCENT_OF_SALARY';
  value: number;
}
/** A band of check-in time. HR can add/remove/rename/recolor any number of bands. */
export interface Tier {
  key: string; label: string; color: string; // color: #RRGGBB
  kind: Kind;
  until?: string;                 // "HH:mm" inclusive; required for ON_TIME/LATE tiers
  deduction?: DeductionRule;
}
/** "target day can be cancelled by spending `cost` unused days of tier `currency`". */
export interface RedemptionRule { target: string; currency: string; cost: number }

export interface AttendancePolicy {
  shiftStart: string;
  tiers: Tier[];                  // time bands, ascending by `until`
  absentTier: Tier;               // no check-in, or later than the last band
  weeklyOffDays: number[];        // 0=Sun..6=Sat
  salaryDivisor: number;
  redemption: {
    enabled: boolean; rules: RedemptionRule[];
    policy: 'AFTER_ONLY' | 'ANY';                 // which currency days may pay
    order: 'CHRONOLOGICAL' | 'HIGHEST_DEDUCTION_FIRST';
    maxPerMonth: number | null;
  };
  bonus: {
    enabled: boolean; type: 'FIXED' | 'PERCENT'; value: number;
    allowsRedemption: boolean;    // do redeemed days still qualify?
    maxBadDays: number;           // tolerated bad days (0 = perfect month)
  };
}

export const DEFAULT_POLICY: AttendancePolicy = {
  shiftStart: '10:00',
  tiers: [
    { key: 'GREEN', label: 'في الوقت', color: '#22c55e', kind: 'ON_TIME', until: '10:15' },
    { key: 'RED', label: 'متأخر', color: '#ef4444', kind: 'LATE', until: '12:00',
      deduction: { type: 'FIXED', value: 5000 } },
  ],
  absentTier: { key: 'BLACK', label: 'غائب', color: '#111827', kind: 'ABSENT',
    deduction: { type: 'SALARY_FRACTION', value: 1 } },
  weeklyOffDays: [5, 6],
  salaryDivisor: 30,
  redemption: {
    enabled: true, policy: 'AFTER_ONLY', order: 'CHRONOLOGICAL', maxPerMonth: null,
    rules: [{ target: 'RED', currency: 'GREEN', cost: 1 }, { target: 'BLACK', currency: 'GREEN', cost: 5 }],
  },
  bonus: { enabled: true, type: 'FIXED', value: 30000, allowsRedemption: false, maxBadDays: 0 },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Validate a policy BEFORE saving it (used by the HR settings page and the API). Returns error list. */
export function validatePolicy(p: AttendancePolicy): string[] {
  const e: string[] = [];
  if (!TIME_RE.test(p.shiftStart)) e.push('shiftStart: invalid time');
  if (!p.tiers.length) e.push('tiers: at least one tier required');
  const all = [...p.tiers, p.absentTier];
  const keys = new Set<string>();
  for (const t of all) {
    if (!t.key) e.push('tier: key required');
    if (keys.has(t.key)) e.push(`tier ${t.key}: duplicate key`);
    keys.add(t.key);
    if (!COLOR_RE.test(t.color)) e.push(`tier ${t.key}: invalid color`);
    if (t.deduction && !(t.deduction.value >= 0)) e.push(`tier ${t.key}: deduction must be >= 0`);
    if (t.deduction?.type === 'PERCENT_OF_SALARY' && t.deduction.value > 100) e.push(`tier ${t.key}: percent > 100`);
  }
  if (p.absentTier.kind !== 'ABSENT') e.push('absentTier: kind must be ABSENT');
  let prev = -1;
  for (const t of p.tiers) {
    if (t.kind === 'ABSENT') { e.push(`tier ${t.key}: ABSENT only allowed as absentTier`); continue; }
    if (!t.until || !TIME_RE.test(t.until)) { e.push(`tier ${t.key}: until required`); continue; }
    const m = hhmmToMinutes(t.until);
    if (m <= prev) e.push(`tier ${t.key}: until must be later than previous tier`);
    prev = m;
  }
  if (!p.tiers.some((t) => t.kind === 'ON_TIME')) e.push('tiers: need at least one ON_TIME tier');
  if (p.weeklyOffDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) e.push('weeklyOffDays: values 0-6');
  if (!(p.salaryDivisor > 0)) e.push('salaryDivisor must be > 0');
  const seen = new Set<string>();
  for (const r of p.redemption.rules) {
    const target = all.find((t) => t.key === r.target);
    const cur = all.find((t) => t.key === r.currency);
    if (!target || target.kind === 'ON_TIME') e.push(`redemption ${r.target}: target must be a LATE/ABSENT tier`);
    if (!cur || cur.kind !== 'ON_TIME') e.push(`redemption ${r.target}: currency must be an ON_TIME tier`);
    if (!Number.isInteger(r.cost) || r.cost < 1) e.push(`redemption ${r.target}: cost must be integer >= 1`);
    if (seen.has(r.target)) e.push(`redemption ${r.target}: duplicate rule`);
    seen.add(r.target);
  }
  const b = p.bonus;
  if (!(b.value >= 0) || (b.type === 'PERCENT' && b.value > 100)) e.push('bonus: invalid value');
  if (!Number.isInteger(b.maxBadDays) || b.maxBadDays < 0) e.push('bonus: maxBadDays invalid');
  return e;
}

export interface MonthInput {
  year: number; month: number; baseSalary: number;
  policy: AttendancePolicy;
  records: { date: string; checkInMinutes: number }[];
  holidays?: string[]; leaveDays?: string[]; excusedDays?: string[];
  asOfDate?: string;
}
export interface DayResult {
  date: string; status: string; kind: Kind | NeutralKind;
  checkInMinutes?: number; lateMinutes?: number; redeemed: boolean; deduction: number;
}
export interface RedemptionLog { badDate: string; status: string; consumedDays: string[] }
export interface MonthResult {
  days: DayResult[]; counts: Record<string, number>; redemptions: RedemptionLog[];
  lateDeductions: number; absentDeductions: number; totalDeductions: number;
  bonus: number; bonusEligible: boolean; finalized: boolean; netAdjustment: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dow = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); };

function deductionAmount(r: DeductionRule | undefined, base: number, divisor: number, lateMin: number): number {
  if (!r) return 0;
  switch (r.type) {
    case 'FIXED': return Math.round(r.value);
    case 'PER_MINUTE': return Math.round(r.value * lateMin);
    case 'SALARY_FRACTION': return Math.round((r.value * base) / divisor);
    case 'PERCENT_OF_SALARY': return Math.round((base * r.value) / 100);
  }
}

export function calculateMonth(input: MonthInput): MonthResult {
  const { year, month, baseSalary, policy: p } = input;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const asOf = input.asOfDate ?? monthEnd;
  const holidays = new Set(input.holidays ?? []);
  const leaves = new Set(input.leaveDays ?? []);
  const excused = new Set(input.excusedDays ?? []);
  const start = hhmmToMinutes(p.shiftStart);
  const tierByKey = new Map([...p.tiers, p.absentTier].map((t) => [t.key, t]));

  const first = new Map<string, number>();
  for (const r of input.records) {
    const prev = first.get(r.date);
    if (prev === undefined || r.checkInMinutes < prev) first.set(r.date, r.checkInMinutes);
  }

  const days: DayResult[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    const neutral = (k: NeutralKind): DayResult => ({ date, status: k, kind: k, redeemed: false, deduction: 0 });
    if (date > asOf) { days.push(neutral('FUTURE')); continue; }
    if (holidays.has(date)) { days.push(neutral('HOLIDAY')); continue; }
    if (p.weeklyOffDays.includes(dow(date))) { days.push(neutral('WEEKEND')); continue; }
    if (leaves.has(date)) { days.push(neutral('ON_LEAVE')); continue; }
    const ci = first.get(date);
    const tier = ci === undefined ? p.absentTier
      : p.tiers.find((t) => ci <= hhmmToMinutes(t.until!)) ?? p.absentTier;
    if (tier.kind !== 'ON_TIME' && excused.has(date)) { days.push(neutral('EXCUSED')); continue; }
    const lateMin = tier.kind === 'LATE' && ci !== undefined ? Math.max(0, ci - start) : 0;
    days.push({ date, status: tier.key, kind: tier.kind, checkInMinutes: ci,
      lateMinutes: tier.kind === 'LATE' ? lateMin : undefined, redeemed: false,
      deduction: deductionAmount(tier.deduction, baseSalary, p.salaryDivisor, lateMin) });
  }

  // Redemption
  const used = new Set<string>();
  const redemptions: RedemptionLog[] = [];
  if (p.redemption.enabled) {
    const bad = days.filter((d) => d.kind === 'LATE' || d.kind === 'ABSENT');
    if (p.redemption.order === 'HIGHEST_DEDUCTION_FIRST') {
      bad.sort((a, b) => b.deduction - a.deduction || a.date.localeCompare(b.date));
    }
    for (const b of bad) {
      if (p.redemption.maxPerMonth !== null && redemptions.length >= p.redemption.maxPerMonth) break;
      const rule = p.redemption.rules.find((r) => r.target === b.status);
      if (!rule) continue;
      const pool = days.filter((g) => g.status === rule.currency && !used.has(g.date) &&
        (p.redemption.policy === 'ANY' || g.date > b.date));
      if (pool.length < rule.cost) continue;
      const take = pool.slice(0, rule.cost).map((g) => g.date);
      take.forEach((t) => used.add(t));
      b.redeemed = true;
      redemptions.push({ badDate: b.date, status: b.status, consumedDays: take });
    }
    redemptions.sort((a, b) => a.badDate.localeCompare(b.badDate));
  }

  let late = 0, absent = 0;
  for (const d of days) {
    if (d.redeemed) continue;
    if (d.kind === 'LATE') late += d.deduction;
    if (d.kind === 'ABSENT') absent += d.deduction;
  }

  const finalized = asOf >= monthEnd;
  const worked = days.filter((d) => d.kind === 'ON_TIME' || d.kind === 'LATE' || d.kind === 'ABSENT');
  const isBad = (d: DayResult) => d.kind === 'LATE' || d.kind === 'ABSENT';
  const rawBad = worked.filter(isBad).length;
  const remBad = worked.filter((d) => isBad(d) && !d.redeemed).length;
  const b = p.bonus;
  const bonusEligible = b.enabled && finalized && worked.length > 0 &&
    (b.allowsRedemption ? remBad : rawBad) <= b.maxBadDays;
  const bonus = !bonusEligible ? 0 : b.type === 'FIXED' ? Math.round(b.value) : Math.round((baseSalary * b.value) / 100);

  const counts: Record<string, number> = {};
  for (const d of days) counts[d.status] = (counts[d.status] ?? 0) + 1;
  counts.REDEEMED = redemptions.length;
  return { days, counts, redemptions, lateDeductions: late, absentDeductions: absent,
    totalDeductions: late + absent, bonus, bonusEligible, finalized, netAdjustment: bonus - late - absent };
}
