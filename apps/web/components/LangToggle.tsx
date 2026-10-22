'use client';
import { useI18n } from '@attendance/i18n/react';
import { useRouter } from 'next/navigation';

/** Language switch for the public screens (login / setup), where the app shell is not shown. */
export default function LangToggle() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const next = locale === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      className="btn sm ghost auth-lang"
      onClick={() => { setLocale(next); document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`; router.refresh(); }}
    >
      {next === 'en' ? t('common.english') : t('common.arabic')}
    </button>
  );
}
