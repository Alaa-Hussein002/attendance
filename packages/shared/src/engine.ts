/**
 * Attendance points engine v3 — PURE, fully POLICY-DRIVEN (HR edits the policy, never the code).
 * Money = INTEGER minor units (halalas). Times = LOCAL company time (see toLocalParts).
 */
import { expandDateRange, hhmmToMinutes, periodBounds } from './time';

export type Kind = 'ON_TIME' | 'LATE' | 'ABSENT';
export type NeutralKind = 'EXCUSED' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'FUTURE';
export const MAX_TIERS = 5;

export interface DeductionRule {
  type: 'FIXED' | 'PER_MINUTE' | 'SALARY_FRACTION' | 'PERCENT_OF_SALARY';
  value: number;
}
/** A band of check-in time: from the previous band's end (or the shift start) up to `until`, inclusive. */
export interface Tier {
  key: string; label: string; color: string;   // color: #RRGGBB
  kind: Kind;
  until?: string;                               // "HH:mm"; required for ON_TIME/LATE tiers
  deduction?: DeductionRule;
}
/** "target day can be cancelled by spending `cost` later unused days of tier `currency`". */
export interface RedemptionRule { target: string; currency: string; cost: number }
export interface BonusAllowance { tier: string; days: number }

export interface AttendancePolicy {
  shiftStart: string;
  tiers: Tier[];                  // 1..MAX_TIERS time bands, ascending by `until`
  absentTier: Tier;               // no check-in, or later than the last band
  weeklyOffDays: number[];        // 0=Sun..6=Sat
  payrollStartDay: number;        // 1..28. 25 => each payroll month runs 25th -> 24th
  redemption: {
    enabled: boolean; rules: RedemptionRule[];
    policy: 'AFTER_ONLY' | 'ANY';                                   // which currency days may pay
    order: 'CHRONOLOGICAL' | 'LATEST_FIRST' | 'HIGHEST_DEDUCTION_FIRST';
    maxPerMonth: number | null;
  };
  bonus: {
    enabled: boolean; type: 'FIXED' | 'PERCENT'; value: number;
    qualifyingTier: string;       // the tier every working day should be in
    allowances: BonusAllowance[]; // tolerated days in other tiers (e.g. LATE: 3 days)
    allowsRedemption: boolean;    // redeemed days count as qualifying days
  };
}

