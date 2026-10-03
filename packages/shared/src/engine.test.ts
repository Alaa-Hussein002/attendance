import { describe, it, expect } from 'vitest';
import { calculateMonth, validatePolicy, DEFAULT_POLICY, AttendancePolicy, MonthInput, DeductionRule } from './engine';
import { toLocalParts } from './time';

// March 2026: starts Sunday, Fri/Sat off => 23 working days
const OFF = new Set([6, 7, 13, 14, 20, 21, 27, 28]);
const d = (n: number) => `2026-03-${String(n).padStart(2, '0')}`;
const G = 595, R = 650;
const allGreen = (skip: number[] = []) =>
  Array.from({ length: 31 }, (_, i) => i + 1).filter((n) => !OFF.has(n) && !skip.includes(n))
    .map((n) => ({ date: d(n), checkInMinutes: G }));
const run = (o: Partial<MonthInput> & { p?: Partial<AttendancePolicy> } = {}) => {
  const { p, ...rest } = o;
  return calculateMonth({ year: 2026, month: 3, baseSalary: 300000, records: allGreen(),
    policy: { ...DEFAULT_POLICY, ...p }, ...rest });
};
const st = (r: ReturnType<typeof run>, n: number) => r.days[n - 1].status;
const redDeduction = (x: DeductionRule) =>
  DEFAULT_POLICY.tiers.map((t) => (t.key === 'RED' ? { ...t, deduction: x } : t));

describe('classification & boundaries', () => {
  const one = (m: number) => run({ records: [{ date: d(1), checkInMinutes: m }], asOfDate: d(1) });
  it('10:15 GREEN', () => expect(st(one(615), 1)).toBe('GREEN'));
  it('10:16 RED', () => expect(st(one(616), 1)).toBe('RED'));
  it('12:00 RED', () => expect(st(one(720), 1)).toBe('RED'));
  it('12:01 BLACK', () => expect(st(one(721), 1)).toBe('BLACK'));
  it('no record BLACK', () => expect(st(run({ records: [], asOfDate: d(1) }), 1)).toBe('BLACK'));
  it('future ignored', () => expect(st(one(595), 2)).toBe('FUTURE'));
});

