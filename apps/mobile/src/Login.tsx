import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ApiError, getDeviceUid, request, saveSession } from './api';
import { msg } from './messages';
import { s } from './styles';

export default function Login({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ companyCode: '', email: '', password: '' });
  const [challenge, setChallenge] = useState<{ id: string; purpose: string } | null>(null);
  const [code, setCode] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<void>) { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(msg(e instanceof ApiError ? e.code : '')); } setBusy(false); }
  const login = () => go(async () => {
    const r = await request('/auth/login', { method: 'POST', auth: false, body: { ...f, email: f.email.trim(), deviceUid: await getDeviceUid() } });
    if (r.status === 'OTP_REQUIRED') return setChallenge({ id: r.challengeId, purpose: r.purpose });
    await saveSession(r); onDone();
  });
  const verify = () => go(async () => {
    const r = await request('/auth/verify-otp', { method: 'POST', auth: false, body: { challengeId: challenge!.id, code: code.trim(), deviceUid: await getDeviceUid() } });
    await saveSession(r); onDone();
  });

  if (challenge) return (
    <View style={s.screen}><Text style={s.h1}>رمز التحقق</Text>
      <Text style={s.hint}>{challenge.purpose === 'DEVICE_CHANGE' ? 'جهاز جديد: أدخل الرمز المرسل إليك لربطه بحسابك.' : 'أول دخول: أدخل الرمز المرسل إليك لربط هذا الجهاز بحسابك.'}</Text>
      {!!err && <Text style={s.err}>{err}</Text>}
      <TextInput style={[s.input, { textAlign: 'center', letterSpacing: 8 }]} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
      <TouchableOpacity style={s.btn} disabled={busy || code.length !== 6} onPress={verify}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>تأكيد</Text>}</TouchableOpacity>
      <TouchableOpacity onPress={() => { setChallenge(null); setCode(''); }}><Text style={s.link}>رجوع</Text></TouchableOpacity></View>);

  const field = (k: keyof typeof f, label: string, extra: object = {}) => (<View><Text style={s.label}>{label}</Text>
    <TextInput style={s.input} autoCapitalize="none" value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} {...extra} /></View>);
  return (<View style={s.screen}><Text style={s.h1}>تسجيل الدخول</Text>{!!err && <Text style={s.err}>{err}</Text>}
    {field('companyCode', 'رمز الشركة')}{field('email', 'البريد الإلكتروني', { keyboardType: 'email-address' })}{field('password', 'كلمة المرور', { secureTextEntry: true })}
    <TouchableOpacity style={s.btn} disabled={busy} onPress={login}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>دخول</Text>}</TouchableOpacity></View>);
}
