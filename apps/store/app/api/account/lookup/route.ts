export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, serial } = body ?? {};
  if (!email || !serial) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const license = await prisma.license.findFirst({ where: { customerId: customer.id, serial } });
  if (!license) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    customer: { email: customer.email, name: customer.name, company: customer.company },
    license: {
      serial: license.serial,
      key: license.key,
      planCode: license.planCode,
      validUntil: license.validUntil,
      graceDays: license.graceDays,
      revokedAt: license.revokedAt,
      installationId: license.installationId,
    },
    download: await (async () => {
      const r = await prisma.release.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } });
      return r ? { version: r.version, fileName: r.fileName, sizeBytes: r.sizeBytes, sha256: r.sha256 } : null;
    })(),
  });
}


