export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { adminOk, unauthorized } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return unauthorized();
  const [customers, orders, paidOrders, licenses] = await Promise.all([
    prisma.customer.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.license.count({ where: { revokedAt: null } }),
  ]);
  return NextResponse.json({ customers, orders, paidOrders, licenses });
}


