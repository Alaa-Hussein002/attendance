'use client';
/**
 * React binding for @attendance/i18n. Works in Next.js (web) and in React Native (mobile):
 * the platform specifics (where the preference is stored, which device languages to sniff)
 * are injected by the app through the `load` / `save` / `deviceLocales` props.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
type ReactNode = any;
import { DEFAULT_LOCALE, Locale, dir, isLocale, resolveLocale, translate, Translator } from './index';

export interface I18nState {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: Translator;
  setLocale: (l: Locale) => void;
  ready: boolean;
}

const FALLBACK: I18nState = {
  locale: DEFAULT_LOCALE, dir: dir(DEFAULT_LOCALE),
  t: (k, v) => translate(DEFAULT_LOCALE, k, v),
  setLocale: () => {}, ready: false,
};

const Ctx = createContext<I18nState>(FALLBACK);

export interface I18nProviderProps {
  children: ReactNode;
  /** Locale used until the stored preference is read. */
  initial?: Locale;
  /** Reads the stored preference. Return null when the user never chose one. */
  load?: () => Promise<Locale | null> | Locale | null;
  /** Persists the preference. */
  save?: (l: Locale) => void | Promise<void>;
  /** Device/browser language tags, used when nothing is stored. */
  deviceLocales?: readonly string[];
  /** Fired after the locale changes (the web app refreshes <html lang dir> this way). */
  onChange?: (l: Locale) => void;
}

export function I18nProvider({ children, initial = DEFAULT_LOCALE, load, save, deviceLocales, onChange }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let stored: Locale | null = null;
      try { stored = (await load?.()) ?? null; } catch { stored = null; }
      const next = isLocale(stored) ? stored : resolveLocale(deviceLocales, initial);
      if (!alive) return;
      setLocaleState(next);
      setReady(true);
      onChange?.(next);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    onChange?.(l);
    try { void save?.(l); } catch { /* a failed write must never break the UI */ }
  }, [save, onChange]);

  const value = useMemo<I18nState>(() => ({
    locale, dir: dir(locale), ready,
    t: (k, v) => translate(locale, k, v),
    setLocale,
  }), [locale, ready, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The hook every screen uses: const { t, locale, dir, setLocale } = useI18n(); */
export function useI18n(): I18nState { return useContext(Ctx); }
