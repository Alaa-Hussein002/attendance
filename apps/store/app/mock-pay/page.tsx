'use client';
import { useI18n } from '@attendance/i18n/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function MockPayInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const orderId = params.get('order') ?? '';
  return (
    <div className="container section" style={{ maxWidth: 480, textAlign: 'center' }}>
      <h1>{t('store.mock.title')}</h1>
      <p className="lead">{t('store.mock.body')}</p>
      <a className="btn primary" href={`/api/mock-pay?order=${orderId}`}>{t('store.mock.complete')}</a>
    </div>
  );
}

export default function MockPay() {
  return <Suspense fallback={null}><MockPayInner /></Suspense>;
}
