import { describe, expect, it } from 'vitest';
import { ar, dir, en, formatDate, isLocale, num, pluralKey, resolveLocale, translate } from './index';

describe('@attendance/i18n', () => {
  it('ar and en expose exactly the same keys', () => {
    const enKeys = Object.keys(en).sort();
    const arKeys = Object.keys(ar).sort();
    expect(arKeys.filter((k) => !(k in en))).toEqual([]);
    expect(enKeys.filter((k) => !(k in ar))).toEqual([]);
  });

  it('translates and interpolates', () => {
    expect(translate('en', 'common.save')).toBe('Save');
    expect(translate('ar', 'common.save')).toBe('حفظ');
    expect(translate('en', 'w.app.tagline')).toBe('Attendance and payroll for studios');
  });

  it('falls back to English for a key missing in Arabic, and returns the key when unknown', () => {
    expect(translate('ar', 'err.INVALID_CODE')).toBe('الرمز غير صحيح');
    expect(translate('en', 'nope.nope')).toBe('nope.nope');
  });

  it('keeps an unfilled placeholder visible so QA spots it', () => {
    expect(translate('en', 'common.save')).not.toContain('{');
  });

  it('picks the Arabic plural class from the count', () => {
    expect(pluralKey('en', 1)).toBe('one');
    expect(pluralKey('en', 3)).toBe('other');
    expect(pluralKey('ar', 1)).toBe('one');
    expect(pluralKey('ar', 2)).toBe('two');
    expect(pluralKey('ar', 5)).toBe('few');
    expect(pluralKey('ar', 15)).toBe('many');
    expect(pluralKey('ar', 100)).toBe('other');
  });

  it('formats numbers with Latin digits in both languages', () => {
    expect(num(1234.5, 2)).toBe('1,234.50');
  });

  it('formats dates on the Gregorian calendar in both languages', () => {
    expect(formatDate('2026-10-06', 'en')).toContain('2026');
    expect(formatDate('2026-10-06', 'ar')).toContain('2026');
  });

  it('detects the locale from a browser tag list', () => {
    expect(resolveLocale(['ar-SA', 'en-GB'])).toBe('ar');
    expect(resolveLocale(['en-US'])).toBe('en');
    expect(resolveLocale(['fr-FR'])).toBe('ar');
    expect(resolveLocale(undefined)).toBe('ar');
  });

  it('knows the writing direction of each locale', () => {
    expect(dir('ar')).toBe('rtl');
    expect(dir('en')).toBe('ltr');
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