export const DEFAULT_POLICY: AttendancePolicy = {
  shiftStart: '10:00',
  tiers: [
    { key: 'GREEN', label: 'منضبط', color: '#22a559', kind: 'ON_TIME', until: '10:15' },
    { key: 'RED', label: 'متأخر', color: '#e65a2e', kind: 'LATE', until: '12:00', deduction: { type: 'FIXED', value: 5000 } },
  ],
  absentTier: { key: 'BLACK', label: 'غائب', color: '#111111', kind: 'ABSENT', deduction: { type: 'SALARY_FRACTION', value: 1 } },
  weeklyOffDays: [5, 6],
  payrollStartDay: 25,
  redemption: {
    enabled: true, policy: 'AFTER_ONLY', order: 'LATEST_FIRST', maxPerMonth: null,
    rules: [{ target: 'RED', currency: 'GREEN', cost: 1 }, { target: 'BLACK', currency: 'GREEN', cost: 5 }],
  },
  bonus: { enabled: true, type: 'FIXED', value: 5000, qualifyingTier: 'GREEN', allowances: [], allowsRedemption: false },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Validate a policy BEFORE saving it (HR settings page + API). Returns a list of error codes with details. */
export function validatePolicy(p: AttendancePolicy): string[] {
  const e: string[] = [];
  if (!TIME_RE.test(p.shiftStart)) e.push('shiftStart: invalid time');
  if (!p.tiers.length) e.push('tiers: at least one tier required');
  if (p.tiers.length > MAX_TIERS) e.push(`tiers: at most ${MAX_TIERS} tiers`);
  const all = [...p.tiers, p.absentTier];
  const keys = new Set<string>();
  for (const t of all) {
    if (!t.key) e.push('tier: key required');
    if (keys.has(t.key)) e.push(`tier ${t.key}: duplicate key`);
    keys.add(t.key);
    if (!t.label?.trim()) e.push(`tier ${t.key}: name required`);
    if (!COLOR_RE.test(t.color)) e.push(`tier ${t.key}: invalid color`);
    if (t.deduction && !(t.deduction.value >= 0)) e.push(`tier ${t.key}: deduction must be >= 0`);
    if (t.deduction?.type === 'PERCENT_OF_SALARY' && t.deduction.value > 100) e.push(`tier ${t.key}: percent > 100`);
  }
  if (p.absentTier.kind !== 'ABSENT') e.push('absentTier: kind must be ABSENT');
  // Bands never overlap and never start before the shift: each band ends strictly after the previous one (the first after shiftStart).
  let prev = TIME_RE.test(p.shiftStart) ? hhmmToMinutes(p.shiftStart) : -1;
  for (const t of p.tiers) {
    if (t.kind === 'ABSENT') { e.push(`tier ${t.key}: ABSENT only allowed as absentTier`); continue; }
    if (!t.until || !TIME_RE.test(t.until)) { e.push(`tier ${t.key}: until required`); continue; }
    const m = hhmmToMinutes(t.until);
    if (m <= prev) e.push(`tier ${t.key}: until must be later than ${prev === hhmmToMinutes(p.shiftStart) && t === p.tiers[0] ? 'shift start' : 'previous tier'}`);
    prev = m;
  }
  if (!p.tiers.some((t) => t.kind === 'ON_TIME')) e.push('tiers: need at least one ON_TIME tier');
  if (p.weeklyOffDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) e.push('weeklyOffDays: values 0-6');
  if (!Number.isInteger(p.payrollStartDay) || p.payrollStartDay < 1 || p.payrollStartDay > 28) e.push('payrollStartDay: 1-28');
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
  if (b.enabled) {
    if (!p.tiers.some((t) => t.key === b.qualifyingTier)) e.push('bonus: qualifyingTier must be one of the time tiers');
    const used = new Set<string>();
    for (const a of b.allowances) {
      if (!all.some((t) => t.key === a.tier)) e.push(`bonus allowance ${a.tier}: unknown tier`);
      if (a.tier === b.qualifyingTier) e.push(`bonus allowance ${a.tier}: same as the qualifying tier`);
      if (!Number.isInteger(a.days) || a.days < 1) e.push(`bonus allowance ${a.tier}: days must be integer >= 1`);
      if (used.has(a.tier)) e.push(`bonus allowance ${a.tier}: duplicate`);
      used.add(a.tier);
    }
  }
  return e;
}

export interface MonthInput {
  year: number; month: number; baseSalary: number;     // (year, month) = the payroll month; see periodBounds
  policy: AttendancePolicy;
  records: { date: string; checkInMinutes: number }[];
  holidays?: string[]; leaveDays?: string[]; excusedDays?: string[];
  asOfDate?: string;
}
export interface DayResult {
  date: string; status: string; kind: Kind | NeutralKind;
  checkInMinutes?: number; lateMinutes?: number; redeemed: boolean; redeemedBy?: string[]; deduction: number;
}
export interface RedemptionLog { badDate: string; status: string; consumedDays: string[] }
export interface BonusExceeded { tier: string; count: number; allowed: number }
export interface MonthResult {
  period: { from: string; to: string; days: number };
  days: DayResult[]; counts: Record<string, number>; redemptions: RedemptionLog[];
  lateDeductions: number; absentDeductions: number; totalDeductions: number;
  bonus: number; bonusEligible: boolean; bonusExceeded: BonusExceeded[];
  finalized: boolean; netAdjustment: number;
}

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
  const { from, to } = periodBounds(year, month, p.payrollStartDay ?? 1);
  const dates = expandDateRange(from, to);
  const divisor = dates.length;                      // daily rate = salary / days in THIS payroll period (never shown to HR)
  const asOf = input.asOfDate ?? to;
  const holidays = new Set(input.holidays ?? []);
  const leaves = new Set(input.leaveDays ?? []);
  const excused = new Set(input.excusedDays ?? []);
  const start = hhmmToMinutes(p.shiftStart);

  const first = new Map<string, number>();
  for (const r of input.records) {
    const prev = first.get(r.date);
    if (prev === undefined || r.checkInMinutes < prev) first.set(r.date, r.checkInMinutes);
  }

  const days: DayResult[] = [];
  for (const date of dates) {
    const neutral = (k: NeutralKind): DayResult => ({ date, status: k, kind: k, redeemed: false, deduction: 0 });
    if (date > asOf) { days.push(neutral('FUTURE')); continue; }
    if (holidays.has(date)) { days.push(neutral('HOLIDAY')); continue; }
    if (p.weeklyOffDays.includes(dow(date))) { days.push(neutral('WEEKEND')); continue; }
    if (leaves.has(date)) { days.push(neutral('ON_LEAVE')); continue; }
    const ci = first.get(date);
    const tier = ci === undefined ? p.absentTier : p.tiers.find((t) => ci <= hhmmToMinutes(t.until!)) ?? p.absentTier;
    if (tier.kind !== 'ON_TIME' && excused.has(date)) { days.push(neutral('EXCUSED')); continue; }
    const lateMin = tier.kind === 'LATE' && ci !== undefined ? Math.max(0, ci - start) : 0;
    days.push({ date, status: tier.key, kind: tier.kind, checkInMinutes: ci,
      lateMinutes: tier.kind === 'LATE' ? lateMin : undefined, redeemed: false,
      deduction: deductionAmount(tier.deduction, baseSalary, divisor, lateMin) });
  }

  // Redemption: each later qualifying day cancels one earlier bad day (cost per rule; each day is spent once)
  const used = new Set<string>();
  const redemptions: RedemptionLog[] = [];
  if (p.redemption.enabled) {
    const bad = days.filter((d) => d.kind === 'LATE' || d.kind === 'ABSENT');
    if (p.redemption.order === 'HIGHEST_DEDUCTION_FIRST') bad.sort((a, b) => b.deduction - a.deduction || a.date.localeCompare(b.date));
    else if (p.redemption.order === 'LATEST_FIRST') bad.sort((a, b) => b.date.localeCompare(a.date));
    for (const b of bad) {
      if (p.redemption.maxPerMonth !== null && redemptions.length >= p.redemption.maxPerMonth) break;
      const rule = p.redemption.rules.find((r) => r.target === b.status);
      if (!rule) continue;
      const pool = days.filter((g) => g.status === rule.currency && !used.has(g.date) && (p.redemption.policy === 'ANY' || g.date > b.date));
      if (pool.length < rule.cost) continue;
      const take = pool.slice(0, rule.cost).map((g) => g.date);
      take.forEach((t) => used.add(t));
      b.redeemed = true; b.redeemedBy = take;
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

  // Monthly commitment bonus: every working day must be the qualifying tier, except tolerated days per tier
  const finalized = asOf >= to;
  const worked = days.filter((d) => d.kind === 'ON_TIME' || d.kind === 'LATE' || d.kind === 'ABSENT');
  const b = p.bonus;
  const exceeded: BonusExceeded[] = [];
  const tally = new Map<string, number>();
  for (const d of worked) {
    const eff = d.redeemed && b.allowsRedemption ? b.qualifyingTier : d.status;
    if (eff !== b.qualifyingTier) tally.set(eff, (tally.get(eff) ?? 0) + 1);
  }
  for (const [tier, count] of tally) {
    const allowed = b.allowances.find((a) => a.tier === tier)?.days ?? 0;
    if (count > allowed) exceeded.push({ tier, count, allowed });
  }
  const bonusEligible = b.enabled && finalized && worked.length > 0 && exceeded.length === 0;
  const bonus = !bonusEligible ? 0 : b.type === 'FIXED' ? Math.round(b.value) : Math.round((baseSalary * b.value) / 100);

  const counts: Record<string, number> = {};
  for (const d of days) counts[d.status] = (counts[d.status] ?? 0) + 1;
  counts.REDEEMED = redemptions.length;
  return { period: { from, to, days: divisor }, days, counts, redemptions, lateDeductions: late, absentDeductions: absent,
    totalDeductions: late + absent, bonus, bonusEligible, bonusExceeded: exceeded, finalized, netAdjustment: bonus - late - absent };
}

/** Upgrades a stored policy of any earlier shape to the current one (missing fields get defaults). */
export function normalizePolicy(raw: any): AttendancePolicy {
  const p = JSON.parse(JSON.stringify(raw ?? {}));
  const d = DEFAULT_POLICY;
  p.shiftStart ??= d.shiftStart;
  p.tiers = Array.isArray(p.tiers) && p.tiers.length ? p.tiers : d.tiers;
  p.absentTier ??= d.absentTier;
  p.weeklyOffDays ??= d.weeklyOffDays;
  p.payrollStartDay ??= d.payrollStartDay;
  delete p.salaryDivisor;
  p.redemption = { ...d.redemption, ...(p.redemption ?? {}) };
  p.bonus = { ...d.bonus, ...(p.bonus ?? {}) };
  delete p.bonus.maxBadDays;
  p.bonus.allowances ??= [];
  if (!p.tiers.some((t: Tier) => t.key === p.bonus.qualifyingTier)) p.bonus.qualifyingTier = (p.tiers.find((t: Tier) => t.kind === 'ON_TIME') ?? p.tiers[0]).key;
  return p as AttendancePolicy;
}

/** The tier a local check-in time falls into, or undefined when it is later than the last band (=> absent). */
export function tierForMinutes(p: AttendancePolicy, minutes: number): Tier | undefined {
  return p.tiers.find((t) => minutes <= hhmmToMinutes(t.until!));
}
