// One calendar for the whole product: Gregorian, Latin digits, the company's timezone, server clock as the source of truth.
// Labels are resolved through the bilingual dictionary; pass the translator `t` (from useI18n()) when rendering.

import { clock12, formatDate, formatDateTime, Locale } from '@attendance/i18n';

export type T = (key: string, vars?: Record<string, string | number>) => string;

export const MONTH_KEYS = ['month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun', 'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec'] as const;
export const DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'] as const;
export const DAY_SHORT_KEYS = ['day.short.sun', 'day.short.mon', 'day.short.tue', 'day.short.wed', 'day.short.thu', 'day.short.fri', 'day.short.sat'] as const;

const dow = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

export const fmtDate = (iso: string, locale: Locale = 'ar', tz = 'UTC') =>
  formatDate(iso, locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });

/** "Sunday 6 October" in the active language. */
export const fmtDay = (iso: string, t: T) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${t(DAY_KEYS[d.getUTCDay()])} ${d.getUTCDate()} ${t(MONTH_KEYS[d.getUTCMonth()])}`;
};

/** "6 October" (no weekday). */
export const fmtShortDay = (iso: string, t: T) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${t(MONTH_KEYS[d.getUTCMonth()])}`;
};

export const fmtClock = (date: Date, tz: string, locale: Locale = 'ar') => formatDateTime(date, locale, tz);

/** "14:30" -> "2:30 م" / "2:30 pm" */
export const fmtTime12 = (hhmm: string, locale: Locale = 'ar') => clock12(hhmm, locale);

/** "10:00" -> minutes since midnight. */
export const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export const sar = (minor: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);

export const roleLabel = (role: string, t: T) => {
  const key = `role.${role}`;
  const text = t(key);
  return text === key ? role : text;
};

/**
 * The seeded policy ships Arabic default labels. Show those in the active language, but never touch
 * custom labels an administrator typed.
 */
const DEFAULT_TIER_LABELS: Record<string, string> = {
  'منضبط': 'w.tier.default.GREEN',
  'متأخر': 'w.tier.default.RED',
  'غائب': 'w.tier.default.BLACK',
};
export const tierLabel = (label: string, t: T) => {
  const key = DEFAULT_TIER_LABELS[label];
  return key ? t(key) : label;
};
