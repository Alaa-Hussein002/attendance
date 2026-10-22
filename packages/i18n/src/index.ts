/**
 * @attendance/i18n — one bilingual dictionary for the whole product.
 *
 * The API speaks language-neutral error CODES ("INVALID_CREDENTIALS"); this package turns a code into a
 * sentence in the user's language. Dictionaries are flat, dotted-key maps so that every app (admin panel,
 * employee app) can extend them without touching the others.
 */
import { en as commonEn, ar as commonAr } from './dict/common';
import { en as webEn, ar as webAr } from './dict/web';
import { en as mobileEn, ar as mobileAr } from './dict/mobile';
import type { Locale, MsgValue, Plural } from './types';

export type { Locale, MsgValue, Plural };
export const LOCALES: Locale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: Locale = 'ar';

export const isLocale = (v: unknown): v is Locale => v === 'ar' || v === 'en';
export const dir = (l: Locale): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');
export const localeName = (l: Locale): string => (l === 'ar' ? 'العربية' : 'English');

export const en = { ...commonEn, ...webEn, ...mobileEn };
export const ar = { ...commonAr, ...webAr, ...mobileAr };

export type MsgKey = keyof typeof en;
const DICT: Record<Locale, Record<string, MsgValue>> = { en, ar };

/* ------------------------------------------------------------------ pluralisation */

/**
 * Arabic has six plural classes; English has two. The count classes follow CLDR:
 * 0→other, 1→one, 2→two, 3..10→few, 11..99→many, 100/101→other.
 */
export function pluralKey(locale: Locale, n: number): keyof Plural {
  if (locale === 'en') return n === 1 ? 'one' : 'other';
  if (n === 0) return 'other';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  const m = n % 100;
  if (m >= 3 && m <= 10) return 'few';
  if (m >= 11 && m <= 99) return 'many';
  return 'other';
}

/* ------------------------------------------------------------------ translation */

const MISSING = Symbol('missing');
function lookup(locale: Locale, key: string): MsgValue | typeof MISSING {
  const v = DICT[locale][key];
  return v === undefined ? MISSING : v;
}

/** {name} placeholders are replaced; a missing variable is left visible so it is obvious in QA. */
function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    vars[name] === undefined ? whole : String(vars[name]));
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let value = lookup(locale, key);
  if (value === MISSING) {
    // Fall back to English so a missing translation degrades to a readable sentence, not a raw key.
    value = lookup('en', key);
    if (value === MISSING) return key;
  }
  if (typeof value === 'string') return interpolate(value, vars);
  const count = Number(vars?.count ?? 0);
  const form = pluralKey(locale, count);
  const text = value[form] ?? value.other;
  return interpolate(text, vars);
}

/** A bound translator: t('common.save', { count: 3 }). */
export type Translator = (key: string, vars?: Record<string, string | number>) => string;
export const translator = (locale: Locale): Translator => (key, vars) => translate(locale, key, vars);

/* ------------------------------------------------------------------ formatting */

/** Latin digits in both languages (one product-wide calendar: Gregorian + Latin numerals). */
export const num = (n: number, min = 0, max = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }).format(n);

export const money = (minorUnits: number) => num(minorUnits / 100, 2, 2);

/** "12:30 ص" / "12:30 pm" */
export function clock12(hhmm: string, locale: Locale): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour24 = Number.isFinite(h) ? h : 0;
  const suffix = locale === 'ar' ? (hour24 < 12 ? 'ص' : 'م') : hour24 < 12 ? 'am' : 'pm';
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

const LOCALE_TAG: Record<Locale, string> = {
  ar: 'ar-SA-u-ca-gregory-nu-latn',
  en: 'en-GB-u-ca-gregory-nu-latn',
};

/** "6 أكتوبر 2026" / "6 October 2026" — parsed at noon UTC so the day never shifts. */
export function formatDate(iso: string, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { ...opts, timeZone: 'UTC' }).format(d);
}

export function formatDateTime(date: Date, locale: Locale, timeZone = 'UTC') {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone,
  }).format(date);
}

/** Picks the closest supported locale from a browser/device tag list ("ar-SA" -> "ar"). */
export function resolveLocale(tags: readonly string[] | undefined | null, fallback: Locale = DEFAULT_LOCALE): Locale {
  for (const tag of tags ?? []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return fallback;
}
