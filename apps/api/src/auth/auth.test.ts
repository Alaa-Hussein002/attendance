import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashOtp, generateOtp } from './crypto';
import { evaluateOtp, Challenge, OTP_MAX_ATTEMPTS } from './otp';

const now = new Date('2026-03-01T10:00:00Z');
const ch = (o: Partial<Challenge> = {}): Challenge =>
  ({ id: 'c1', codeHash: hashOtp('c1', '123456'), expiresAt: new Date(now.getTime() + 60000), attempts: 0, consumedAt: null, ...o });

describe('password hashing', () => {
  it('verifies correct, rejects wrong', () => {
    const h = hashPassword('S3cret!pass');
    expect(verifyPassword('S3cret!pass', h)).toBe(true);
    expect(verifyPassword('wrong', h)).toBe(false);
  });
  it('salts: same password => different hashes', () => expect(hashPassword('a')).not.toBe(hashPassword('a')));
  it('malformed stored hash is rejected, not thrown', () => expect(verifyPassword('a', 'garbage')).toBe(false));
});

describe('otp', () => {
  it('generates 6 digits', () => expect(generateOtp()).toMatch(/^\d{6}$/));
  it('accepts the right code', () => expect(evaluateOtp(ch(), '123456', now)).toEqual({ ok: true }));
  it('rejects wrong code and counts the attempt', () =>
    expect(evaluateOtp(ch(), '000000', now)).toMatchObject({ ok: false, reason: 'INVALID_CODE', countAttempt: true }));
  it('rejects expired', () =>
    expect(evaluateOtp(ch({ expiresAt: new Date(now.getTime() - 1) }), '123456', now)).toMatchObject({ reason: 'EXPIRED' }));
  it('rejects reuse', () =>
    expect(evaluateOtp(ch({ consumedAt: now }), '123456', now)).toMatchObject({ reason: 'CONSUMED' }));
  it('locks after max attempts even with the right code', () =>
    expect(evaluateOtp(ch({ attempts: OTP_MAX_ATTEMPTS }), '123456', now)).toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' }));
  it('code is bound to its challenge id', () =>
    expect(evaluateOtp(ch({ id: 'other' }), '123456', now)).toMatchObject({ reason: 'INVALID_CODE' }));
});
