export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loadPrivateKey, signLicense, buildPayload } from '@/lib/license';
import { sendLicenseEmail } from '@/lib/mailer';
import { PLAN_NAMES } from '@/lib/plans';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, serial, installationId } = body ?? {};
  if (!email || !serial || !installationId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const customer = await prisma.customer.findUnique({ where: { email } });
  const lic = customer ? await prisma.license.findFirst({ where: { customerId: customer.id, serial } }) : null;
  if (!customer || !lic) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const priv = loadPrivateKey();
  if (!priv) return NextResponse.json({ error: 'no_private_key' }, { status: 500 });

  const limits = JSON.parse(lic.limits);
  const features = JSON.parse(lic.features);
  const daysLeft = Math.max(1, Math.round((new Date(lic.validUntil).getTime() - Date.now()) / 86400000));
  const payload = buildPayload({
    serial: lic.serial,
    email: customer.email,
    customerName: customer.name ?? customer.email,
    planCode: lic.planCode as any,
    days: daysLeft,
    graceDays: lic.graceDays,
    employees: limits.employees,
    branches: limits.branches,
    features,
    installationId,
  });
  payload.validUntil = lic.validUntil;
  const key = signLicense(payload, priv);

  await prisma.license.update({
    where: { id: lic.id },
    data: { key, installationId },
  });

  await sendLicenseEmail({
    to: customer.email,
    serial: lic.serial,
    key,
    planName: (PLAN_NAMES[lic.planCode]?.en ?? lic.planCode),
    validUntil: lic.validUntil,
    locale: customer.locale === 'ar' ? 'ar' : 'en',
    vendorUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'https://baytalmosawer.com',
  });

  return NextResponse.json({ ok: true, serial: lic.serial });
}


