import { describe, it, expect } from 'vitest';
import { calculateMonth, validatePolicy, DEFAULT_POLICY, AttendancePolicy, MonthInput, DeductionRule } from './engine';
import { toLocalParts } from './time';

// March 2026 as a calendar month (payrollStartDay=1): starts Sunday, Fri/Sat off => 23 working days. Salary 310000 => daily rate 10000.
const OFF = new Set([6, 7, 13, 14, 20, 21, 27, 28]);
const d = (n: number) => `2026-03-${String(n).padStart(2, '0')}`;
const G = 595, R = 650;
const BASE: AttendancePolicy = { ...DEFAULT_POLICY, payrollStartDay: 1 };
const allGreen = (skip: number[] = []) =>
  Array.from({ length: 31 }, (_, i) => i + 1).filter((n) => !OFF.has(n) && !skip.includes(n)).map((n) => ({ date: d(n), checkInMinutes: G }));
const run = (o: Partial<MonthInput> & { p?: Partial<AttendancePolicy> } = {}) => {
  const { p, ...rest } = o;
  return calculateMonth({ year: 2026, month: 3, baseSalary: 310000, records: allGreen(), policy: { ...BASE, ...p }, ...rest });
};
const st = (r: ReturnType<typeof run>, n: number) => r.days[n - 1].status;
const redDeduction = (x: DeductionRule) => BASE.tiers.map((t) => (t.key === 'RED' ? { ...t, deduction: x } : t));
const bonus = (x: Partial<AttendancePolicy['bonus']>) => ({ ...BASE.bonus, ...x });
const redem = (x: Partial<AttendancePolicy['redemption']>) => ({ ...BASE.redemption, ...x });

describe('classification & boundaries', () => {
  const one = (m: number) => run({ records: [{ date: d(1), checkInMinutes: m }], asOfDate: d(1) });
  it('10:15 GREEN', () => expect(st(one(615), 1)).toBe('GREEN'));
  it('10:16 RED', () => expect(st(one(616), 1)).toBe('RED'));
  it('12:00 RED', () => expect(st(one(720), 1)).toBe('RED'));
  it('12:01 BLACK', () => expect(st(one(721), 1)).toBe('BLACK'));
  it('arriving before the shift is on time', () => expect(st(one(500), 1)).toBe('GREEN'));
  it('no record BLACK', () => expect(st(run({ records: [], asOfDate: d(1) }), 1)).toBe('BLACK'));
  it('future ignored', () => expect(st(one(595), 2)).toBe('FUTURE'));
});

describe('neutral days', () => {
  it('weekend stays WEEKEND even with a record', () => expect(st(run({ records: [{ date: d(6), checkInMinutes: G }], asOfDate: d(6) }), 6)).toBe('WEEKEND'));
  it('holiday & leave are not absences', () => {
    const r = run({ records: [], holidays: [d(1)], leaveDays: [d(2)], asOfDate: d(2) });
    expect([st(r, 1), st(r, 2)]).toEqual(['HOLIDAY', 'ON_LEAVE']);
    expect(r.totalDeductions).toBe(0);
  });
  it('HR excuse neutralizes', () => {
    const r = run({ records: allGreen([1]), excusedDays: [d(1)] });
    expect(st(r, 1)).toBe('EXCUSED');
    expect(r.totalDeductions).toBe(0);
  });
});

describe('deductions', () => {
  const rec = (m: number) => [{ date: d(1), checkInMinutes: m }];
  it('FIXED', () => expect(run({ records: rec(R), asOfDate: d(1) }).lateDeductions).toBe(5000));
  it('PER_MINUTE from shift start', () => expect(run({ records: rec(630), asOfDate: d(1), p: { tiers: redDeduction({ type: 'PER_MINUTE', value: 100 }) } }).lateDeductions).toBe(3000));
  it('PERCENT_OF_SALARY', () => expect(run({ records: rec(R), asOfDate: d(1), p: { tiers: redDeduction({ type: 'PERCENT_OF_SALARY', value: 1 }) } }).lateDeductions).toBe(3100));
  it('absence = one daily salary (310000/31 days)', () => expect(run({ records: [], asOfDate: d(1) }).absentDeductions).toBe(10000));
  it('per-day deduction is exposed for the employee report', () => expect(run({ records: rec(R), asOfDate: d(1) }).days[0].deduction).toBe(5000));
});

describe('payroll period starting on the 25th', () => {
  const r = calculateMonth({ year: 2026, month: 3, baseSalary: 280000, policy: { ...DEFAULT_POLICY, payrollStartDay: 25 }, records: [], asOfDate: '2026-02-25' });
  it('runs Feb 25 -> Mar 24', () => expect(r.period).toEqual({ from: '2026-02-25', to: '2026-03-24', days: 28 }));
  it('daily rate follows the real period length (280000/28 = 10000)', () => expect(r.days[0]).toMatchObject({ date: '2026-02-25', status: 'BLACK', deduction: 10000 }));
  it('January starts on Dec 25 of the previous year', () =>
    expect(calculateMonth({ year: 2026, month: 1, baseSalary: 1, policy: DEFAULT_POLICY, records: [] }).period.from).toBe('2025-12-25'));
  it('not finalized until the period ends', () => expect(r.finalized).toBe(false));
});

