import { describe, expect, it } from 'vitest';
import { canAddBranch, canAddEmployee, canUseFeature, evaluateLicense, LicensePayload, planPayload } from './license';

const lic = (validUntil: string, o: Partial<LicensePayload> = {}): LicensePayload => ({ v: 1, id: 'L1', customer: { id: 'C1', name: 'بيت المصور' }, plan: 'BUSINESS', ...planPayload('BUSINESS'), issuedAt: '2026-01-01', validUntil, graceDays: 14, ...o });
const at = (iso: string) => new Date(`${iso}T10:00:00Z`);
const ev = (payload: LicensePayload | null, now: string, trial = '2026-10-01') => evaluateLicense({ payload, trialStartedAt: at(trial), now: at(now) });

describe('licence states over time', () => {
  it('far from expiry => ACTIVE', () => expect(ev(lic('2027-01-31'), '2026-10-08')).toMatchObject({ state: 'ACTIVE', daysLeft: 115 }));
  it('within 14 days => EXPIRING (still fully working)', () => expect(ev(lic('2026-10-20'), '2026-10-08')).toMatchObject({ state: 'EXPIRING', daysLeft: 12, capabilities: { manageStaff: true } }));
  it('the last valid day is still EXPIRING', () => expect(ev(lic('2026-10-08'), '2026-10-08')).toMatchObject({ state: 'EXPIRING', daysLeft: 0 }));
  it('after expiry => GRACE with days left (still fully working)', () => expect(ev(lic('2026-10-01'), '2026-10-08')).toMatchObject({ state: 'GRACE', graceLeft: 7, capabilities: { exportPayroll: true } }));
  it('after the grace period => RESTRICTED: payroll/settings/staff locked, attendance + viewing kept', () => {
    const s = ev(lic('2026-09-01'), '2026-10-08');
    expect(s.state).toBe('RESTRICTED'); expect(s.capabilities).toMatchObject({ checkIn: true, viewData: true, exportPayroll: false, closeMonth: false, manageStaff: false, manageTasks: false, editSettings: false });
  });
});
describe('trial (no key)', () => {
  it('first days => TRIAL with trial limits', () => expect(ev(null, '2026-10-05')).toMatchObject({ state: 'TRIAL', limits: { employees: 10 }, daysLeft: 10 }));
  it('after 14 days => RESTRICTED', () => expect(ev(null, '2026-10-20').state).toBe('RESTRICTED'));
});
describe('limits and features', () => {
  const s = ev(lic('2027-01-31'), '2026-10-08');
  it('employee limit', () => { expect(canAddEmployee(s, 59)).toBeNull(); expect(canAddEmployee(s, 60)).toBe('LICENSE_EMPLOYEE_LIMIT'); });
  it('branch limit', () => { expect(canAddBranch(s, 4)).toBeNull(); expect(canAddBranch(s, 5)).toBe('LICENSE_BRANCH_LIMIT'); });
  it('plan features: BUSINESS has tasks, no WhatsApp', () => { expect(canUseFeature(s, 'tasks')).toBeNull(); expect(canUseFeature(s, 'whatsapp')).toBe('LICENSE_FEATURE_DISABLED'); });
  it('restricted state blocks adding staff even under the limit', () => expect(canAddEmployee(ev(lic('2026-09-01'), '2026-10-08'), 1)).toBe('LICENSE_RESTRICTED'));
  it('a CUSTOM key may carry its own limits', () => expect(ev(lic('2027-01-31', { plan: 'CUSTOM', limits: { employees: 1000, branches: 99 } }), '2026-10-08').limits.employees).toBe(1000));
});
