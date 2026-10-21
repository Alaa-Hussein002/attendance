export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { issueLicenseForOrder } from '@/lib/issue';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('order');
  if (!orderId) return NextResponse.redirect(new URL('/', req.url));
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.redirect(new URL('/', req.url));
  if (order.status !== 'PAID') {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(), provider: 'mock', providerRef: 'mock_' + order.id } });
  }
  await issueLicenseForOrder(order.id);
  return NextResponse.redirect(new URL(`/account?email=${encodeURIComponent((await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } }))!.customer.email)}&paid=1`, req.url));
}


