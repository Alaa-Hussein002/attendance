import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'crypto';
import { DEFAULT_GRACE_DAYS, LicensePayload, PLANS } from '@attendance/shared';

/** Licence key = BMK1.<payload>.<Ed25519 signature>. Only the vendor holds the PRIVATE key; installations carry the public one. */
const PREFIX = 'BMK1';
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(), privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
}
export function signLicense(p: LicensePayload, privatePem: string): string {
  const body = `${PREFIX}.${b64u(JSON.stringify(p))}`;
  return `${body}.${b64u(sign(null, Buffer.from(body), createPrivateKey(privatePem)))}`;
}
/** Accepts a PEM, a PEM with literal \n, or the base64 of a PEM (easiest to put in .env). */
export function parsePublicKey(v?: string | null): string | null {
  if (!v?.trim()) return null; const t = v.trim().replace(/\\n/g, '\n');
  return t.startsWith('-----') ? t : Buffer.from(t, 'base64').toString('utf8');
}
export type Verified = { ok: true; payload: LicensePayload } | { ok: false; reason: 'FORMAT' | 'SIGNATURE' | 'PAYLOAD' | 'NO_PUBLIC_KEY' };

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function validPayload(p: any): p is LicensePayload {
  return p?.v === 1 && typeof p.id === 'string' && typeof p.customer?.name === 'string' && typeof p.customer?.id === 'string'
    && (p.plan === 'CUSTOM' || p.plan in PLANS) && Number.isInteger(p.limits?.employees) && p.limits.employees >= 0 && Number.isInteger(p.limits?.branches) && p.limits.branches >= 0
    && ['tasks', 'fingerprint', 'whatsapp'].every((f) => typeof p.features?.[f] === 'boolean') && isDate(p.issuedAt) && isDate(p.validUntil)
    && Number.isInteger(p.graceDays) && p.graceDays >= 0 && p.graceDays <= 90 && (p.installationId === undefined || typeof p.installationId === 'string');
}
export function verifyLicense(key: string, publicPem: string | null): Verified {
  if (!publicPem) return { ok: false, reason: 'NO_PUBLIC_KEY' };
  const parts = String(key ?? '').trim().split('.'); if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: 'FORMAT' };
  try {
    const good = verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey(publicPem), Buffer.from(parts[2], 'base64url'));
    if (!good) return { ok: false, reason: 'SIGNATURE' };
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return validPayload(payload) ? { ok: true, payload } : { ok: false, reason: 'PAYLOAD' };
  } catch { return { ok: false, reason: 'SIGNATURE' }; }
}
export { DEFAULT_GRACE_DAYS };
