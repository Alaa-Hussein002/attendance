'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import Link from 'next/link';

export default function Plans() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => { fetch('/api/plans').then((r) => r.json()).then(setPlans).catch(() => {}); }, []);
  return (
    <div className="container section">
      <h1>{t('store.plans.title')}</h1>
      <p className="lead">{t('store.plans.subtitle')}</p>
      <div className="grid grid-3">
        {plans.filter((p) => p.code !== 'TRIAL').map((p) => (
          <div className="card" key={p.code} style={{ textAlign: 'center' }}>
            <h3>{p.code === 'STARTER' ? t('store.plan.starter.name') : p.code === 'BUSINESS' ? t('store.plan.business.name') : t('store.plan.enterprise.name')}</h3>
            <div className="price">{(p.priceSar / 100).toFixed(0)} <small>SAR / {t('store.pricing.perMonth').replace('/', '').trim()}</small></div>
            <p style={{ color: 'var(--muted)' }}>{p.employees} employees · {p.branches} branches</p>
            <ul style={{ textAlign: 'start', color: 'var(--muted)', fontSize: 14, lineHeight: 1.9, paddingInlineStart: 18 }}>
              <li>{p.features.tasks ? '✓ Tasks' : '—'}</li>
              <li>{p.features.fingerprint ? '✓ Fingerprint' : '—'}</li>
              <li>{p.features.whatsapp ? '✓ WhatsApp' : '—'}</li>
            </ul>
            <Link href={`/checkout?plan=${p.code}`} className="btn primary" style={{ marginTop: 12 }}>{t('store.pricing.choose')}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
