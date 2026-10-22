'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import AuthFrame from '../../components/AuthFrame';
import { useMeta, useToast } from '../../components/Providers';
import { Field, OtpInput, PasswordRules, passwordChecks, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { session } from '../../lib/session';

const ZONES: [string, string][] = [['Asia/Riyadh', 'w.setup.zone.Riyadh'], ['Asia/Kuwait', 'w.setup.zone.Kuwait'], ['Asia/Dubai', 'w.setup.zone.Dubai'], ['Asia/Qatar', 'w.setup.zone.Qatar'], ['Asia/Baghdad', 'w.setup.zone.Baghdad'], ['Africa/Cairo', 'w.setup.zone.Cairo'], ['Asia/Amman', 'w.setup.zone.Amman'], ['UTC', 'w.setup.zone.UTC']];
const COMPANY_NAME = 'بيت المصور';
const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•'.repeat(Math.min(b.length, 5)) + c);

export default function Setup() {
  const router = useRouter(); const toast = useToast(); const { meta } = useMeta(); const { t } = useI18n();
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState(() => ({ adminName: '', email: '', password: '', confirm: '', timezone: 'Asia/Riyadh', setupKey: '' }));
  const [challenge, setChallenge] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);

  useEffect(() => { if (meta && !meta.needsSetup) router.replace('/login'); }, [meta, router]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const valid = f.adminName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && passwordChecks(f.password, f.confirm).every((c) => c.ok);

  async function start() {
    setBusy(true); setErr(null);
    try { const r = await api('/setup/start', { method: 'POST', auth: false, body: { companyName: COMPANY_NAME, adminName: f.adminName, email: f.email, password: f.password, timezone: f.timezone, setupKey: f.setupKey || undefined } });
      setChallenge(r.challengeId); setCode(''); setStep(2); toast.info(t('w.setup.sent'), t('w.setup.sentTo', { email: mask(f.email) })); }
    catch (e) { setErr(e); }
    setBusy(false);
  }
  async function verify(c = code) {
    if (c.length !== 6) return; setBusy(true); setErr(null);
    try { const r = await api('/auth/verify-otp', { method: 'POST', auth: false, body: { challengeId: challenge, code: c } });
      session.save(r); toast.success(t('w.setup.created'), t('w.setup.createdBody')); router.replace('/settings?welcome=1'); }
    catch (e) { setErr(e); setCode(''); }
    setBusy(false);
  }

  return (
    <AuthFrame>
      <div className="steps"><i className="on" /><i className={step === 2 ? 'on' : ''} /></div>
      {step === 1 ? (<>
        <h1>{t('w.setup.title')}</h1><p>{t('w.setup.sub')}</p>
        {meta?.existingData && <div className="alert warn" style={{ marginBottom: 14 }}><span>⚠</span><span>{t('w.setup.existingData')}</span></div>}
        {err && <div className="alert err" style={{ marginBottom: 14 }}>{errText(err, t)}</div>}
        <div className="stack">
          <Field label={t('w.setup.adminName')}><input value={f.adminName} onChange={set('adminName')} autoComplete="name" /></Field>
          <Field label={t('w.setup.email')} help={t('w.setup.emailHelp')}><input type="email" dir="ltr" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
          <div className="grid"><Field label={t('w.setup.password')}><input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
            <Field label={t('w.setup.confirm')}><input type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field></div>
          <PasswordRules pw={f.password} confirm={f.confirm} />
          <Field label={t('w.setup.tz')} help={t('w.setup.tzHelp')}><select value={f.timezone} onChange={set('timezone')}>{ZONES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></Field>
          <button className="btn primary" disabled={!valid || busy} onClick={start}>{busy ? <Spinner /> : t('w.setup.sendCode')}</button>
        </div></>) : (<>
        <h1>{t('w.setup.otpTitle')}</h1><p>{t('w.setup.otpBody', { email: mask(f.email) })}</p>
        {err && <div className="alert err" style={{ marginBottom: 14 }}>{errText(err, t)}</div>}
        <div className="stack">
          <OtpInput value={code} onChange={setCode} onComplete={verify} />
          <button className="btn primary" disabled={code.length !== 6 || busy} onClick={() => verify()}>{busy ? <Spinner /> : t('w.setup.verify')}</button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost sm" onClick={() => { setStep(1); setErr(null); }}>{t('w.setup.edit')}</button>
            <button className="btn ghost sm" disabled={busy} onClick={start}>{t('w.setup.resend')}</button></div>
        </div></>)}
    </AuthFrame>
  );
}
