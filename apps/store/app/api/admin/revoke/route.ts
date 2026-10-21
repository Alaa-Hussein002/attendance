export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { adminOk, unauthorized } from '@/lib/admin-guard';

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { serial } = body ?? {};
  if (!serial) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  await prisma.license.updateMany({ where: { serial }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}


