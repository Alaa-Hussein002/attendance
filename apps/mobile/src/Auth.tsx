import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, ApiError, getDeviceUid, meta, request, saveSession } from './api';
import { msg } from './messages';
import { brand, C, R } from './theme';
import { Button, Field, T, useToast } from './ui';

type Step = 'login' | 'otp' | 'password';
const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_: string, a: string, b: string, c: string) => a + '•'.repeat(Math.min(b.length, 5)) + c);
const checks = (pw: string, c: string) => [
  { ok: pw.length >= 8, t: '8 خانات على الأقل' }, { ok: /[A-Za-z\u0600-\u06FF]/.test(pw) && /\d/.test(pw), t: 'تحتوي حرفاً ورقماً' },
  { ok: pw !== '12345678' && !/^(.)\1+$/.test(pw) && pw.length > 0, t: 'ليست كلمة بسيطة أو الافتراضية' }, { ok: pw.length > 0 && pw === c, t: 'التأكيد مطابق' }];

export default function Auth({ onDone }: { onDone: () => void }) {
  const toast = useToast(); const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('login');
  const [f, setF] = useState({ companyCode: '', email: '', password: '' });
  const [info, setInfo] = useState<{ multi: boolean; name?: string }>({ multi: false });
  const [challenge, setChallenge] = useState({ id: '', purpose: '' }); const [code, setCode] = useState('');
  const [token, setToken] = useState(''); const [np, setNp] = useState({ a: '', b: '' }); const [busy, setBusy] = useState(false);
  useEffect(() => { meta().then((m: any) => setInfo({ multi: !!m.multiCompany, name: m.company?.name })).catch(() => {}); }, []);

  async function run(fn: () => Promise<any>) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.status === 'OK') { await saveSession(r); toast('success', `أهلاً ${r.user?.name ?? ''}`); onDone(); }
      else if (r.status === 'OTP_REQUIRED') { setChallenge({ id: r.challengeId, purpose: r.purpose }); setCode(''); setStep('otp'); toast('info', 'تم إرسال رمز التحقق', 'تحقق من بريدك الإلكتروني'); }
      else if (r.status === 'PASSWORD_CHANGE_REQUIRED') { setToken(r.changeToken); setStep('password'); }
    } catch (e) { toast('error', msg(e instanceof ApiError ? e.code : '')); setCode(''); }
    setBusy(false);
  }
  const login = () => run(async () => request('/auth/login', { method: 'POST', auth: false, body: { companyCode: f.companyCode || undefined, email: f.email.trim(), password: f.password, deviceUid: await getDeviceUid() } }));
  const verify = (c = code) => c.length === 6 && run(async () => request('/auth/verify-otp', { method: 'POST', auth: false, body: { challengeId: challenge.id, code: c, deviceUid: await getDeviceUid() } }));
  const setPw = () => run(() => request('/auth/set-password', { method: 'POST', auth: false, body: { changeToken: token, newPassword: np.a } }));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.black }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <View style={{ height: 230 + insets.top, backgroundColor: C.black, justifyContent: 'flex-end', padding: 28, overflow: 'hidden' }}>
          <Image source={brand.markWhite} resizeMode="contain" style={{ position: 'absolute', width: 300, height: 300, left: -70, top: insets.top - 30, opacity: 0.13 }} />
          <Image source={brand.lockupWhite} resizeMode="contain" style={{ width: 190, height: 52, alignSelf: 'flex-end' }} />
          <T style={{ color: '#a8a499', marginTop: 10, fontSize: 12, letterSpacing: 2 }}>MAKE ROOM TO CREATE</T>
        </View>
        <View style={{ flex: 1, backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 24, paddingBottom: insets.bottom + 24, gap: 16, marginTop: -R.xl }}>
          {step === 'login' && (<>
            <T style={{ fontSize: 26, fontWeight: '800' }}>تسجيل الدخول</T>
            <T style={{ color: C.muted }}>{info.name ? `مرحباً بك في ${info.name}` : 'أدخل بياناتك للمتابعة'}</T>
            {info.multi && <Field label="رمز الشركة" ltr autoCapitalize="none" value={f.companyCode} onChangeText={(v) => setF({ ...f, companyCode: v })} />}
            <Field label="البريد الإلكتروني" ltr autoCapitalize="none" keyboardType="email-address" textContentType="username" autoComplete="email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />
            <Field label="كلمة المرور" secureTextEntry textContentType="password" autoComplete="current-password" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} onSubmitEditing={login} />
            <Button title="دخول" onPress={login} loading={busy} disabled={!f.email || !f.password} />
            <T style={{ color: '#a8a499', fontSize: 11, textAlign: 'center' }}>الخادم: {API_URL}</T></>)}
          {step === 'otp' && (<>
            <T style={{ fontSize: 26, fontWeight: '800' }}>رمز التحقق</T>
            <T style={{ color: C.muted, lineHeight: 24 }}>{challenge.purpose === 'DEVICE_CHANGE' ? 'جهاز جديد. ' : 'أول دخول. '}أدخل الرمز المرسل إلى {mask(f.email)} لربط هذا الجهاز بحسابك.</T>
            <Field label="الرمز (6 أرقام)" ltr keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} value={code}
              onChangeText={(v) => { const c = v.replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) verify(c); }} style={{ textAlign: 'center', fontSize: 28, letterSpacing: 10, fontWeight: '700' } as any} />
            <Button title="تأكيد" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}><Button kind="ghost" title="رجوع" onPress={() => setStep('login')} style={{ height: 44 }} /><Button kind="ghost" title="إعادة الإرسال" onPress={login} disabled={busy} style={{ height: 44 }} /></View></>)}
          {step === 'password' && (<>
            <T style={{ fontSize: 26, fontWeight: '800' }}>كلمة مرور جديدة</T>
            <T style={{ color: C.muted, lineHeight: 24 }}>كلمة المرور الحالية افتراضية. اختر كلمة خاصة بك للمتابعة.</T>
            <Field label="كلمة المرور الجديدة" secureTextEntry textContentType="newPassword" value={np.a} onChangeText={(v) => setNp({ ...np, a: v })} />
            <Field label="تأكيد كلمة المرور" secureTextEntry textContentType="newPassword" value={np.b} onChangeText={(v) => setNp({ ...np, b: v })} />
            <View style={{ gap: 4 }}>{checks(np.a, np.b).map((c) => <T key={c.t} style={{ fontSize: 12, color: c.ok ? C.ok : C.muted }}>{c.ok ? '✓' : '○'} {c.t}</T>)}</View>
            <Button title="حفظ ومتابعة" onPress={setPw} loading={busy} disabled={!checks(np.a, np.b).every((c) => c.ok)} /></>)}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
