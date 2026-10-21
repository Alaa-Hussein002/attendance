export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { adminOk, unauthorized } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return unauthorized();
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return NextResponse.json(customers);
}


