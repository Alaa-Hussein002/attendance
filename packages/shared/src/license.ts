/** Subscription / licence rules (pure, no crypto): the API signs and verifies keys; this decides what a licence allows today. */
export type Feature = 'tasks' | 'fingerprint' | 'whatsapp';
export type PlanCode = 'TRIAL' | 'STARTER' | 'BUSINESS' | 'ENTERPRISE' | 'CUSTOM';
export interface PlanDef { name: string; employees: number; branches: number; features: Record<Feature, boolean> }

/** Default limits used when issuing a key. A key may override them (CUSTOM). Prices are a business decision, not code. */
export const PLANS: Record<Exclude<PlanCode, 'CUSTOM'>, PlanDef> = {
  TRIAL: { name: 'تجريبية', employees: 10, branches: 2, features: { tasks: true, fingerprint: true, whatsapp: false } },
  STARTER: { name: 'الأساسية', employees: 15, branches: 1, features: { tasks: false, fingerprint: false, whatsapp: false } },
  BUSINESS: { name: 'الأعمال', employees: 60, branches: 5, features: { tasks: true, fingerprint: true, whatsapp: false } },
  ENTERPRISE: { name: 'المؤسسات', employees: 500, branches: 50, features: { tasks: true, fingerprint: true, whatsapp: true } },
};
export const TRIAL_DAYS = 14;
export const DEFAULT_GRACE_DAYS = 14;
export const WARN_DAYS = 14;

export interface LicensePayload {
  v: 1; id: string; customer: { id: string; name: string }; plan: PlanCode;
  limits: { employees: number; branches: number }; features: Record<Feature, boolean>;
  issuedAt: string; validUntil: string;      // validUntil: YYYY-MM-DD, valid THROUGH that day
  graceDays: number; installationId?: string; // bound to one installation when present
}
export type LicenseState = 'TRIAL' | 'ACTIVE' | 'EXPIRING' | 'GRACE' | 'RESTRICTED';
/** What the system still does in each state. Attendance itself NEVER stops: employees must always be able to check in. */
export interface Capabilities { checkIn: boolean; viewData: boolean; exportPayroll: boolean; closeMonth: boolean; manageStaff: boolean; manageTasks: boolean; editSettings: boolean }
export interface LicenseStatus {
  state: LicenseState; plan: PlanCode; planName: string; customer?: string; validUntil?: string;
  daysLeft: number; graceLeft?: number; limits: { employees: number; branches: number }; features: Record<Feature, boolean>; capabilities: Capabilities;
}
const ALL: Capabilities = { checkIn: true, viewData: true, exportPayroll: true, closeMonth: true, manageStaff: true, manageTasks: true, editSettings: true };
const READ_ONLY: Capabilities = { checkIn: true, viewData: true, exportPayroll: false, closeMonth: false, manageStaff: false, manageTasks: false, editSettings: false };

const day = (d: Date) => d.toISOString().slice(0, 10);
export const daysBetween = (fromDay: string, toDay: string) => Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86400000);

export function evaluateLicense(i: { payload: LicensePayload | null; trialStartedAt: Date; now: Date }): LicenseStatus {
  const today = day(i.now);
  if (!i.payload) {
    const trialEnd = day(new Date(i.trialStartedAt.getTime() + TRIAL_DAYS * 86400000)); const left = daysBetween(today, trialEnd); const t = PLANS.TRIAL;
    return { state: left >= 0 ? 'TRIAL' : 'RESTRICTED', plan: 'TRIAL', planName: t.name, validUntil: trialEnd, daysLeft: left, limits: { employees: t.employees, branches: t.branches }, features: t.features, capabilities: left >= 0 ? ALL : READ_ONLY };
  }
  const p = i.payload; const left = daysBetween(today, p.validUntil);
  const base = { plan: p.plan, planName: p.plan === 'CUSTOM' ? 'مخصصة' : PLANS[p.plan].name, customer: p.customer.name, validUntil: p.validUntil, daysLeft: left, limits: p.limits, features: p.features };
  if (left > WARN_DAYS) return { ...base, state: 'ACTIVE', capabilities: ALL };
  if (left >= 0) return { ...base, state: 'EXPIRING', capabilities: ALL };
  const graceLeft = p.graceDays + left;
  return graceLeft >= 0 ? { ...base, state: 'GRACE', graceLeft, capabilities: ALL } : { ...base, state: 'RESTRICTED', graceLeft: 0, capabilities: READ_ONLY };
}
export type Denial = 'LICENSE_RESTRICTED' | 'LICENSE_EMPLOYEE_LIMIT' | 'LICENSE_BRANCH_LIMIT' | 'LICENSE_FEATURE_DISABLED';
export function canAddEmployee(s: LicenseStatus, current: number): Denial | null { return !s.capabilities.manageStaff ? 'LICENSE_RESTRICTED' : current >= s.limits.employees ? 'LICENSE_EMPLOYEE_LIMIT' : null; }
export function canAddBranch(s: LicenseStatus, current: number): Denial | null { return !s.capabilities.editSettings ? 'LICENSE_RESTRICTED' : current >= s.limits.branches ? 'LICENSE_BRANCH_LIMIT' : null; }
export function canUseFeature(s: LicenseStatus, f: Feature): Denial | null { return s.features[f] ? null : 'LICENSE_FEATURE_DISABLED'; }
export function planPayload(plan: Exclude<PlanCode, 'CUSTOM'>): Pick<LicensePayload, 'limits' | 'features'> { const p = PLANS[plan]; return { limits: { employees: p.employees, branches: p.branches }, features: { ...p.features } }; }
