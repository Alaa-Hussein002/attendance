export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { adminOk, unauthorized } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  if (!adminOk(req)) return unauthorized();
  const releases = await prisma.release.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(releases);
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { version, fileName, sizeBytes, sha256, notes, active } = body ?? {};
  if (!version || !fileName) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  const r = await prisma.release.create({
    data: { version, fileName, sizeBytes: Number(sizeBytes) || 0, sha256: sha256 || null, notes: notes || null, active: active !== false },
  });
  return NextResponse.json(r);
}


