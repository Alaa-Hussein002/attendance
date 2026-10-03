import { hhmmToMinutes, AttendancePolicy, MonthResult, prevDay } from '@attendance/shared';

export interface PayrollRow {
  userId: string; name: string; baseSalaryMinor: number;
  onTimeDays: number; lateDays: number; absentDays: number; redeemedDays: number;
  lateDeductionsMinor: number; absentDeductionsMinor: number; bonusMinor: number; netSalaryMinor: number;
}

export function summarize(userId: string, name: string, baseSalaryMinor: number, r: MonthResult): PayrollRow {
  const n = (k: string) => r.days.filter((d) => d.kind === k).length;
  return { userId, name, baseSalaryMinor, onTimeDays: n('ON_TIME'), lateDays: n('LATE'), absentDays: n('ABSENT'), redeemedDays: r.redemptions.length,
    lateDeductionsMinor: r.lateDeductions, absentDeductionsMinor: r.absentDeductions, bonusMinor: r.bonus,
    netSalaryMinor: baseSalaryMinor - r.totalDeductions + r.bonus };
}

export const lastTierMinutes = (p: AttendancePolicy) => Math.max(...p.tiers.map((t) => hhmmToMinutes(t.until!)));

/**
 * Until which date a month may be judged. Today only counts once the employee has checked in, or the last
 * check-in window has closed; otherwise an employee who has not arrived yet would show as ABSENT at 9am.
 */
export function effectiveAsOf(now: { date: string; minutes: number }, policy: AttendancePolicy, hasRecordToday: boolean): string {
  return hasRecordToday || now.minutes > lastTierMinutes(policy) ? now.date : prevDay(now.date);
}

const fmt = (m: number) => (m / 100).toFixed(2);
/** Neutralize spreadsheet formula injection (=, +, -, @) and quote CSV specials. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: PayrollRow[]): string {
  const head = ['الموظف', 'الراتب الأساسي', 'أيام في الوقت', 'أيام التأخر', 'أيام الغياب', 'أيام معوَّضة', 'خصم التأخير', 'خصم الغياب', 'المكافأة', 'صافي الراتب'];
  const lines = rows.map((r) => [r.name, fmt(r.baseSalaryMinor), r.onTimeDays, r.lateDays, r.absentDays, r.redeemedDays,
    fmt(r.lateDeductionsMinor), fmt(r.absentDeductionsMinor), fmt(r.bonusMinor), fmt(r.netSalaryMinor)].map(csvCell).join(','));
  return '\uFEFF' + [head.map(csvCell).join(','), ...lines].join('\r\n'); // BOM so Excel reads Arabic correctly
}
