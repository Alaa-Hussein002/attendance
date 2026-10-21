export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureSeeded } from '@/lib/seed';
import { getPaymentProvider } from '@/lib/payments';
import { generateSerial } from '@/lib/serial';
import { buildPayload, loadPrivateKey, signLicense } from '@/lib/license';
import { sendLicenseEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));
  const { planCode, email, name, company, phone } = body ?? {};
  if (!email || !planCode) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });

  // upsert customer
  const customer = await prisma.customer.upsert({
    where: { email },
    create: { email, name: name ?? null, company: company ?? null, phone: phone ?? null },
    update: { name: name ?? undefined, company: company ?? undefined, phone: phone ?? undefined },
  });

  // create order
  const number = 'ORD-' + Date.now().toString(36).toUpperCase();
  const order = await prisma.order.create({
    data: { number, customerId: customer.id, planCode, amount: plan.priceSar, currency: 'SAR', status: 'PENDING', meta: JSON.stringify({ phone }) },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3002';
  const provider = getPaymentProvider();
  const checkout = await provider.createCheckout({
    amount: plan.priceSar,
    currency: 'SAR',
    description: `${plan.nameEn} — ${plan.periodDays} days`,
    callbackUrl: `${baseUrl}/api/webhook/moyasar?order=${order.id}`,
    metadata: { order_id: order.id },
  });

  await prisma.order.update({ where: { id: order.id }, data: { provider: provider.name, providerRef: checkout.providerRef } });

  return NextResponse.json({ orderId: order.id, orderNumber: number, paymentUrl: checkout.paymentUrl, provider: provider.name });
}


