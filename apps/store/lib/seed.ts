import { prisma } from './db';
import { SEED_PLANS } from './plans';

export async function ensureSeeded() {
  const count = await prisma.plan.count();
  if (count === 0) {
    for (const p of SEED_PLANS) {
      await prisma.plan.create({ data: { code: p.code, nameAr: p.nameAr, nameEn: p.nameEn, priceSar: p.priceSar, periodDays: p.periodDays, employees: p.employees, branches: p.branches, features: JSON.stringify(p.features), active: p.active, sortOrder: p.sortOrder } });
    }
  }
}
