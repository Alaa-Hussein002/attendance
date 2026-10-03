import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_POLICY } from '@attendance/shared';
import { hashPassword } from '../src/auth/crypto';

const prisma = new PrismaClient();
async function main() {
  const company = await prisma.company.create({ data: { name: 'Demo Co', slug: 'demo' } });
  const branch = await prisma.branch.create({ data: { companyId: company.id, name: 'Main',
    latitude: 21.5433, longitude: 39.1728, radiusMeters: 150, allowedIpRanges: [], verificationModes: ['GPS', 'NETWORK'] } });
  await prisma.attendancePolicy.create({ data: { companyId: company.id, name: 'Default', config: DEFAULT_POLICY as any,
    effectiveFrom: '2026-01-01', isDefault: true, createdById: 'seed' } });
  const pw = hashPassword(process.env.SEED_PASSWORD ?? 'ChangeMe!123');
  await prisma.user.create({ data: { companyId: company.id, role: 'HR', name: 'HR Demo', email: 'hr@demo.test', passwordHash: pw } });
  await prisma.user.create({ data: { companyId: company.id, branchId: branch.id, role: 'EMPLOYEE', name: 'Employee Demo',
    email: 'emp@demo.test', passwordHash: pw, baseSalary: 3000 } });
  console.log('Seeded. companyCode=demo, hr@demo.test / emp@demo.test');
}
main().finally(() => prisma.$disconnect());
