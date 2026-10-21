import { cookies } from 'next/headers';
import { dir, isLocale, DEFAULT_LOCALE } from '@attendance/i18n';
import { I18nProvider } from '../components/I18nProvider';
import './globals.css';

export const metadata = { title: 'Bayt Al Mosawer — Attendance & payroll', description: 'Attendance, payroll and subscription for photo studios.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const raw = cookies().get('locale')?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return (
    <html lang={locale} dir={dir(locale)}>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