describe('dynamic tiers', () => {
  const four: AttendancePolicy = { ...BASE, tiers: [
    { key: 'GREEN', label: 'g', color: '#22c55e', kind: 'ON_TIME', until: '10:15' },
    { key: 'YELLOW', label: 'y', color: '#eab308', kind: 'LATE', until: '10:30', deduction: { type: 'FIXED', value: 2000 } },
    { key: 'RED', label: 'r', color: '#ef4444', kind: 'LATE', until: '12:00', deduction: { type: 'FIXED', value: 5000 } },
  ], redemption: redem({ rules: [{ target: 'YELLOW', currency: 'GREEN', cost: 2 }, { target: 'RED', currency: 'GREEN', cost: 1 }] }) };
  const mk = (extra: number[]) => calculateMonth({ year: 2026, month: 3, baseSalary: 310000, policy: four, asOfDate: d(8),
    records: [{ date: d(1), checkInMinutes: 620 }, ...extra.map((x) => ({ date: d(x), checkInMinutes: G }))] });
  it('4 tiers classify', () => {
    const r = calculateMonth({ year: 2026, month: 3, baseSalary: 310000, policy: four, asOfDate: d(2), records: [{ date: d(1), checkInMinutes: 620 }, { date: d(2), checkInMinutes: 700 }] });
    expect([r.days[0].status, r.days[1].status]).toEqual(['YELLOW', 'RED']);
    expect(r.lateDeductions).toBe(7000);
  });
  it('custom cost: yellow needs 2 later green days', () => { expect(mk([2]).counts.REDEEMED).toBe(0); expect(mk([2, 3]).counts.REDEEMED).toBe(1); });
});

describe('redemption: each on-time day cancels ONE earlier bad day', () => {
  // 3 late days (Mar 1,2,3) then two on-time days (Mar 4,5)
  const scenario = [1, 2, 3].map((n) => ({ date: d(n), checkInMinutes: R })).concat([4, 5].map((n) => ({ date: d(n), checkInMinutes: G })));
  const redeemedDays = (r: ReturnType<typeof run>) => r.days.filter((x) => x.redeemed).map((x) => x.date);
  it('LATEST_FIRST (yesterday first)', () => {
    const r = run({ records: scenario, asOfDate: d(5) });
    expect(redeemedDays(r)).toEqual([d(2), d(3)]);
    expect(r.lateDeductions).toBe(5000);
  });
  it('CHRONOLOGICAL (oldest first)', () => {
    const r = run({ records: scenario, asOfDate: d(5), p: { redemption: redem({ order: 'CHRONOLOGICAL' }) } });
    expect(redeemedDays(r)).toEqual([d(1), d(2)]);
  });
  it('a day that redeems is not counted twice (2 greens cannot cancel 3 days)', () => expect(run({ records: scenario, asOfDate: d(5) }).counts.REDEEMED).toBe(2));
  it('the redeeming day is recorded on the bad day', () => expect(run({ records: scenario, asOfDate: d(5) }).days[2].redeemedBy).toEqual([d(4)]));
  it('AFTER_ONLY vs ANY', () => {
    const recs = allGreen([31]).concat({ date: d(31), checkInMinutes: R });
    expect(run({ records: recs }).lateDeductions).toBe(5000);
    expect(run({ records: recs, p: { redemption: redem({ policy: 'ANY' }) } }).lateDeductions).toBe(0);
  });
  it('BLACK needs 5 on-time days', () => {
    const mk = (days: number[], asOf: number) => run({ records: days.map((n) => ({ date: d(n), checkInMinutes: G })), asOfDate: d(asOf) });
    expect(mk([2, 3, 4, 5], 5).counts.REDEEMED).toBe(0);
    expect(mk([2, 3, 4, 5, 8], 8).absentDeductions).toBe(0);
  });
  const scarce = [3, 4, 5, 8, 9].map((n) => ({ date: d(n), checkInMinutes: G })).concat({ date: d(1), checkInMinutes: R });
  it('HIGHEST_DEDUCTION_FIRST prefers cancelling the absence', () => {
    const r = run({ records: scarce, asOfDate: d(9), p: { redemption: redem({ order: 'HIGHEST_DEDUCTION_FIRST' }) } });
    expect([r.lateDeductions, r.absentDeductions]).toEqual([5000, 0]);
  });
  it('maxPerMonth caps redemptions', () => {
    const recs = [{ date: d(1), checkInMinutes: R }, { date: d(2), checkInMinutes: R }, ...[3, 4, 5].map((n) => ({ date: d(n), checkInMinutes: G }))];
    expect(run({ records: recs, asOfDate: d(5), p: { redemption: redem({ maxPerMonth: 1 }) } }).counts.REDEEMED).toBe(1);
  });
  it('disabled redemption', () => {
    const recs = allGreen([1]).concat({ date: d(1), checkInMinutes: R });
    expect(run({ records: recs, p: { redemption: redem({ enabled: false }) } }).lateDeductions).toBe(5000);
  });
});

