import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { isLocale, dir, resolveLocale, DEFAULT_LOCALE } from '@attendance/i18n';
import Providers from '../components/Providers';
import Shell from '../components/Shell';
import I18nClientProvider from '../components/I18nClientProvider';

export const metadata = { title: 'Bayt Al Mosawer — Attendance & Payroll', description: 'Attendance and payroll for photo studios.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  const raw = cookies().get('locale')?.value;
  // First visit: match the browser's preferred language instead of flashing the default Arabic shell.
  const accept = (headers().get('accept-language') ?? '').split(',').map((s) => s.split(';')[0].trim()).filter(Boolean);
  const locale = isLocale(raw) ? raw : resolveLocale(accept, DEFAULT_LOCALE);
  return (
    <html lang={locale} dir={dir(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><I18nClientProvider initialLocale={locale}><Providers><Shell>{children}</Shell></Providers></I18nClientProvider></body>
    </html>
  );
}
