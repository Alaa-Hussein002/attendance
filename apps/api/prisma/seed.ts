import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_POLICY } from '@attendance/shared';
import { hashPassword } from '../src/auth/crypto';

// OPTIONAL demo data (npm run seed). Skip it to use the real first-run setup wizard instead.
const prisma = new PrismaClient();
async function main() {
  if (await prisma.company.findUnique({ where: { slug: 'demo' } })) { console.log('Demo data already exists, skipping.'); return; }
  const now = new Date();
  const company = await prisma.company.create({ data: { name: 'Demo Co', slug: 'demo' } });
  const branch = await prisma.branch.create({ data: { companyId: company.id, name: 'Main',
    latitude: 21.5433, longitude: 39.1728, radiusMeters: 150, allowedIpRanges: [], verificationModes: ['GPS', 'NETWORK'] } });
  await prisma.attendancePolicy.create({ data: { companyId: company.id, name: 'Default', config: DEFAULT_POLICY as any, effectiveFrom: '2026-01-01', isDefault: true, createdById: 'seed' } });
  const pw = hashPassword(process.env.SEED_PASSWORD ?? 'ChangeMe!123');
  await prisma.user.create({ data: { companyId: company.id, role: 'HR', name: 'HR Demo', email: 'hr@demo.test', passwordHash: pw, emailVerifiedAt: now, tracksAttendance: false } });
  await prisma.user.create({ data: { companyId: company.id, branchId: branch.id, role: 'PHOTOGRAPHER', name: 'Photographer Demo', email: 'emp@demo.test', passwordHash: pw, baseSalary: 3000, emailVerifiedAt: now } });
  console.log('Seeded. hr@demo.test / emp@demo.test (SEED_PASSWORD or ChangeMe!123)');
}
main().finally(() => prisma.$disconnect());
