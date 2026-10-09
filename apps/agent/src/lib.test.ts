import { describe, expect, it } from 'vitest';
import { chunk, daysAgoNaive, newerThan, readConfig, toNaive } from './lib';

describe('agent helpers', () => {
  it('toNaive uses the wall clock (local getters)', () => expect(toNaive(new Date(2026, 9, 6, 9, 5, 7))).toBe('2026-10-06T09:05:07'));
  it('daysAgoNaive is midnight N days back, across months', () => expect(daysAgoNaive(new Date(2026, 2, 3, 15, 0), 5)).toBe('2026-02-26T00:00:00'));
  const rows = [{ deviceUserId: 7, recordTime: new Date(2026, 9, 6, 10, 2) }, { deviceUserId: '7', recordTime: new Date(2026, 9, 6, 8, 55) }, { deviceUserId: 'bad id!', recordTime: new Date(2026, 9, 6, 9, 0) }, { deviceUserId: 9, recordTime: new Date(2026, 9, 5, 9, 0) }];
  it('keeps only new, valid punches, sorted', () => expect(newerThan(rows, '2026-10-06T00:00:00')).toEqual([{ biometricId: '7', time: '2026-10-06T08:55:00' }, { biometricId: '7', time: '2026-10-06T10:02:00' }]));
  it('equal timestamp is kept (server de-duplicates)', () => expect(newerThan(rows, '2026-10-06T08:55:00')).toHaveLength(2));
  it('chunk', () => expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
  it('config: valid', () => expect(readConfig({ API_URL: 'http://x:3000/', DEVICE_KEY: 'bmk_' + 'a'.repeat(30), DEVICE_HOST: '1.2.3.4' })).toMatchObject({ apiUrl: 'http://x:3000', port: 4370, intervalSec: 60 }));
  it('config: rejects a wrong key / missing values / fast interval', () => {
    expect(() => readConfig({ API_URL: 'http://x', DEVICE_KEY: 'nope', DEVICE_HOST: 'h' })).toThrow(/DEVICE_KEY/);
    expect(() => readConfig({ DEVICE_KEY: 'bmk_' + 'a'.repeat(30), DEVICE_HOST: 'h' })).toThrow(/API_URL/);
    expect(() => readConfig({ API_URL: 'http://x', DEVICE_KEY: 'bmk_' + 'a'.repeat(30), DEVICE_HOST: 'h', INTERVAL_SEC: '5' })).toThrow(/INTERVAL/);
  });
});
