'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthFrame from '../../components/AuthFrame';
import { useMeta, useToast } from '../../components/Providers';
import { Field, OtpInput, PasswordRules, passwordChecks, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { homeFor, session } from '../../lib/session';
import { useI18n } from '@attendance/i18n/react';

type Step = 'login' | 'otp' | 'password';
const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•'.repeat(Math.min(b.length, 5)) + c);

export default function Login() {
  const router = useRouter(); const toast = useToast(); const { meta } = useMeta();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('login');
  const [f, setF] = useState({ companyCode: '', email: '', password: '' });
  const [challenge, setChallenge] = useState(''); const [code, setCode] = useState('');
  const [changeToken, setChangeToken] = useState(''); const [np, setNp] = useState({ a: '', b: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  useEffect(() => { const u = session.user(); if (session.access() && u) router.replace(homeFor(u.role)); }, [router]);
  useEffect(() => { if (meta?.needsSetup) router.replace('/setup'); }, [meta, router]);

  const finish = (r: any) => { session.save(r); router.replace(homeFor(r.user.role)); };
  const handle = (r: any) => {
    if (r.status === 'OK') return finish(r);
    if (r.status === 'OTP_REQUIRED') { setChallenge(r.challengeId); setCode(''); setStep('otp'); toast.info(t('w.login.otp.sent')); return; }
    if (r.status === 'PASSWORD_CHANGE_REQUIRED') { setChangeToken(r.changeToken); setStep('password'); }
  };
  async function run(fn: () => Promise<any>) { setBusy(true); setErr(''); try { handle(await fn()); } catch (e) { setErr(errText(e)); if (step === 'otp') setCode(''); } setBusy(false); }

  const login = () => run(() => api('/auth/login', { method: 'POST', auth: false, body: { companyCode: f.companyCode || undefined, email: f.email, password: f.password } }));
  const verify = (c = code) => c.length === 6 && run(() => api('/auth/verify-otp', { method: 'POST', auth: false, body: { challengeId: challenge, code: c } }));
  const savePw = () => run(() => api('/auth/set-password', { method: 'POST', auth: false, body: { changeToken, newPassword: np.a } }));

  return (
    <AuthFrame>
      {step === 'login' && (<>
        <h1>{t('w.login.title')}</h1><p>{meta?.company ? <>{t('w.login.welcomeCompany')} <b>{meta.company.name}</b></> : t('w.login.welcomeGeneric')}</p>
        {err && <div className="alert err" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="stack" onKeyDown={(e) => e.key === 'Enter' && f.email && f.password && !busy && login()}>
          {meta?.multiCompany && <Field label={t('w.login.companyCode')}><input dir="ltr" value={f.companyCode} onChange={(e) => setF({ ...f, companyCode: e.target.value })} /></Field>}
          <Field label={t('w.login.email')}><input type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="username" autoFocus /></Field>
          <Field label={t('w.login.password')}><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></Field>
          <button className="btn primary" disabled={!f.email || !f.password || busy} onClick={login}>{busy ? <Spinner /> : t('w.login.submit')}</button>
        </div></>)}
      {step === 'otp' && (<>
        <h1>{t('w.login.otp.title')}</h1><p>{t('w.login.otp.hint', { email: mask(f.email) })}</p>
        {err && <div className="alert err" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="stack"><OtpInput value={code} onChange={setCode} onComplete={verify} />
          <button className="btn primary" disabled={code.length !== 6 || busy} onClick={() => verify()}>{busy ? <Spinner /> : t('w.login.otp.verify')}</button>
          <div className="row" style={{ justifyContent: 'space-between' }}><button className="btn ghost sm" onClick={() => { setStep('login'); setErr(''); }}>{t('common.back')}</button>
            <button className="btn ghost sm" disabled={busy} onClick={login}>{t('w.login.otp.resend')}</button></div></div></>)}
      {step === 'password' && (<>
        <h1>{t('w.login.firstLogin.title')}</h1><p>{t('w.login.firstLogin.hint')}</p>
        {err && <div className="alert err" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="stack">
          <Field label={t('w.login.newPassword')}><input type="password" value={np.a} onChange={(e) => setNp({ ...np, a: e.target.value })} autoComplete="new-password" autoFocus /></Field>
          <Field label={t('w.login.confirmPassword')}><input type="password" value={np.b} onChange={(e) => setNp({ ...np, b: e.target.value })} autoComplete="new-password" /></Field>
          <PasswordRules pw={np.a} confirm={np.b} />
          <button className="btn primary" disabled={busy || !passwordChecks(np.a, np.b).every((c) => c.ok)} onClick={savePw}>{busy ? <Spinner /> : t('w.login.setPassword')}</button></div></>)}
    </AuthFrame>
  );
}