describe('neutral days', () => {
  it('weekend stays WEEKEND even with a record', () =>
    expect(st(run({ records: [{ date: d(6), checkInMinutes: G }], asOfDate: d(6) }), 6)).toBe('WEEKEND'));
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

describe('deduction types (HR-selectable)', () => {
  const rec = (m: number) => [{ date: d(1), checkInMinutes: m }];
  it('FIXED', () => expect(run({ records: rec(R), asOfDate: d(1) }).lateDeductions).toBe(5000));
  it('PER_MINUTE from shift start', () =>
    expect(run({ records: rec(630), asOfDate: d(1), p: { tiers: redDeduction({ type: 'PER_MINUTE', value: 100 }) } }).lateDeductions).toBe(3000));
  it('PERCENT_OF_SALARY', () =>
    expect(run({ records: rec(R), asOfDate: d(1), p: { tiers: redDeduction({ type: 'PERCENT_OF_SALARY', value: 1 }) } }).lateDeductions).toBe(3000));
  it('absence = 1 daily salary', () => expect(run({ records: [], asOfDate: d(1) }).absentDeductions).toBe(10000));
});

describe('dynamic tiers', () => {
  const four: AttendancePolicy = { ...DEFAULT_POLICY, tiers: [
    { key: 'GREEN', label: 'g', color: '#22c55e', kind: 'ON_TIME', until: '10:15' },
    { key: 'YELLOW', label: 'y', color: '#eab308', kind: 'LATE', until: '10:30', deduction: { type: 'FIXED', value: 2000 } },
    { key: 'RED', label: 'r', color: '#ef4444', kind: 'LATE', until: '12:00', deduction: { type: 'FIXED', value: 5000 } },
  ], redemption: { ...DEFAULT_POLICY.redemption, rules: [
    { target: 'YELLOW', currency: 'GREEN', cost: 2 }, { target: 'RED', currency: 'GREEN', cost: 1 }] } };
  it('4 tiers classify', () => {
    const r = calculateMonth({ year: 2026, month: 3, baseSalary: 300000, policy: four, asOfDate: d(2),
      records: [{ date: d(1), checkInMinutes: 620 }, { date: d(2), checkInMinutes: 700 }] });
    expect([st(r as any, 1), st(r as any, 2)]).toEqual(['YELLOW', 'RED']);
    expect(r.lateDeductions).toBe(7000);
  });
  it('custom cost: yellow needs 2 greens', () => {
    const mk = (n: number) => calculateMonth({ year: 2026, month: 3, baseSalary: 300000, policy: four, asOfDate: d(8),
      records: [{ date: d(1), checkInMinutes: 620 }, ...[2, 3, 4, 5, 8].slice(0, n).map((x) => ({ date: d(x), checkInMinutes: G }))] });
    expect(mk(1).counts.REDEEMED).toBe(0);
    expect(mk(2).counts.REDEEMED).toBe(1);
  });
});

describe('redemption', () => {
  it('green after RED cancels it', () => {
    const r = run({ records: allGreen([1]).concat({ date: d(1), checkInMinutes: R }) });
    expect(r.redemptions).toHaveLength(1);
    expect(r.lateDeductions).toBe(0);
  });
  it('AFTER_ONLY vs ANY', () => {
    const recs = allGreen([31]).concat({ date: d(31), checkInMinutes: R });
    expect(run({ records: recs }).lateDeductions).toBe(5000);
    expect(run({ records: recs, p: { redemption: { ...DEFAULT_POLICY.redemption, policy: 'ANY' } } }).lateDeductions).toBe(0);
  });
  it('a green is consumed once', () => {
    const recs = [{ date: d(1), checkInMinutes: R }, { date: d(2), checkInMinutes: R }, { date: d(3), checkInMinutes: G }];
    expect(run({ records: recs, asOfDate: d(3) }).counts.REDEEMED).toBe(1);
  });
  it('BLACK needs 5 greens', () => {
    const mk = (days: number[], asOf: number) => run({ records: days.map((n) => ({ date: d(n), checkInMinutes: G })), asOfDate: d(asOf) });
    expect(mk([2, 3, 4, 5], 5).counts.REDEEMED).toBe(0);
    expect(mk([2, 3, 4, 5, 8], 8).absentDeductions).toBe(0);
  });
  const scarce = [3, 4, 5, 8, 9].map((n) => ({ date: d(n), checkInMinutes: G }))
    .concat({ date: d(1), checkInMinutes: R });
  it('order CHRONOLOGICAL: red first, black left unredeemed', () => {
    const r = run({ records: scarce, asOfDate: d(9) });
    expect([r.lateDeductions, r.absentDeductions]).toEqual([0, 10000]);
  });
  it('order HIGHEST_DEDUCTION_FIRST: black redeemed instead', () => {
    const r = run({ records: scarce, asOfDate: d(9), p: { redemption: { ...DEFAULT_POLICY.redemption, order: 'HIGHEST_DEDUCTION_FIRST' } } });
    expect([r.lateDeductions, r.absentDeductions]).toEqual([5000, 0]);
  });
  it('maxPerMonth caps redemptions', () => {
    const recs = [{ date: d(1), checkInMinutes: R }, { date: d(2), checkInMinutes: R }, ...[3, 4, 5].map((n) => ({ date: d(n), checkInMinutes: G }))];
    const r = run({ records: recs, asOfDate: d(5), p: { redemption: { ...DEFAULT_POLICY.redemption, maxPerMonth: 1 } } });
    expect(r.counts.REDEEMED).toBe(1);
  });
  it('disabled redemption', () => {
    const recs = allGreen([1]).concat({ date: d(1), checkInMinutes: R });
    expect(run({ records: recs, p: { redemption: { ...DEFAULT_POLICY.redemption, enabled: false } } }).lateDeductions).toBe(5000);
  });
});

describe('bonus', () => {
  const red1 = allGreen([1]).concat({ date: d(1), checkInMinutes: R });
  it('perfect month', () => expect(run().netAdjustment).toBe(30000));
  it('not before month end', () => expect(run({ asOfDate: d(15) }).bonusEligible).toBe(false));
  it('redeemed day blocks bonus unless allowed', () => {
    expect(run({ records: red1 }).bonus).toBe(0);
    expect(run({ records: red1, p: { bonus: { ...DEFAULT_POLICY.bonus, allowsRedemption: true } } }).bonus).toBe(30000);
  });
  it('maxBadDays tolerance', () =>
    expect(run({ records: allGreen([31]).concat({ date: d(31), checkInMinutes: R }), p: { bonus: { ...DEFAULT_POLICY.bonus, maxBadDays: 1 } } }).bonus).toBe(30000));
  it('percent & disabled', () => {
    expect(run({ p: { bonus: { ...DEFAULT_POLICY.bonus, type: 'PERCENT', value: 10 } } }).bonus).toBe(30000);
    expect(run({ p: { bonus: { ...DEFAULT_POLICY.bonus, enabled: false } } }).bonus).toBe(0);
  });
});

describe('validatePolicy (HR input safety)', () => {
  const clone = () => JSON.parse(JSON.stringify(DEFAULT_POLICY)) as AttendancePolicy;
  it('default is valid', () => expect(validatePolicy(DEFAULT_POLICY)).toEqual([]));
  it('rejects bad time', () => { const p = clone(); p.shiftStart = '25:00'; expect(validatePolicy(p).length).toBeGreaterThan(0); });
  it('rejects unsorted tiers', () => { const p = clone(); p.tiers[0].until = '13:00'; expect(validatePolicy(p).join()).toMatch(/later than previous/); });
  it('rejects duplicate keys', () => { const p = clone(); p.tiers[1].key = 'GREEN'; expect(validatePolicy(p).join()).toMatch(/duplicate key/); });
  it('rejects unknown currency', () => { const p = clone(); p.redemption.rules[0].currency = 'PINK'; expect(validatePolicy(p).join()).toMatch(/currency/); });
  it('rejects bad color & cost', () => {
    const p = clone(); p.tiers[0].color = 'green'; p.redemption.rules[1].cost = 0;
    expect(validatePolicy(p).length).toBe(2);
  });
});

describe('timezone', () => {
  it('UTC -> Riyadh', () => expect(toLocalParts(new Date('2026-03-01T06:59:00Z'))).toEqual({ date: '2026-03-01', minutes: 599 }));
  it('crosses midnight', () => expect(toLocalParts(new Date('2026-03-01T21:30:00Z'))).toEqual({ date: '2026-03-02', minutes: 30 }));
});
