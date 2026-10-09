// One calendar everywhere: Gregorian, Latin digits. "Today" always comes from the SERVER (/meta), never the phone's clock.
export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const dow = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
export const fmtDay = (iso: string) => `${DAYS_AR[dow(iso)]} ${Number(iso.slice(8))} ${MONTHS_AR[Number(iso.slice(5, 7)) - 1]}`;
export const fmtShort = (iso: string) => `${Number(iso.slice(8))} ${MONTHS_AR[Number(iso.slice(5, 7)) - 1]}`;
export const weekday = dow;
export const sar = (minor: number) => (minor / 100).toFixed(2);
export const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
export const hhmm12 = (mins: number) => { const h = Math.floor(mins / 60), m = mins % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
export const ROLE_AR: Record<string, string> = { COMPANY_ADMIN: 'مدير النظام', HR: 'موارد بشرية', BRANCH_MANAGER: 'مدير فرع', TEAM_LEAD: 'قائد فريق', PHOTOGRAPHER: 'مصوّر', EMPLOYEE: 'موظف' };
