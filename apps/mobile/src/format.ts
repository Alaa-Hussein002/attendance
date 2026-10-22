// One calendar everywhere: Gregorian, Latin digits. "Today" always comes from the SERVER (/meta), never the phone's clock.
import { clock12, Locale, Translator } from '@attendance/i18n';

export const MONTH_KEYS = ['month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun', 'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec'] as const;
export const DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'] as const;
export const DAY_SHORT_KEYS = ['day.short.sun', 'day.short.mon', 'day.short.tue', 'day.short.wed', 'day.short.thu', 'day.short.fri', 'day.short.sat'] as const;

const dow = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
export const fmtDay = (iso: string, t: Translator) => `${t(DAY_KEYS[dow(iso)])} ${Number(iso.slice(8))} ${t(MONTH_KEYS[Number(iso.slice(5, 7)) - 1])}`;
export const fmtShort = (iso: string, t: Translator) => `${Number(iso.slice(8))} ${t(MONTH_KEYS[Number(iso.slice(5, 7)) - 1])}`;
export const monthLabel = (month: number, t: Translator) => t(MONTH_KEYS[Math.max(1, Math.min(12, month)) - 1]);
export const weekday = dow;
export const sar = (minor: number) => (minor / 100).toFixed(2);
export const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
export const hhmm12 = (mins: number, locale: Locale) => { const h = Math.floor(mins / 60), m = mins % 60; return clock12(`${h}:${String(m).padStart(2, '0')}`, locale); };
export const roleLabel = (role: string, t: Translator) => {
  const key = `role.${role}`;
  const text = t(key);
  return text === key ? role : text;
};
/** Seeded policy labels are Arabic; show them translated, but leave custom labels untouched. */
const DEFAULT_TIER_LABELS: Record<string, string> = {
  'منضبط': 'm.tier.default.GREEN',
  'متأخر': 'm.tier.default.RED',
  'غائب': 'm.tier.default.BLACK',
};
export const tierLabel = (label: string, t: Translator) => {
  const key = DEFAULT_TIER_LABELS[label];
  return key ? t(key) : label;
};
