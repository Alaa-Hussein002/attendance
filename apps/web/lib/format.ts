// One calendar for the whole product: Gregorian, Latin digits, the company's timezone, server clock as the source of truth.
export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const LOCALE = 'ar-SA-u-ca-gregory-nu-latn';
export const fmtDate = (iso: string, tz = 'UTC') => new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(new Date(`${iso}T12:00:00Z`));
export const fmtDay = (iso: string) => `${DAYS_AR[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${Number(iso.slice(8))} ${MONTHS_AR[Number(iso.slice(5, 7)) - 1]}`;
export const fmtClock = (date: Date, tz: string) => new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz }).format(date);
export const fmtTime12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
export const sar = (minor: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
export const ROLE_AR: Record<string, string> = { SUPER_ADMIN: 'مشرف المنصة', COMPANY_ADMIN: 'مدير النظام', HR: 'موارد بشرية', BRANCH_MANAGER: 'مدير فرع', TEAM_LEAD: 'قائد فريق / حجوزات', PHOTOGRAPHER: 'مصوّر', EMPLOYEE: 'موظف' };
