import { AttendancePolicy, DeductionRule, MAX_TIERS, Tier } from '@attendance/shared';

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = (n: number) => { const c = Math.max(0, Math.min(1439, n)); return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`; };
export const PALETTE = ['#22a559', '#f0b429', '#e65a2e', '#c8321c', '#2f6fed', '#8e44ad'];
export const newKey = () => 'T' + Math.random().toString(36).slice(2, 7).toUpperCase();
export { MAX_TIERS };

export const DED: Record<DeductionRule['type'], { label: string; unit: string; money: boolean }> = {
  FIXED: { label: 'مبلغ ثابت', unit: 'ريال', money: true },
  PER_MINUTE: { label: 'مبلغ عن كل دقيقة تأخير', unit: 'ريال / دقيقة', money: true },
  SALARY_FRACTION: { label: 'جزء من أجر اليوم', unit: '× أجر اليوم (1 = يوم كامل)', money: false },
  PERCENT_OF_SALARY: { label: 'نسبة من الراتب', unit: '% من الراتب', money: false },
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

/** Per-tier problem shown right under the field (the same rules the server enforces). */
export function tierIssue(p: AttendancePolicy, i: number): string | null {
  const t = p.tiers[i];
  if (!t.label.trim()) return 'اسم المرحلة مطلوب';
  if (!t.until) return 'حدد وقت النهاية';
  const from = i === 0 ? p.shiftStart : p.tiers[i - 1].until!;
  if (toMin(t.until) <= toMin(from)) return i === 0 ? 'يجب أن تنتهي المرحلة بعد بداية الدوام' : 'يجب أن تنتهي بعد نهاية المرحلة السابقة (لا تداخل)';
  return null;
}
export const tierFrom = (p: AttendancePolicy, i: number) => (i === 0 ? p.shiftStart : p.tiers[i - 1].until!);
export const byKey = (p: AttendancePolicy, k: string): Tier | undefined => [...p.tiers, p.absentTier].find((t) => t.key === k);
