import { describe, expect, it } from 'vitest';
import { calculateMonth, DEFAULT_POLICY, expandDateRange, periodBounds } from '@attendance/shared';
import { generate, mulberry32, PATTERNS, PatternKey } from './demo-lib';

const p = DEFAULT_POLICY; const { from, to } = periodBounds(2026, 10, p.payrollStartDay); const days = expandDateRange(from, to);
const run = (k: PatternKey) => { const g = generate(k, days, p, mulberry32(7)); return { g, r: calculateMonth({ year: 2026, month: 10, baseSalary: 300000, policy: p, records: g.records.map((x) => ({ date: x.date, checkInMinutes: x.minutes })), leaveDays: g.leaveDays, excusedDays: g.excusedDays, activeFrom: g.activeFrom }) }; };

describe('demo patterns produce the outcomes the test plan promises', () => {
  it('PERFECT earns the bonus and pays no deductions', () => { const { r } = run('PERFECT'); expect(r.bonusEligible).toBe(true); expect(r.totalDeductions).toBe(0); });
  it('LATE_REDEEMED: three lates are all cancelled by later on-time days, no deduction, bonus lost (default policy)', () => { const { r } = run('LATE_REDEEMED'); expect(r.counts.REDEEMED).toBe(3); expect(r.totalDeductions).toBe(0); expect(r.bonus).toBe(0); });
  it('LATE_END: nothing later to redeem them => 3 x 50.00 deducted', () => { const { r } = run('LATE_END'); expect(r.lateDeductions).toBe(15000); expect(r.counts.REDEEMED).toBe(0); });
  it('ABSENT_REDEEMED: the absence is cancelled by 5 later days', () => { const { r } = run('ABSENT_REDEEMED'); expect(r.counts.REDEEMED).toBe(1); expect(r.absentDeductions).toBe(0); });
  it('ABSENT_END: one full daily salary is deducted (300000 / 30 days)', () => expect(run('ABSENT_END').r.absentDeductions).toBe(10000));
  it('EXCUSED: the absent day is neutral, still earns the bonus', () => { const { r } = run('EXCUSED'); expect(r.totalDeductions).toBe(0); expect(r.counts.EXCUSED).toBe(1); expect(r.bonusEligible).toBe(true); });
  it('ON_LEAVE: no deductions during approved leave', () => { const { r } = run('ON_LEAVE'); expect(r.counts.ON_LEAVE).toBe(5); expect(r.totalDeductions).toBe(0); });
  it('MIXED_SOURCES uses every attendance method', () => expect(new Set(run('MIXED_SOURCES').g.records.map((x) => x.source)).size).toBe(5));
  it('HEAVY_LATE has many lates', () => expect(run('HEAVY_LATE').r.counts.RED ?? 0).toBeGreaterThan(3));
  it('NEW_HIRE: days before joining are neutral, no absence charged', () => { const { r } = run('NEW_HIRE'); expect(r.counts.INACTIVE).toBeGreaterThan(10); expect(r.totalDeductions).toBe(0); });
  it('every listed pattern is generated deterministically', () => { for (const [k] of PATTERNS) expect(generate(k, days, p, mulberry32(1))).toEqual(generate(k, days, p, mulberry32(1))); });
});
