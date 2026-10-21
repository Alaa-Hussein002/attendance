'use client';
import { ReactNode } from 'react';
import { I18nProvider as Shared } from '@attendance/i18n/react';
import { isLocale } from '@attendance/i18n';

export default function I18nClientProvider({ children, initialLocale }: { children: ReactNode; initialLocale: string }) {
  return (
    <Shared
      initial={isLocale(initialLocale) ? initialLocale : 'ar'}
      deviceLocales={typeof navigator !== 'undefined' ? navigator.languages : undefined}
      load={() => {
        const m = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
        const v = m ? decodeURIComponent(m[1]) : null;
        return isLocale(v) ? v : null;
      }}
      save={(l) => { document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`; }}
      onChange={(l) => { document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'; }}
    >
      {children}
    </Shared>
  );
}
