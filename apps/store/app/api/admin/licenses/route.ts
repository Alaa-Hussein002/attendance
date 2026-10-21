export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { adminOk, unauthorized } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return unauthorized();
  const licenses = await prisma.license.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { customer: true } });
  return NextResponse.json(licenses);
}


