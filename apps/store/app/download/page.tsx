'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';

export default function Download() {
  const { t } = useI18n();
  const [rel, setRel] = useState<any>(null);
  useEffect(() => { fetch('/api/download/latest').then((r) => r.json()).then(setRel).catch(() => {}); }, []);
  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      <h1>{t('store.download.title')}</h1>
      <p className="lead">{t('store.download.subtitle')}</p>
      {rel && !rel.error && (
        <div className="card">
          <div className="row"><b>{t('store.download.latest')}:</b> {rel.version}</div>
          <div className="row"><b>{t('store.download.size')}:</b> {rel.sizeBytes} bytes</div>
          {rel.sha256 && <div className="row"><b>{t('store.download.sha')}:</b> <code className="mono">{rel.sha256}</code></div>}
          <div style={{ marginTop: 16 }}>
            <a className="btn primary" href={`/releases/${rel.fileName}`} download>{t('store.download.button')}</a>
          </div>
        </div>
      )}
      {!rel || rel.error ? <p style={{ color: 'var(--muted)' }}>{t('store.account.noDownload')}</p> : null}
      <div className="spacer" />
      <h2>{t('store.download.howto')}</h2>
      <ol style={{ color: 'var(--muted)', lineHeight: 2 }}>
        <li>{t('store.download.step1')}</li>
        <li>{t('store.download.step2')}</li>
        <li>{t('store.download.step3')}</li>
        <li>{t('store.download.step4')}</li>
      </ol>
    </div>
  );
}
