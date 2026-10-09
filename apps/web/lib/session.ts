// NOTE: sessionStorage is acceptable for the MVP; move tokens to httpOnly cookies (BFF) before production.
export interface SessionUser { id: string; name: string; role: string }
const K = { at: 'at', rt: 'rt', user: 'user' };
const ss = () => (typeof window === 'undefined' ? null : window.sessionStorage);
export const session = {
  access: () => ss()?.getItem(K.at) ?? null,
  refresh: () => ss()?.getItem(K.rt) ?? null,
  user: (): SessionUser | null => { try { return JSON.parse(ss()?.getItem(K.user) ?? 'null'); } catch { return null; } },
  save(r: { accessToken: string; refreshToken: string; user: SessionUser }) { ss()?.setItem(K.at, r.accessToken); ss()?.setItem(K.rt, r.refreshToken); ss()?.setItem(K.user, JSON.stringify(r.user)); },
  setAccess(t: string, rt: string) { ss()?.setItem(K.at, t); ss()?.setItem(K.rt, rt); },
  clear() { Object.values(K).forEach((k) => ss()?.removeItem(k)); },
};
/** Area access. Administration (settings, branches, devices, WhatsApp) is admin-only; HR runs people, attendance and tasks. */
export const ADMIN_ONLY = ['COMPANY_ADMIN', 'SUPER_ADMIN'];
export const HR_AREA = [...ADMIN_ONLY, 'HR'];
export const TASK_AREA = [...HR_AREA, 'TEAM_LEAD'];
export const ADMIN_ROLES = TASK_AREA; // everyone who may use the web panel
export const PATH_ROLES: Record<string, string[]> = { '/reports': HR_AREA, '/employees': HR_AREA, '/leaves': HR_AREA, '/tasks': TASK_AREA, '/branches': ADMIN_ONLY, '/settings': ADMIN_ONLY };
export const homeFor = (role: string) => (HR_AREA.includes(role) ? '/reports' : '/tasks');
