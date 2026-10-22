import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { API_URL, ApiError, getDeviceUid, request, saveSession } from './api';
import { msg } from './messages';
import { brand, C, R } from './theme';
import { Button, Field, T, useToast } from './ui';

type Step = 'login' | 'otp' | 'password';
const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_: string, a: string, b: string, c: string) => a + '•'.repeat(Math.min(b.length, 5)) + c);
const checks = (pw: string, confirm: string) => [
  { ok: pw.length >= 8, key: 'm.password.min' },
  { ok: /[A-Za-z\u0600-\u06FF]/.test(pw) && /\d/.test(pw), key: 'm.password.letterDigit' },
  { ok: pw !== '12345678' && !/^(.)\1+$/.test(pw) && pw.length > 0, key: 'm.password.simple' },
  { ok: pw.length > 0 && pw === confirm, key: 'm.password.match' },
];

export default function Auth({ onDone }: { onDone: () => void }) {
  const { t, dir, locale, setLocale } = useI18n();
  const toast = useToast(); const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('login');
  const [f, setF] = useState({ email: '', password: '' });
  const [challenge, setChallenge] = useState({ id: '', purpose: '' }); const [code, setCode] = useState('');
  const [token, setToken] = useState(''); const [np, setNp] = useState({ a: '', b: '' }); const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<any>) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.status === 'OK') { await saveSession(r); toast('success', t('m.auth.welcomeName', { name: r.user?.name ?? '' })); onDone(); }
      else if (r.status === 'OTP_REQUIRED') { setChallenge({ id: r.challengeId, purpose: r.purpose }); setCode(''); setStep('otp'); toast('info', t('m.auth.sentTitle'), t('m.auth.sentBody')); }
      else if (r.status === 'PASSWORD_CHANGE_REQUIRED') { setToken(r.changeToken); setStep('password'); }
    } catch (e) { toast('error', msg(e instanceof ApiError ? e.code : '', t)); setCode(''); }
    setBusy(false);
  }
  const login = () => run(async () => request('/auth/login', { method: 'POST', auth: false, body: { email: f.email.trim(), password: f.password, deviceUid: await getDeviceUid() } }));
  const verify = (c = code) => c.length === 6 && run(async () => request('/auth/verify-otp', { method: 'POST', auth: false, body: { challengeId: challenge.id, code: c, deviceUid: await getDeviceUid() } }));
  const setPw = () => run(() => request('/auth/set-password', { method: 'POST', auth: false, body: { changeToken: token, newPassword: np.a } }));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.black }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <View style={{ height: 230 + insets.top, backgroundColor: C.black, justifyContent: 'flex-end', padding: 28, overflow: 'hidden' }}>
          <Image source={brand.markWhite} resizeMode="contain" style={{ position: 'absolute', width: 300, height: 300, left: -70, top: insets.top - 30, opacity: 0.13 }} />
          <Pressable onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')} hitSlop={10} style={{ position: 'absolute', top: insets.top + 12, right: dir === 'rtl' ? undefined : 20, left: dir === 'rtl' ? 20 : undefined, borderWidth: 1, borderColor: '#3a3a3e', borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: '#1b1b1e' }}>
            <T style={{ color: '#d7d3c8', fontSize: 12, fontWeight: '700' }}>{locale === 'ar' ? t('m.profile.english') : t('m.profile.arabic')}</T></Pressable>
          <Image source={brand.lockupWhite} resizeMode="contain" style={{ width: 190, height: 52, alignSelf: 'flex-end' }} />
          <T style={{ color: '#a8a499', marginTop: 10, fontSize: 12, letterSpacing: locale === 'en' ? 2 : 0 }}>{t('m.auth.claim')}</T>
        </View>
        <View style={{ flex: 1, backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 24, paddingBottom: insets.bottom + 24, gap: 16, marginTop: -R.xl }}>
          {step === 'login' && (<>
            <T style={{ fontSize: 26, fontWeight: '800' }}>{t('m.auth.title')}</T>
            <T style={{ color: C.muted }}>{t('m.auth.welcome', { company: t('m.app.title') })}</T>
            <Field label={t('m.auth.email')} ltr autoCapitalize="none" keyboardType="email-address" textContentType="username" autoComplete="email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />
            <Field label={t('m.auth.password')} secureTextEntry textContentType="password" autoComplete="current-password" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} onSubmitEditing={login} />
            <Button title={t('m.auth.submit')} onPress={login} loading={busy} disabled={!f.email || !f.password} />
            <T style={{ color: '#a8a499', fontSize: 11, textAlign: 'center' }}>{t('m.auth.server', { url: API_URL })}</T></>)}
          {step === 'otp' && (<>
            <T style={{ fontSize: 26, fontWeight: '800' }}>{t('m.auth.otpTitle')}</T>
            <T style={{ color: C.muted, lineHeight: 24 }}>{t('m.auth.otpBody', { prefix: challenge.purpose === 'DEVICE_CHANGE' ? t('m.auth.otpNewDevice') : t('m.auth.otpFirstLogin'), email: mask(f.email) })}</T>
            <Field label={t('m.auth.codeLabel')} ltr keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} value={code}
              onChangeText={(v) => { const c = v.replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) verify(c); }} style={{ textAlign: 'center', fontSize: 28, letterSpacing: 10, fontWeight: '700' } as any} />
            <Button title={t('m.auth.verify')} onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
            <View style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', justifyContent: 'space-between' }}><Button kind="ghost" title={t('m.auth.back')} onPress={() => setStep('login')} style={{ height: 44 }} /><Button kind="ghost" title={t('m.auth.resend')} onPress={login} disabled={busy} style={{ height: 44 }} /></View></>)}
          {step === 'password' && (<>
            <T style={{ fontSize: 26, fontWeight: '800' }}>{t('m.auth.newPasswordTitle')}</T>
            <T style={{ color: C.muted, lineHeight: 24 }}>{t('m.auth.newPasswordHint')}</T>
            <Field label={t('m.auth.newPassword')} secureTextEntry textContentType="newPassword" value={np.a} onChangeText={(v) => setNp({ ...np, a: v })} />
            <Field label={t('m.auth.confirmPassword')} secureTextEntry textContentType="newPassword" value={np.b} onChangeText={(v) => setNp({ ...np, b: v })} />
            <View style={{ gap: 4 }}>{checks(np.a, np.b).map((c) => <T key={c.key} style={{ fontSize: 12, color: c.ok ? C.ok : C.muted }}>{c.ok ? '✓' : '○'} {t(c.key)}</T>)}</View>
            <Button title={t('m.auth.saveContinue')} onPress={setPw} loading={busy} disabled={!checks(np.a, np.b).every((c) => c.ok)} /></>)}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
