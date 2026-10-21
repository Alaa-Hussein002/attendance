// One calendar for the whole product: Gregorian, Latin digits, the company's timezone, server clock as the source of truth.
// Labels are resolved through the bilingual dictionary; pass the translator `t` (from useI18n()) when rendering.

export const MONTH_KEYS = ['month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun', 'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec'] as const;
export const DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'] as const;
export const DAY_SHORT_KEYS = ['day.short.sun', 'day.short.mon', 'day.short.tue', 'day.short.wed', 'day.short.thu', 'day.short.fri', 'day.short.sat'] as const;

const LOCALE = 'ar-SA-u-ca-gregory-nu-latn';
export const fmtDate = (iso: string, tz = 'UTC') => new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(new Date(`${iso}T12:00:00Z`));
export const fmtDay = (iso: string, t?: (k: string) => string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const monthKey = MONTH_KEYS[d.getUTCMonth()];
  const dayKey = DAY_KEYS[d.getUTCDay()];
  const month = t ? t(monthKey) : monthKey;
  const day = t ? t(dayKey) : dayKey;
  return `${day} ${d.getUTCDate()} ${month}`;
};
export const fmtClock = (date: Date, tz: string) => new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz }).format(date);
export const fmtTime12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
export const sar = (minor: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
export const roleLabel = (role: string, t?: (k: string) => string) => (t ? t(`role.${role}`) : role);

// Back-compat aliases (kept so unmigrated callers still compile)
export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const ROLE_AR: Record<string, string> = { SUPER_ADMIN: 'المدير العام', COMPANY_ADMIN: 'مدير المنشأة', HR: 'موارد بشرية', BRANCH_MANAGER: 'مدير فرع', TEAM_LEAD: 'مشرف فريق / حجوزات', PHOTOGRAPHER: 'مصور', EMPLOYEE: 'موظف' };
