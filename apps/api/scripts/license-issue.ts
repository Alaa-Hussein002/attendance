// VENDOR ONLY. Issues a licence key. Example:
//   npm run license:issue -w @attendance/api -- --customer "بيت المصور" --plan BUSINESS --days 365 --installation <ID from the Subscription page>
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { DEFAULT_GRACE_DAYS, LicensePayload, planPayload, PLANS } from '@attendance/shared';
import { signLicense } from '../src/license/license';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : undefined; };
const fail = (m: string): never => { console.error('✗ ' + m); process.exit(1); };
const plan = (arg('plan') ?? 'BUSINESS').toUpperCase(); if (!(plan in PLANS) || plan === 'TRIAL') fail(`--plan must be one of: ${Object.keys(PLANS).filter((p) => p !== 'TRIAL').join(', ')}`);
const keyFile = arg('key') ?? process.env.LICENSE_PRIVATE_KEY_FILE ?? 'license-keys/license-private.pem';
const customer = arg('customer') ?? fail('--customer "Company name" is required');
const days = Number(arg('days') ?? 365); const until = arg('until') ?? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) fail('--until must be YYYY-MM-DD');
const base = planPayload(plan as keyof typeof PLANS);
const emp = arg('employees') ? Number(arg('employees')) : base.limits.employees; const br = arg('branches') ? Number(arg('branches')) : base.limits.branches;
const features = { ...base.features, ...(arg('features') ? Object.fromEntries(['tasks', 'fingerprint', 'whatsapp'].map((f) => [f, arg('features')!.split(',').includes(f)])) : {}) };
const payload: LicensePayload = { v: 1, id: randomUUID(), customer: { id: arg('customer-id') ?? randomUUID(), name: customer }, plan: (arg('employees') || arg('branches') || arg('features') ? 'CUSTOM' : plan) as any,
  limits: { employees: emp, branches: br }, features, issuedAt: new Date().toISOString().slice(0, 10), validUntil: until, graceDays: Number(arg('grace') ?? DEFAULT_GRACE_DAYS), installationId: arg('installation') };
console.log(`\nCustomer : ${customer}\nPlan     : ${payload.plan}  (employees ${emp}, branches ${br}, features: ${Object.entries(features).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'})\nValid to : ${until}  (+${payload.graceDays} days grace)\nBound to : ${payload.installationId ?? 'ANY installation (not bound!)'}\n\n${signLicense(payload, readFileSync(keyFile, 'utf8'))}\n`);
