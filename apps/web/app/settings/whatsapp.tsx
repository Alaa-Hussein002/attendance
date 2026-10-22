'use client';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useToast } from '../../components/Providers';
import { Field, Spinner, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';

const SAMPLES: { key: string; label: string; sample: string }[] = [
  { key: 'templateDaily', label: 'w.wa.templateDaily', sample: 'w.wa.sampleDaily' },
  { key: 'templateReminder', label: 'w.wa.templateReminder', sample: 'w.wa.sampleReminder' },
  { key: 'templateAssigned', label: 'w.wa.templateAssigned', sample: 'w.wa.sampleAssigned' },
];
const blank = { enabled: false, phoneNumberId: '', businessAccountId: '', hasToken: false, templateDaily: '', templateReminder: '', templateAssigned: '', language: 'ar' };

export default function WhatsappTab() {
  const { t } = useI18n();
  const toast = useToast();
  const [c, setC] = useState<any>(blank); const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [to, setTo] = useState(''); const [testing, setTesting] = useState(false); const [ready, setReady] = useState(false);
  const load = useCallback(() => api('/whatsapp/config').then((r) => { setC(r); setReady(true); }).catch((e) => toast.error(t('w.wa.loadError'), errText(e, t))), [toast, t]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setC({ ...c, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try { const r = await api('/whatsapp/config', { method: 'PUT', body: { ...c, accessToken: token || undefined } }); setC(r); setToken(''); toast.success(t('w.wa.saved'), r.enabled ? t('w.wa.enabled') : t('w.wa.disabled')); }
    catch (e) { toast.error(t('w.wa.saveError'), errText(e, t)); }
    setBusy(false);
  }
  async function test() { setTesting(true); try { const r = await api('/whatsapp/test', { method: 'POST', body: { to } }); r.ok ? toast.success(t('w.wa.testDone')) : toast.error(t('w.wa.testFail'), r.error); } catch (e) { toast.error(t('w.wa.testError'), errText(e, t)); } setTesting(false); }
  if (!ready) return <div className="empty"><Spinner /></div>;

  return (<>
    <div className="alert warn" style={{ marginBottom: 18 }}><span>ⓘ</span><span>{t('w.wa.body')}</span></div>
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><div><h2>{t('w.wa.title')}</h2><p className="sub" style={{ margin: 0 }}>{t('w.wa.sub')}</p></div>
      <Switch checked={c.enabled} onChange={(v) => setC({ ...c, enabled: v })} /></div></div>
    <div className="card"><h2>{t('w.wa.connection')}</h2><p className="sub">{t('w.wa.connectionSub')}</p>
      <div className="grid"><Field label={t('w.wa.phoneId')}><input dir="ltr" value={c.phoneNumberId} onChange={set('phoneNumberId')} /></Field>
        <Field label={t('w.wa.businessId')}><input dir="ltr" value={c.businessAccountId} onChange={set('businessAccountId')} /></Field>
        <Field label={t('w.wa.token')} help={c.hasToken ? t('w.wa.tokenSaved') : t('w.wa.tokenHelp')}><input type="password" dir="ltr" autoComplete="off" value={token} placeholder={c.hasToken ? t('w.wa.tokenPh') : ''} onChange={(e) => setToken(e.target.value)} /></Field>
        <Field label={t('w.wa.language')}><select value={c.language} onChange={set('language')}><option value="ar">{t('common.arabic')} (ar)</option><option value="en">{t('common.english')} (en)</option></select></Field></div></div>
    <div className="card"><h2>{t('w.wa.templates')}</h2><p className="sub">{t('w.wa.templatesSub')}</p>
      <div className="stack">{SAMPLES.map((s) => (<div key={s.key} className="grid"><Field label={t(s.label)}><input dir="ltr" value={c[s.key]} onChange={set(s.key)} placeholder={t('w.wa.templatePh')} /></Field><div className="small muted" style={{ paddingTop: 28 }}>{t('w.wa.suggested', { text: t(s.sample) })}</div></div>))}</div></div>
    <div className="card"><h2>{t('w.wa.test')}</h2><p className="sub">{t('w.wa.testSub')}</p>
      <div className="row"><div style={{ width: 260 }}><input dir="ltr" placeholder={t('w.wa.phonePh')} value={to} onChange={(e) => setTo(e.target.value)} /></div><button className="btn" disabled={testing || !to.trim()} onClick={test}>{testing ? <Spinner /> : t('w.wa.sendTest')}</button></div></div>
    <div className="savebar"><span className="small">{c.enabled ? t('w.wa.enabled') : t('w.wa.disabled')}</span><button className="btn go" disabled={busy} onClick={save}>{busy ? <Spinner /> : t('w.wa.save')}</button></div>
  </>);
}
