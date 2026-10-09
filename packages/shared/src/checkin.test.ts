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

import { reminderDue, digestDue, taskWindowOpen, TaskSite } from './tasks';
// Task = 14:00-17:00 at a place far from the office (Riyadh time)
const site: TaskSite = { id: 'T1', lat: 24.7136, lng: 46.6753, radiusMeters: 120, startMinutes: 14 * 60, endMinutes: 17 * 60 };
const atTask = (hhmm: string, o: Partial<CheckInRequest> = {}) =>
  decideCheckIn(branch, DEFAULT_POLICY, req({ serverTime: at(hhmm), lat: 24.7137, lng: 46.6754, taskSites: [site], ...o }));

describe('check-in at a task location', () => {
  it('on time for the TASK start => GREEN, source TASK', () => expect(atTask('14:05')).toMatchObject({ allowed: true, source: 'TASK', taskId: 'T1', status: 'GREEN' }));
  it('lateness is measured from the task start (14:30 => RED)', () => expect(atTask('14:30')).toMatchObject({ allowed: true, status: 'RED' }));
  it('may arrive up to an hour early and is still on time', () => expect(atTask('13:15')).toMatchObject({ allowed: true, status: 'GREEN' }));
  it('too early (before the 1h window) is refused', () => expect(atTask('12:30')).toMatchObject({ allowed: false, code: 'NOT_IN_LOCATION' }));
  it('after the task ended is refused', () => expect(atTask('17:30')).toMatchObject({ allowed: false }));
  it('outside the task radius is refused', () => expect(atTask('14:05', { lat: 24.75, lng: 46.7 })).toMatchObject({ allowed: false, code: 'NOT_IN_LOCATION' }));
  it('mock location is refused at a task too', () => expect(atTask('14:05', { mockLocation: true })).toMatchObject({ allowed: false, code: 'MOCK_LOCATION' }));
  it('being at the office wins over a task', () => expect(go({ serverTime: at('10:05'), taskSites: [site] })).toMatchObject({ source: 'GPS' }));
  it('a fingerprint-only branch still allows task check-in', () =>
    expect(atTask('14:05', {}) && decideCheckIn({ ...branch, modes: ['FINGERPRINT'] }, DEFAULT_POLICY, req({ serverTime: at('14:05'), lat: 24.7137, lng: 46.6754, taskSites: [site] }))).toMatchObject({ allowed: true, source: 'TASK' }));
  it('window helper', () => { expect(taskWindowOpen(site, 13 * 60)).toBe(true); expect(taskWindowOpen(site, 12 * 60 + 59)).toBe(false); });
});
describe('reminders', () => {
  const now = new Date('2026-10-06T10:00:00Z');
  it('due within the hour before start', () => expect(reminderDue({ id: 'a', startsAt: new Date('2026-10-06T10:45:00Z') }, now)).toBe(true));
  it('not due yet when more than an hour away', () => expect(reminderDue({ id: 'a', startsAt: new Date('2026-10-06T11:30:00Z') }, now)).toBe(false));
  it('not due after it started', () => expect(reminderDue({ id: 'a', startsAt: new Date('2026-10-06T09:59:00Z') }, now)).toBe(false));
  it('morning digest window 07:00-12:00', () => { expect(digestDue(6 * 60 + 59)).toBe(false); expect(digestDue(7 * 60)).toBe(true); expect(digestDue(11 * 60 + 59)).toBe(true); expect(digestDue(12 * 60)).toBe(false); });
});
