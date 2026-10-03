import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}
/** Used to keep login timing equal when the user does not exist (no account enumeration). */
export const DUMMY_HASH = hashPassword('dummy-password-for-timing');

export const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const hashOtp = (challengeId: string, code: string) => sha256(`${challengeId}:${code}`);
