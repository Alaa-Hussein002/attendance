export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaymentProvider } from '@/lib/payments';
import { issueLicenseForOrder } from '@/lib/issue';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const invoiceId = url.searchParams.get('id') || url.searchParams.get('invoice_id');
  const orderId = url.searchParams.get('order');
  if (!invoiceId || !orderId) return NextResponse.redirect(new URL('/checkout?status=failed', req.url));

  const provider = getPaymentProvider();
  let paid = false;
  try { paid = (await provider.verifyPayment(invoiceId)).paid; } catch { paid = false; }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order) return NextResponse.redirect(new URL('/checkout?status=failed', req.url));

  if (!paid) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } }).catch(() => {});
    return NextResponse.redirect(new URL('/checkout?status=failed', req.url));
  }

  if (order.status !== 'PAID') {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(), providerRef: invoiceId } });
  }
  await issueLicenseForOrder(order.id);

  return NextResponse.redirect(new URL(`/account?email=${encodeURIComponent(order.customer.email)}&paid=1`, req.url));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const invoiceId = body?.id ?? body?.data?.id;
  if (!invoiceId) return NextResponse.json({ ok: true });
  const order = await prisma.order.findFirst({ where: { providerRef: invoiceId } });
  if (!order) return NextResponse.json({ ok: true });
  const provider = getPaymentProvider();
  try {
    const v = await provider.verifyPayment(invoiceId);
    if (v.paid && order.status !== 'PAID') {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date() } });
      await issueLicenseForOrder(order.id);
    }
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}


