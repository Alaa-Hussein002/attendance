'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthFrame from '../../components/AuthFrame';
import { useMeta, useToast } from '../../components/Providers';
import { Field, OtpInput, PasswordRules, passwordChecks, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { session } from '../../lib/session';

const ZONES: [string, string][] = [['Asia/Riyadh', 'الرياض (توقيت السعودية)'], ['Asia/Kuwait', 'الكويت'], ['Asia/Dubai', 'دبي'], ['Asia/Qatar', 'الدوحة'], ['Asia/Baghdad', 'بغداد'], ['Africa/Cairo', 'القاهرة'], ['Asia/Amman', 'عمّان'], ['UTC', 'التوقيت العالمي (UTC)']];
const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•'.repeat(Math.min(b.length, 5)) + c);

export default function Setup() {
  const router = useRouter(); const toast = useToast(); const { meta } = useMeta();
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState({ companyName: 'بيت المصور', adminName: '', email: '', password: '', confirm: '', timezone: 'Asia/Riyadh', setupKey: '' });
  const [challenge, setChallenge] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  useEffect(() => { if (meta && !meta.needsSetup) router.replace('/login'); }, [meta, router]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const valid = f.companyName.trim() && f.adminName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && passwordChecks(f.password, f.confirm).every((c) => c.ok);

  async function start() {
    setBusy(true); setErr('');
    try { const r = await api('/setup/start', { method: 'POST', auth: false, body: { companyName: f.companyName, adminName: f.adminName, email: f.email, password: f.password, timezone: f.timezone, setupKey: f.setupKey || undefined } });
      setChallenge(r.challengeId); setCode(''); setStep(2); toast.info('تم إرسال رمز التحقق', `إلى ${mask(f.email)}`); }
    catch (e) { setErr(errText(e)); }
    setBusy(false);
  }
  async function verify(c = code) {
    if (c.length !== 6) return; setBusy(true); setErr('');
    try { const r = await api('/auth/verify-otp', { method: 'POST', auth: false, body: { challengeId: challenge, code: c } });
      session.save(r); toast.success('تم إنشاء حساب مدير النظام', 'ابدأ بضبط الدوام ومراحل الحضور'); router.replace('/settings?welcome=1'); }
    catch (e) { setErr(errText(e)); setCode(''); }
    setBusy(false);
  }

  return (
    <AuthFrame>
      <div className="steps"><i className="on" /><i className={step === 2 ? 'on' : ''} /></div>
      {step === 1 ? (<>
        <h1>تهيئة النظام</h1><p>أنشئ حساب مدير النظام. سنرسل رمز تحقق إلى بريدك لتأكيده.</p>
        {meta?.existingData && <div className="alert warn" style={{ marginBottom: 14 }}><span>⚠</span><span>توجد بيانات تجريبية سابقة غير مفعّلة. إكمال التهيئة سيحذفها ويبدأ نظاماً جديداً نظيفاً.</span></div>}
        {err && <div className="alert err" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="stack">
          <Field label="اسم المنشأة"><input value={f.companyName} onChange={set('companyName')} /></Field>
          <Field label="اسم مدير النظام"><input value={f.adminName} onChange={set('adminName')} autoComplete="name" /></Field>
          <Field label="البريد الإلكتروني" help="سيصلك عليه رمز التحقق"><input type="email" dir="ltr" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
          <div className="grid"><Field label="كلمة المرور"><input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
            <Field label="تأكيد كلمة المرور"><input type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field></div>
          <PasswordRules pw={f.password} confirm={f.confirm} />
          <Field label="المنطقة الزمنية" help="التاريخ والوقت في كل النظام بحسب هذه المنطقة وبالتقويم الميلادي"><select value={f.timezone} onChange={set('timezone')}>{ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <button className="btn primary" disabled={!valid || busy} onClick={start}>{busy ? <Spinner /> : 'إرسال رمز التحقق'}</button>
        </div></>) : (<>
        <h1>أدخل رمز التحقق</h1><p>أرسلنا رمزاً من 6 أرقام إلى <b className="num">{mask(f.email)}</b>. تحقق من صندوق الوارد أو الرسائل غير المرغوبة.</p>
        {err && <div className="alert err" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="stack">
          <OtpInput value={code} onChange={setCode} onComplete={verify} />
          <button className="btn primary" disabled={code.length !== 6 || busy} onClick={() => verify()}>{busy ? <Spinner /> : 'تأكيد وإنشاء الحساب'}</button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost sm" onClick={() => { setStep(1); setErr(''); }}>تعديل البيانات</button>
            <button className="btn ghost sm" disabled={busy} onClick={start}>إعادة إرسال الرمز</button></div>
        </div></>)}
    </AuthFrame>
  );
}
