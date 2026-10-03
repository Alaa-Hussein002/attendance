'use client';
import { useState } from 'react';
import { api, tokens } from '../../lib/api';

export default function Login() {
  const [f, setF] = useState({ companyCode: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: f });
      if (r.status !== 'OK') throw new Error('هذا الحساب يتطلب جهازاً مرتبطاً؛ استخدم تطبيق الجوال');
      tokens.set(r.accessToken); window.location.href = '/settings/policy';
    } catch (e: any) { setErr(e.message === 'INVALID_CREDENTIALS' ? 'بيانات الدخول غير صحيحة' : e.message); }
    setBusy(false);
  }
  const field = (k: keyof typeof f, label: string, type = 'text') => (
    <div style={{ marginBottom: 12 }}><label>{label}</label>
      <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>);
  return (
    <div className="card" style={{ maxWidth: 380, margin: '60px auto' }}>
      <h1>تسجيل الدخول</h1>
      {err && <div className="errors">{err}</div>}
      {field('companyCode', 'رمز الشركة')}{field('email', 'البريد الإلكتروني', 'email')}{field('password', 'كلمة المرور', 'password')}
      <button className="primary" disabled={busy} onClick={submit}>دخول</button>
    </div>);
}
