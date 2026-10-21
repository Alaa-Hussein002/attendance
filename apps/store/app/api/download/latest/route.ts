export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const r = await prisma.release.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  if (!r) return NextResponse.json({ error: 'no_release' }, { status: 404 });
  return NextResponse.json({ ...r });
}


