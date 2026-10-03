import { timingSafeEqual } from 'crypto';
import { hashOtp } from './crypto';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;

export interface Challenge { id: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null }
export type OtpResult = { ok: true } | { ok: false; reason: 'CONSUMED' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE'; countAttempt: boolean };

/** Pure: decides whether a submitted code is acceptable. */
export function evaluateOtp(ch: Challenge, code: string, now: Date): OtpResult {
  if (ch.consumedAt) return { ok: false, reason: 'CONSUMED', countAttempt: false };
  if (ch.expiresAt <= now) return { ok: false, reason: 'EXPIRED', countAttempt: false };
  if (ch.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS', countAttempt: false };
  const a = Buffer.from(hashOtp(ch.id, code)), b = Buffer.from(ch.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'INVALID_CODE', countAttempt: true };
  return { ok: true };
}
