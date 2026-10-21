import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || 'change-me-to-a-random-string-of-at-least-32-characters';
const COOKIE = 'store_admin';
const MAX_AGE = 60 * 60 * 8; // 8 hours

export function adminCookieName() { return COOKIE; }

export function signAdminToken(): string {
  const payload = JSON.stringify({ iat: Date.now(), exp: Date.now() + MAX_AGE * 1000 });
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(parts[1]))) return false;
    const data = JSON.parse(payload);
    return typeof data.exp === 'number' && Date.now() < data.exp;
  } catch { return false; }
}

export function adminCookieValue(token: string): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearAdminCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAdminPasswordValid(pw: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(pw), b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
