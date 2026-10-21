export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendLicenseEmail } from '@/lib/mailer';
import { PLAN_NAMES } from '@/lib/plans';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, serial } = body ?? {};
  if (!email || !serial) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  const customer = await prisma.customer.findUnique({ where: { email } });
  const license = customer ? await prisma.license.findFirst({ where: { customerId: customer.id, serial } }) : null;
  if (!customer || !license) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await sendLicenseEmail({
    to: customer.email,
    serial: license.serial,
    key: license.key,
    planName: (PLAN_NAMES[license.planCode]?.en ?? license.planCode),
    validUntil: license.validUntil,
    locale: customer.locale === 'ar' ? 'ar' : 'en',
    vendorUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'https://baytalmosawer.com',
  });
  return NextResponse.json({ ok: true });
}


