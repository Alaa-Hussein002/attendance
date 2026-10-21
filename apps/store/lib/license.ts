import { createPrivateKey, sign } from 'crypto';
import { PLANS, PlanCode, LicensePayload, DEFAULT_GRACE_DAYS } from '@attendance/shared';

const PREFIX = 'BMK1';
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** The vendor's Ed25519 PRIVATE key. Accepts a PEM, a PEM with literal \\n, or the base64 of a PEM. */
export function loadPrivateKey(): string | null {
  const raw = process.env.LICENSE_PRIVATE_KEY?.trim();
  if (raw) return raw.startsWith('-----') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const fs = require('fs') as typeof import('fs');
  const file = process.env.LICENSE_PRIVATE_KEY_FILE?.trim();
  if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  return null;
}

export function signLicense(payload: LicensePayload, privatePem: string): string {
  const body = `${PREFIX}.${b64u(JSON.stringify(payload))}`;
  return `${body}.${b64u(sign(null, Buffer.from(body), createPrivateKey(privatePem)))}`;
}

export interface IssueInput {
  serial: string;
  email: string;
  customerName: string;
  planCode: Exclude<PlanCode, 'TRIAL'> | 'CUSTOM';
  days: number;
  graceDays?: number;
  employees?: number;
  branches?: number;
  features?: Record<'tasks' | 'fingerprint' | 'whatsapp', boolean>;
  installationId?: string;
}

export function buildPayload(input: IssueInput): LicensePayload {
  const isCustom = input.planCode === 'CUSTOM';
  const base = input.planCode !== 'CUSTOM' ? PLANS[input.planCode as keyof typeof PLANS] : null;
  const features = input.features ?? (base ? { ...base.features } : { tasks: true, fingerprint: true, whatsapp: true });
  const limits = { employees: input.employees ?? (base?.employees ?? 500), branches: input.branches ?? (base?.branches ?? 50) };
  const validUntil = new Date(Date.now() + input.days * 86400000).toISOString().slice(0, 10);
  return {
    v: 1,
    id: crypto.randomUUID(),
    customer: { id: crypto.randomUUID(), name: input.customerName },
    plan: input.planCode,
    limits,
    features,
    issuedAt: new Date().toISOString().slice(0, 10),
    validUntil,
    graceDays: input.graceDays ?? 14,
    installationId: input.installationId,
    serial: input.serial,
    email: input.email,
  } as LicensePayload & { serial: string; email: string };
}
