import { AttendancePolicy, DeductionRule, MAX_TIERS, Tier } from '@attendance/shared';

export const toMin = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
export const fromMin = (n: number) => { const c = Math.max(0, Math.min(1439, n)); return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`; };
export const PALETTE = ['#22a559', '#f0b429', '#e65a2e', '#c8321c', '#2f6fed', '#8e44ad'];
export const newKey = () => 'T' + Math.random().toString(36).slice(2, 7).toUpperCase();
export { MAX_TIERS };

/** Labels are dictionary keys; the screen resolves them with t(). */
export const DED: Record<DeductionRule['type'], { label: string; unit: string; money: boolean }> = {
  FIXED: { label: 'w.ded.FIXED', unit: 'w.tiers.unit.FIXED', money: true },
  PER_MINUTE: { label: 'w.ded.PER_MINUTE', unit: 'w.tiers.unit.PER_MINUTE', money: true },
  SALARY_FRACTION: { label: 'w.ded.SALARY_FRACTION', unit: 'w.tiers.unit.SALARY_FRACTION', money: false },
  PERCENT_OF_SALARY: { label: 'w.ded.PERCENT_OF_SALARY', unit: 'w.tiers.unit.PERCENT_OF_SALARY', money: false },
};
// money is stored in halalas, HR sees riyals
export const showVal = (r: DeductionRule) => (DED[r.type].money ? r.value / 100 : r.value);
export const storeVal = (type: DeductionRule['type'], v: number) => (DED[type].money ? Math.round(v * 100) : v);
/** "Example on a 3000 SAR salary, 30-day period, 30 minutes late" for the deduction hint. */
export function example(r: DeductionRule) {
  const sal = 3000; const v = r.type === 'FIXED' ? r.value / 100 : r.type === 'PER_MINUTE' ? (r.value / 100) * 30 : r.type === 'SALARY_FRACTION' ? (r.value * sal) / 30 : (sal * r.value) / 100;
  return v.toFixed(2);
}

/** Repairs every reference (redemption rules, bonus tiers) after a tier changes or disappears. */
export function sanitize(p: AttendancePolicy): AttendancePolicy {
  const all = [...p.tiers, p.absentTier]; const kind = (k: string) => all.find((t) => t.key === k)?.kind;
  const rules = p.redemption.rules.filter((r) => kind(r.target) && kind(r.target) !== 'ON_TIME' && kind(r.currency) === 'ON_TIME');
  const q = p.tiers.some((t) => t.key === p.bonus.qualifyingTier) ? p.bonus.qualifyingTier : (p.tiers.find((t) => t.kind === 'ON_TIME') ?? p.tiers[0])?.key ?? '';
  const allowances = p.bonus.allowances.filter((a) => all.some((t) => t.key === a.tier) && a.tier !== q);
  return { ...p, redemption: { ...p.redemption, rules }, bonus: { ...p.bonus, qualifyingTier: q, allowances } };
}

/** Per-tier problem shown right under the field (the same rules the server enforces). Returns an i18n key. */
export function tierIssue(p: AttendancePolicy, i: number): string | null {
  const tier = p.tiers[i];
  if (!tier.label.trim()) return 'w.tiers.nameRequired';
  if (!tier.until) return 'w.tiers.untilRequired';
  const from = i === 0 ? p.shiftStart : p.tiers[i - 1].until!;
  if (toMin(tier.until) <= toMin(from)) return i === 0 ? 'w.tiers.untilAfterStart' : 'w.tiers.untilAfterPrev';
  return null;
}
export const tierFrom = (p: AttendancePolicy, i: number) => (i === 0 ? p.shiftStart : p.tiers[i - 1].until!);
export const byKey = (p: AttendancePolicy, k: string): Tier | undefined => [...p.tiers, p.absentTier].find((t) => t.key === k);
