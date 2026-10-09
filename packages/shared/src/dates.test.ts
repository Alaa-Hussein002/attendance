import { describe, it, expect } from 'vitest';
import { expandDateRange, prevDay, monthBounds, localToUtc, toLocalParts, periodBounds, periodOf } from './time';
import { isValidIpRange } from './geo';

describe('dates', () => {
  it('expands inclusive ranges', () => expect(expandDateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']));
  it('reversed / invalid => empty', () => { expect(expandDateRange('2026-03-02', '2026-03-01')).toEqual([]); expect(expandDateRange('x', 'y')).toEqual([]); });
  it('caps huge ranges', () => expect(expandDateRange('2000-01-01', '2030-01-01').length).toBe(400));
  it('prevDay crosses month', () => expect(prevDay('2026-03-01')).toBe('2026-02-28'));
  it('monthBounds leap year', () => expect(monthBounds(2028, 2).to).toBe('2028-02-29'));
  it('localToUtc Riyadh 10:00 = 07:00Z', () => expect(localToUtc('2026-03-01', '10:00').toISOString()).toBe('2026-03-01T07:00:00.000Z'));
  it('localToUtc round-trips', () => expect(toLocalParts(localToUtc('2026-06-15', '23:30'))).toEqual({ date: '2026-06-15', minutes: 23 * 60 + 30 }));
  it('localToUtc handles DST zone', () => expect(localToUtc('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z'));
});
describe('ip ranges', () => {
  it('validates', () => {
    expect(isValidIpRange('10.0.0.0/8')).toBe(true);
    expect(isValidIpRange('10.0.0.1')).toBe(true);
    expect(isValidIpRange('10.0.0.0/33')).toBe(false);
    expect(isValidIpRange('300.0.0.1')).toBe(false);
    expect(isValidIpRange('hello')).toBe(false);
  });
});

describe('payroll periods', () => {
  it('startDay 1 = calendar month', () => expect(periodBounds(2026, 3, 1)).toEqual({ from: '2026-03-01', to: '2026-03-31' }));
  it('startDay 25 = 25th -> 24th', () => expect(periodBounds(2026, 3, 25)).toEqual({ from: '2026-02-25', to: '2026-03-24' }));
  it('January wraps to the previous year', () => expect(periodBounds(2026, 1, 25).from).toBe('2025-12-25'));
  it('periodOf: Oct 25 belongs to the November period', () => expect(periodOf('2026-10-25', 25)).toEqual({ year: 2026, month: 11 }));
  it('periodOf: Oct 24 belongs to the October period', () => expect(periodOf('2026-10-24', 25)).toEqual({ year: 2026, month: 10 }));
  it('periodOf: Dec 30 rolls into January of next year', () => expect(periodOf('2026-12-30', 25)).toEqual({ year: 2027, month: 1 }));
});

import { normalizePolicy, validatePolicy } from './engine';
describe('normalizePolicy', () => {
  it('upgrades an old-shaped policy to a valid current one', () => {
    const old: any = { shiftStart: '09:00', tiers: [{ key: 'OK', label: 'ok', color: '#00aa00', kind: 'ON_TIME', until: '09:10' }],
      absentTier: DEFAULT_POLICY.absentTier, weeklyOffDays: [5], salaryDivisor: 30,
      redemption: { enabled: false, rules: [], policy: 'ANY', order: 'CHRONOLOGICAL', maxPerMonth: null },
      bonus: { enabled: true, type: 'FIXED', value: 100, allowsRedemption: false, maxBadDays: 2 } };
    const n = normalizePolicy(old);
    expect(n.bonus.qualifyingTier).toBe('OK');
    expect((n as any).salaryDivisor).toBeUndefined();
    expect(n.payrollStartDay).toBe(25);
    expect(validatePolicy(n)).toEqual([]);
  });
  it('is idempotent on the default policy', () => expect(normalizePolicy(DEFAULT_POLICY)).toEqual(DEFAULT_POLICY));
});

import { fmtDayAr, fmtTime12Ar, nextDay } from './time';
import { tierForMinutes, DEFAULT_POLICY } from './engine';
describe('formatting + tier lookup', () => {
  it('Arabic day', () => expect(fmtDayAr('2026-10-06')).toBe('الثلاثاء 6 أكتوبر'));
  it('12-hour Arabic time', () => { expect(fmtTime12Ar('14:30')).toBe('2:30 م'); expect(fmtTime12Ar(0)).toBe('12:00 ص'); expect(fmtTime12Ar('12:05')).toBe('12:05 م'); });
  it('nextDay crosses month/year', () => { expect(nextDay('2026-12-31')).toBe('2027-01-01'); expect(nextDay('2026-02-28')).toBe('2026-03-01'); });
  it('tierForMinutes', () => { expect(tierForMinutes(DEFAULT_POLICY, 615)?.key).toBe('GREEN'); expect(tierForMinutes(DEFAULT_POLICY, 700)?.key).toBe('RED'); expect(tierForMinutes(DEFAULT_POLICY, 721)).toBeUndefined(); });
});
