'use client';
import { Suspense, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useSearchParams, useRouter } from 'next/navigation';

function CheckoutInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const plan = params.get('plan') ?? 'BUSINESS';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: plan, email, name, company, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'checkout_failed');
      // redirect to payment page
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <h1>{t('store.checkout.title')}</h1>
      <p className="lead">{t('store.checkout.subtitle', { plan })}</p>
      <form className="form" onSubmit={submit}>
        <label>{t('store.checkout.email')}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>{t('store.checkout.name')}<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t('store.checkout.company')}<input required value={company} onChange={(e) => setCompany(e.target.value)} /></label>
        <label>{t('store.checkout.phone')}<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <button className="btn primary" disabled={busy}>{busy ? t('store.checkout.processing') : t('store.checkout.pay', { amount: '' })}</button>
        {err && <div className="alert">{err}</div>}
      </form>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 16 }}>{t('store.checkout.secure')}</p>
      <p><a href="/plans">{t('store.checkout.back')}</a></p>
    </div>
  );
}

export default function Checkout() {
  return <Suspense fallback={<div className="container section">Loading…</div>}><CheckoutInner /></Suspense>;
}
