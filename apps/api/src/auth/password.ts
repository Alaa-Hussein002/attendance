/** The shared first-login password. It only works together with an email OTP and MUST be replaced at first login. */
export const DEFAULT_PASSWORD = '12345678';

/** Returns an error code, or null when the password is acceptable. */
export function validateNewPassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'PASSWORD_TOO_SHORT';
  if (pw.length > 72) return 'PASSWORD_TOO_LONG';
  if (pw === DEFAULT_PASSWORD) return 'PASSWORD_IS_DEFAULT';
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw) || !/\d/.test(pw)) return 'PASSWORD_NEEDS_LETTER_AND_DIGIT';
  if (/^(.)\1+$/.test(pw)) return 'PASSWORD_TOO_SIMPLE';
  return null;
}
