import { prisma } from './db';
import { generateSerial } from './serial';
import { buildPayload, loadPrivateKey, signLicense } from './license';
import { sendLicenseEmail } from './mailer';
import { PLAN_NAMES } from './plans';

export async function issueLicenseForOrder(orderId: string): Promise<{ serial: string; key: string } | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true, plan: true } });
  if (!order || order.status !== 'PAID') return null;
  // idempotent
  const existing = await prisma.license.findUnique({ where: { orderId } });
  if (existing) return { serial: existing.serial, key: existing.key };

  const priv = loadPrivateKey();
  if (!priv) { console.error('[issue] LICENSE_PRIVATE_KEY not configured'); return null; }

  let serial = generateSerial();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.license.findUnique({ where: { serial } });
    if (!clash) break;
    serial = generateSerial();
  }

  const payload = buildPayload({
    serial,
    email: order.customer.email,
    customerName: order.customer.name ?? order.customer.email,
    planCode: order.planCode as any,
    days: order.plan.periodDays,
    graceDays: 14,
    employees: order.plan.employees,
    branches: order.plan.branches,
    features: JSON.parse(order.plan.features),
  });
  const key = signLicense(payload, priv);

  await prisma.license.create({
    data: {
      serial,
      key,
      customerId: order.customer.id,
      orderId: order.id,
      planCode: order.planCode,
      email: order.customer.email,
      validUntil: payload.validUntil,
      graceDays: payload.graceDays,
      limits: JSON.stringify(payload.limits),
      features: JSON.stringify(payload.features),
    },
  });

  try {
    await sendLicenseEmail({
      to: order.customer.email,
      serial,
      key,
      planName: (PLAN_NAMES[order.planCode]?.en ?? order.planCode),
      validUntil: payload.validUntil,
      locale: order.customer.locale === 'ar' ? 'ar' : 'en',
      vendorUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'https://baytalmosawer.com',
    });
  } catch (e) { console.error('[issue] email failed', e); }

  return { serial, key };
}