describe('commitment bonus: qualifying tier + tolerated days', () => {
  const lastThreeLate = allGreen([29, 30, 31]).concat([29, 30, 31].map((n) => ({ date: d(n), checkInMinutes: R })));
  it('perfect month => bonus', () => expect(run().netAdjustment).toBe(5000));
  it('not before the period ends', () => expect(run({ asOfDate: d(15) }).bonusEligible).toBe(false));
  it('3 late days with a 3-day allowance => still earns the bonus', () =>
    expect(run({ records: lastThreeLate, p: { bonus: bonus({ allowances: [{ tier: 'RED', days: 3 }] }) } }).bonus).toBe(5000));
  it('exceeding the allowance blocks it and says why', () => {
    const r = run({ records: lastThreeLate, p: { bonus: bonus({ allowances: [{ tier: 'RED', days: 2 }] }) } });
    expect(r.bonus).toBe(0);
    expect(r.bonusExceeded).toEqual([{ tier: 'RED', count: 3, allowed: 2 }]);
  });
  it('no allowance => one late day blocks the bonus', () => expect(run({ records: allGreen([31]).concat({ date: d(31), checkInMinutes: R }) }).bonus).toBe(0));
  it('a redeemed day blocks it unless redemption is allowed', () => {
    const recs = allGreen([1]).concat({ date: d(1), checkInMinutes: R });
    expect(run({ records: recs }).bonus).toBe(0);
    expect(run({ records: recs, p: { bonus: bonus({ allowsRedemption: true }) } }).bonus).toBe(5000);
  });
  it('percent & disabled', () => {
    expect(run({ p: { bonus: bonus({ type: 'PERCENT', value: 10 }) } }).bonus).toBe(31000);
    expect(run({ p: { bonus: bonus({ enabled: false }) } }).bonus).toBe(0);
  });
});

describe('validatePolicy (HR input safety)', () => {
  const clone = () => JSON.parse(JSON.stringify(DEFAULT_POLICY)) as AttendancePolicy;
  it('default is valid', () => expect(validatePolicy(DEFAULT_POLICY)).toEqual([]));
  it('rejects bad time', () => { const p = clone(); p.shiftStart = '25:00'; expect(validatePolicy(p).length).toBeGreaterThan(0); });
  it('first tier cannot end at/before the shift start', () => { const p = clone(); p.tiers[0].until = '10:00'; expect(validatePolicy(p).join()).toMatch(/shift start/); });
  it('rejects overlapping / unsorted tiers', () => { const p = clone(); p.tiers[1].until = '10:10'; expect(validatePolicy(p).join()).toMatch(/later than/); });
  it('rejects more than 5 tiers', () => {
    const p = clone(); p.tiers = ['10:10', '10:20', '10:30', '10:40', '10:50', '11:00'].map((u, i) => ({ key: `T${i}`, label: 'x', color: '#112233', kind: 'ON_TIME' as const, until: u }));
    p.bonus.qualifyingTier = 'T0'; p.redemption.rules = [];
    expect(validatePolicy(p).join()).toMatch(/at most 5/);
  });
  it('rejects duplicate keys', () => { const p = clone(); p.tiers[1].key = 'GREEN'; expect(validatePolicy(p).join()).toMatch(/duplicate key/); });
  it('rejects empty tier name', () => { const p = clone(); p.tiers[0].label = ' '; expect(validatePolicy(p).join()).toMatch(/name required/); });
  it('rejects unknown redemption currency', () => { const p = clone(); p.redemption.rules[0].currency = 'PINK'; expect(validatePolicy(p).join()).toMatch(/currency/); });
  it('rejects bad color & cost', () => { const p = clone(); p.tiers[0].color = 'green'; p.redemption.rules[1].cost = 0; expect(validatePolicy(p).length).toBe(2); });
  it('bonus: unknown qualifying tier / allowance on the qualifying tier', () => {
    const p = clone(); p.bonus.qualifyingTier = 'NOPE'; expect(validatePolicy(p).join()).toMatch(/qualifyingTier/);
    const q = clone(); q.bonus.allowances = [{ tier: 'GREEN', days: 1 }]; expect(validatePolicy(q).join()).toMatch(/same as the qualifying/);
  });
  it('payroll start day must be 1-28', () => { const p = clone(); p.payrollStartDay = 31; expect(validatePolicy(p).join()).toMatch(/payrollStartDay/); });
});

describe('timezone', () => {
  it('UTC -> Riyadh', () => expect(toLocalParts(new Date('2026-03-01T06:59:00Z'))).toEqual({ date: '2026-03-01', minutes: 599 }));
  it('crosses midnight', () => expect(toLocalParts(new Date('2026-03-01T21:30:00Z'))).toEqual({ date: '2026-03-02', minutes: 30 }));
});
