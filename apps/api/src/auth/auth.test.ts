import { describe, it, expect, beforeAll } from 'vitest';
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

import { validateNewPassword, DEFAULT_PASSWORD } from './password';
import { renderOtpEmail } from '../common/email-templates';
import { RateLimiter } from '../common/rate-limit';

describe('new password policy', () => {
  it('rejects the shared default and short ones', () => {
    expect(validateNewPassword(DEFAULT_PASSWORD)).toBe('PASSWORD_IS_DEFAULT');
    expect(validateNewPassword('abc12')).toBe('PASSWORD_TOO_SHORT');
  });
  it('needs a letter and a digit', () => {
    expect(validateNewPassword('abcdefgh')).toBe('PASSWORD_NEEDS_LETTER_AND_DIGIT');
    expect(validateNewPassword('87654321')).toBe('PASSWORD_NEEDS_LETTER_AND_DIGIT');
  });
  it('accepts Latin or Arabic letters with digits', () => { expect(validateNewPassword('Mosawer2026')).toBeNull(); expect(validateNewPassword('مصور12345')).toBeNull(); });
  it('rejects non-strings', () => expect(validateNewPassword(undefined)).toBe('PASSWORD_TOO_SHORT'));
});

describe('otp email', () => {
  it('contains the code and brand, and escapes the name', () => {
    const m = renderOtpEmail({ name: '<script>alert(1)</script>', code: '123456', purpose: 'SETUP', minutes: 10 });
    expect(m.subject).toContain('123456');
    expect(m.html).toContain('بيت المصور');
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });
  it('plain-text part has the code too', () => expect(renderOtpEmail({ name: 'Ali', code: '654321', purpose: 'FIRST_LOGIN', minutes: 10 }).text).toContain('654321'));
});

describe('rate limiter', () => {
  it('blocks after max hits inside the window and recovers after it', () => {
    const rl = new RateLimiter(2, 1000);
    expect([rl.allow('a', 0), rl.allow('a', 10), rl.allow('a', 20)]).toEqual([true, true, false]);
    expect(rl.allow('b', 20)).toBe(true);
    expect(rl.allow('a', 1500)).toBe(true);
  });
});

import { renderTaskEmail, mapUrl, taskSummary } from '../notifications/task-email';
import { buildTemplatePayload, decryptSecret, encryptSecret, normalizePhone } from '../notifications/whatsapp';
import { normalizeTime } from '../agent/agent.service';

describe('task email', () => {
  const t = { title: 'تصوير افتتاح <فرع>', date: '2026-10-06', startMinutes: 14 * 60, endMinutes: 17 * 60, address: 'جدة - التحلية', details: 'ثلاثة ريلز\nفيديو طويل', lat: 21.5433, lng: 39.1728 };
  it('has times, a map link, and escapes user text', () => {
    const m = renderTaskEmail({ name: 'علي', headline: 'مهمة جديدة لك', intro: 'x', tasks: [t] });
    expect(m.html).toContain('2:00 م – 5:00 م'); expect(m.html).toContain(mapUrl(21.5433, 39.1728)); expect(m.html).toContain('&lt;فرع&gt;'); expect(m.html).not.toContain('<فرع>');
    expect(m.subject).toContain('بيت المصور');
  });
  it('summary is one line', () => expect(taskSummary(t)).toBe('تصوير افتتاح <فرع> — الثلاثاء 6 أكتوبر 2:00 م – 5:00 م — جدة - التحلية'));
});
describe('whatsapp helpers', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'x'.repeat(40); });
  it('encrypts and decrypts, and never stores plaintext', () => { const e = encryptSecret('EAAG-secret-token'); expect(e).not.toContain('secret'); expect(decryptSecret(e)).toBe('EAAG-secret-token'); });
  it('two encryptions of the same token differ (random IV)', () => expect(encryptSecret('a')).not.toBe(encryptSecret('a')));
  it('tampering is detected', () => { const e = Buffer.from(encryptSecret('abc'), 'base64'); e[e.length - 1] ^= 1; expect(() => decryptSecret(e.toString('base64'))).toThrow(); });
  it('normalizes Saudi numbers', () => { expect(normalizePhone('0501234567')).toBe('966501234567'); expect(normalizePhone('+966 50 123 4567')).toBe('966501234567'); expect(normalizePhone('00966501234567')).toBe('966501234567'); expect(normalizePhone('abc')).toBeNull(); });
  it('template payload', () => { const p: any = buildTemplatePayload({ to: '966501234567', template: 'daily_tasks', language: 'ar', params: ['علي', 'سطر\nثانٍ'] }); expect(p.template.name).toBe('daily_tasks'); expect(p.template.components[0].parameters[1].text).toBe('سطر ثانٍ'); });
});
describe('punch time', () => { it('normalizes to ISO wall clock', () => { expect(normalizeTime('2026-10-06 09:58')).toBe('2026-10-06T09:58:00'); expect(normalizeTime('2026-10-06T09:58:12')).toBe('2026-10-06T09:58:12'); }); });
