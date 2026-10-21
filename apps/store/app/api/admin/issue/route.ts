export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { adminOk, unauthorized } from '@/lib/admin-guard';
import { generateSerial } from '@/lib/serial';
import { buildPayload, loadPrivateKey, signLicense } from '@/lib/license';
import { sendLicenseEmail } from '@/lib/mailer';
import { PLAN_NAMES } from '@/lib/plans';

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { email, planCode, days } = body ?? {};
  if (!email || !planCode) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });

  const customer = await prisma.customer.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  const priv = loadPrivateKey();
  if (!priv) return NextResponse.json({ error: 'no_private_key' }, { status: 500 });

  let serial = generateSerial();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.license.findUnique({ where: { serial } });
    if (!clash) break;
    serial = generateSerial();
  }

  const d = Number(days) || plan.periodDays;
  const payload = buildPayload({
    serial,
    email,
    customerName: customer.name ?? email,
    planCode: planCode as any,
    days: d,
    graceDays: 14,
    employees: plan.employees,
    branches: plan.branches,
    features: JSON.parse(plan.features),
  });
  const key = signLicense(payload, priv);

  await prisma.license.create({
    data: {
      serial,
      key,
      customerId: customer.id,
      planCode,
      email,
      validUntil: payload.validUntil,
      graceDays: 14,
      limits: JSON.stringify(payload.limits),
      features: JSON.stringify(payload.features),
    },
  });

  try {
    await sendLicenseEmail({
      to: email,
      serial,
      key,
      planName: (PLAN_NAMES[planCode]?.en ?? planCode),
      validUntil: payload.validUntil,
      locale: customer.locale === 'ar' ? 'ar' : 'en',
      vendorUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'https://baytalmosawer.com',
    });
  } catch (e) { console.error('[issue] email failed', e); }

  return NextResponse.json({ ok: true, serial });
}


