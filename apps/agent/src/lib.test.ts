import { describe, expect, it } from 'vitest';
import { chunk, daysAgoNaive, decodeZkTime, newerThan, readConfig, toNaive } from './lib';

/** Builds the ZKTeco clock word: sec | min | hour | (day-1) | month | year since 2000. */
function zkWord(y: number, mo: number, d: number, h: number, mi: number, s: number) {
  let t = s; t = t + mi * 60; t = t + h * 3600; t = t + (d - 1) * 86400; t = t + mo * 31 * 86400; t = t + (y - 2000) * 12 * 31 * 86400;
  return t;
}

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
  it('config: a garbage FIRST_SYNC_DAYS falls back to 35 (NaN used to silence every punch)', () => {
    const env = { API_URL: 'http://x', DEVICE_KEY: 'bmk_' + 'a'.repeat(30), DEVICE_HOST: 'h' };
    expect(readConfig({ ...env, FIRST_SYNC_DAYS: 'abc' }).firstSyncDays).toBe(35);
    expect(readConfig({ ...env, FIRST_SYNC_DAYS: '0' }).firstSyncDays).toBe(35);
    expect(readConfig({ ...env, FIRST_SYNC_DAYS: '7' }).firstSyncDays).toBe(7);
  });

  describe('decodeZkTime (the device clock, CMD_GET_TIME)', () => {
    it('decodes the packed word at offset 8', () => {
      const buf = Buffer.alloc(20);
      buf.writeUInt32LE(zkWord(2026, 9, 6, 14, 5, 7), 8);
      const d = decodeZkTime(buf)!;
      expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 9, 6, 14, 5, 7]);
    });
    it('rejects a short / empty / zero buffer instead of returning a bogus date', () => {
      expect(decodeZkTime(Buffer.alloc(4))).toBeNull();
      expect(decodeZkTime(Buffer.alloc(20))).toBeNull();
      expect(decodeZkTime(null as any)).toBeNull();
    });
  });
});
