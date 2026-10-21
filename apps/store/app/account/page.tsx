'use client';
import { useState } from 'react';
import { useI18n } from '@attendance/i18n/react';

export default function Account() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [serial, setSerial] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(''); setData(null);
    try {
      const res = await fetch('/api/account/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, serial }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'not_found');
      setData(d);
    } catch { setErr(t('store.account.notFound')); }
    finally { setBusy(false); }
  }

  async function resend() {
    await fetch('/api/account/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, serial }) });
    alert(t('store.account.resendDone'));
  }

  const dl = data?.download;

  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      <h1>{t('store.account.title')}</h1>
      <p className="lead">{t('store.account.subtitle')}</p>

      {!data && (
        <form className="form" onSubmit={lookup}>
          <label>{t('store.account.email')}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>{t('store.account.serial')}<input required value={serial} onChange={(e) => setSerial(e.target.value)} /></label>
          <button className="btn primary" disabled={busy}>{busy ? t('store.common.loading') : t('store.account.lookup')}</button>
          {err && <div className="alert">{err}</div>}
        </form>
      )}

      {data && (
        <div className="card">
          <h2>{data.customer.company || data.customer.name || data.customer.email}</h2>
          <p style={{ color: 'var(--muted)' }}>{data.customer.email}</p>
          <div className="spacer" />
          <div className="row"><b>{t('store.account.plan')}:</b> {data.license.planCode}</div>
          <div className="row"><b>{t('store.account.validUntil')}:</b> {data.license.validUntil}</div>
          <div className="row"><b>{t('store.account.serialLabel')}:</b> <code className="mono">{data.license.serial}</code></div>
          <div style={{ marginTop: 12 }}>
            <b>{t('store.account.keyLabel')}</b>
            <pre className="mono" style={{ background: '#f3f1ec', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{data.license.key}</pre>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>{t('store.account.keyHint')}</p>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={resend}>{t('store.account.resend')}</button>
            {dl && <a className="btn primary" href={`/api/download/file?version=${dl.version}`}>{t('store.account.download')}</a>}
          </div>
          {!dl && <p style={{ color: 'var(--muted)', fontSize: 13 }}>{t('store.account.noDownload')}</p>}
          <div className="spacer" />
          <a className="btn ghost" href="/plans">{t('store.account.renew')}</a>
        </div>
      )}
    </div>
  );
}
