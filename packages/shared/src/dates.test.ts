import { describe, it, expect } from 'vitest';
import { expandDateRange, prevDay, monthBounds, localToUtc, toLocalParts } from './time';
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
