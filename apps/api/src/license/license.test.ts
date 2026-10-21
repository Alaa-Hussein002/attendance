import { describe, expect, it } from 'vitest';
import { LicensePayload, planPayload } from '@attendance/shared';
import { generateKeyPair, parsePublicKey, signLicense, verifyLicense } from './license';

const keys = generateKeyPair(); const other = generateKeyPair();
const payload = (o: Partial<LicensePayload> = {}): LicensePayload => ({ v: 1, id: 'L1', customer: { id: 'C1', name: 'بيت المصور' }, plan: 'BUSINESS', ...planPayload('BUSINESS'), issuedAt: '2026-10-01', validUntil: '2027-10-01', graceDays: 14, ...o });

describe('licence keys', () => {
  it('a signed key verifies and returns its payload', () => { const v = verifyLicense(signLicense(payload(), keys.privatePem), keys.publicPem); expect(v.ok).toBe(true); if (v.ok) expect(v.payload.customer.name).toBe('بيت المصور'); });
  it('a key signed by someone else is rejected', () => expect(verifyLicense(signLicense(payload(), other.privatePem), keys.publicPem)).toEqual({ ok: false, reason: 'SIGNATURE' }));
  it('editing the payload (e.g. more employees, later expiry) breaks the signature', () => {
    const [a, body, sig] = signLicense(payload(), keys.privatePem).split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload(), validUntil: '2099-01-01', limits: { employees: 99999, branches: 99 } })).toString('base64url');
    expect(verifyLicense(`${a}.${forged}.${sig}`, keys.publicPem)).toEqual({ ok: false, reason: 'SIGNATURE' }); expect(body).not.toBe(forged);
  });
  it('garbage / wrong prefix', () => { expect(verifyLicense('hello', keys.publicPem)).toEqual({ ok: false, reason: 'FORMAT' }); expect(verifyLicense('X.a.b', keys.publicPem)).toEqual({ ok: false, reason: 'FORMAT' }); });
  it('without a configured public key nothing verifies', () => expect(verifyLicense(signLicense(payload(), keys.privatePem), null)).toEqual({ ok: false, reason: 'NO_PUBLIC_KEY' }));
  it('a validly signed but malformed payload is rejected', () => expect(verifyLicense(signLicense({ ...payload(), validUntil: 'soon' } as any, keys.privatePem), keys.publicPem)).toEqual({ ok: false, reason: 'PAYLOAD' }));
  it('public key may be given as PEM, escaped PEM, or base64 of the PEM', () => {
    const k = signLicense(payload(), keys.privatePem);
    for (const form of [keys.publicPem, keys.publicPem.replace(/\n/g, '\\n'), Buffer.from(keys.publicPem).toString('base64')]) expect(verifyLicense(k, parsePublicKey(form)).ok).toBe(true);
  });
});
