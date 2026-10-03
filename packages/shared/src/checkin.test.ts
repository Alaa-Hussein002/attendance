import { describe, it, expect } from 'vitest';
import { haversineMeters, ipInRanges } from './geo';
import { decideCheckIn, BranchConfig, CheckInRequest } from './checkin';
import { DEFAULT_POLICY } from './engine';

// 10:00 Riyadh = 07:00Z
const at = (hhmmRiyadh: string) => new Date(`2026-03-01T${String(Number(hhmmRiyadh.slice(0, 2)) - 3).padStart(2, '0')}:${hhmmRiyadh.slice(3)}:00Z`);
const branch: BranchConfig = { latitude: 21.5433, longitude: 39.1728, radiusMeters: 100, allowedIpRanges: ['203.0.113.0/24'], modes: ['GPS', 'NETWORK'] };
const req = (o: Partial<CheckInRequest> = {}): CheckInRequest =>
  ({ serverTime: at('10:05'), deviceUid: 'dev1', boundDeviceUid: 'dev1', lat: 21.5433, lng: 39.1728, ...o });
const go = (o: Partial<CheckInRequest> = {}, b = branch) => decideCheckIn(b, DEFAULT_POLICY, req(o));

describe('geo', () => {
  it('haversine ~111km per degree latitude', () => expect(Math.round(haversineMeters(0, 0, 1, 0) / 1000)).toBe(111));
  it('same point is 0', () => expect(haversineMeters(21.5, 39.1, 21.5, 39.1)).toBe(0));
  it('CIDR match', () => {
    expect(ipInRanges('203.0.113.77', ['203.0.113.0/24'])).toBe(true);
    expect(ipInRanges('203.0.114.1', ['203.0.113.0/24'])).toBe(false);
    expect(ipInRanges('::ffff:10.0.0.5', ['10.0.0.5'])).toBe(true);
    expect(ipInRanges(undefined, ['10.0.0.0/8'])).toBe(false);
    expect(ipInRanges('garbage', ['10.0.0.0/8'])).toBe(false);
  });
});

describe('decideCheckIn', () => {
  it('GPS inside radius, on time => GREEN', () => expect(go()).toMatchObject({ allowed: true, source: 'GPS', status: 'GREEN' }));
  it('late => RED', () => expect(go({ serverTime: at('11:00') })).toMatchObject({ allowed: true, status: 'RED' }));
  it('after last band => rejected, absent status', () =>
    expect(go({ serverTime: at('12:30') })).toMatchObject({ allowed: false, code: 'TOO_LATE', status: 'BLACK' }));
  it('outside radius => rejected', () => expect(go({ lat: 21.56, lng: 39.19 })).toMatchObject({ allowed: false, code: 'NOT_IN_LOCATION' }));
  it('office network works without GPS', () =>
    expect(go({ ip: '203.0.113.9', lat: undefined, lng: undefined })).toMatchObject({ allowed: true, source: 'NETWORK' }));
  it('network-only branch rejects outside IP', () =>
    expect(go({ ip: '8.8.8.8' }, { ...branch, modes: ['NETWORK'] })).toMatchObject({ allowed: false, code: 'NOT_IN_LOCATION' }));
  it('mock location rejected for GPS and flagged', () => {
    const r = go({ mockLocation: true });
    expect(r).toMatchObject({ allowed: false, code: 'MOCK_LOCATION' });
    expect(r.flags).toContain('MOCK_LOCATION');
  });
  it('other device rejected', () => expect(go({ deviceUid: 'other' })).toMatchObject({ code: 'DEVICE_MISMATCH' }));
  it('unbound device rejected', () => expect(go({ boundDeviceUid: null })).toMatchObject({ code: 'DEVICE_NOT_BOUND' }));
  it('client clock skew flagged but server time used', () => {
    const r = go({ clientTime: at('09:00') });
    expect(r.allowed).toBe(true);
    expect(r.flags).toContain('CLOCK_SKEW');
    expect(r.status).toBe('GREEN');
  });
  it('fingerprint-only branch has no app path', () =>
    expect(go({}, { ...branch, modes: ['FINGERPRINT'] })).toMatchObject({ code: 'NO_VERIFICATION_MODE' }));
});
