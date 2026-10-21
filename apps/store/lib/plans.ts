import { Feature, PLANS } from '@attendance/shared';

export interface PlanView {
  code: string;
  nameAr: string;
  nameEn: string;
  priceSar: number;   // halalas
  periodDays: number;
  employees: number;
  branches: number;
  features: Record<Feature, boolean>;
  active: boolean;
  sortOrder: number;
}

/** Default catalog used to seed the store database on first run. */
export const SEED_PLANS: PlanView[] = [
  { code: 'STARTER', nameAr: 'المبتدئ', nameEn: 'Starter', priceSar: 14900, periodDays: 30, employees: 15, branches: 1, features: { tasks: false, fingerprint: false, whatsapp: false }, active: true, sortOrder: 10 },
  { code: 'BUSINESS', nameAr: 'الأعمال', nameEn: 'Business', priceSar: 34900, periodDays: 30, employees: 60, branches: 5, features: { tasks: true, fingerprint: true, whatsapp: false }, active: true, sortOrder: 20 },
  { code: 'ENTERPRISE', nameAr: 'المؤسسات', nameEn: 'Enterprise', priceSar: 89900, periodDays: 30, employees: 500, branches: 50, features: { tasks: true, fingerprint: true, whatsapp: true }, active: true, sortOrder: 30 },
  { code: 'TRIAL', nameAr: 'تجريبي', nameEn: 'Trial', priceSar: 0, periodDays: 14, employees: 10, branches: 2, features: { tasks: true, fingerprint: true, whatsapp: false }, active: true, sortOrder: 0 },
];

export const PLAN_NAMES: Record<string, { ar: string; en: string }> = {
  STARTER: { ar: 'المبتدئ', en: 'Starter' },
  BUSINESS: { ar: 'الأعمال', en: 'Business' },
  ENTERPRISE: { ar: 'المؤسسات', en: 'Enterprise' },
  TRIAL: { ar: 'تجريبي', en: 'Trial' },
  CUSTOM: { ar: 'مخصص', en: 'Custom' },
};
