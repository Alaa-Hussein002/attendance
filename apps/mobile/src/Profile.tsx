import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, getBioPref, SessionUser, setBioPref } from './api';
import { useMeta } from './app-context';
import { ROLE_AR } from './format';
import { C, R } from './theme';
import { Button, Card, T, useToast } from './ui';

export default function Profile({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const insets = useSafeAreaInsets(); const toast = useToast(); const { meta } = useMeta();
  const [bio, setBio] = useState(true); const [kind, setKind] = useState('البصمة أو الوجه');
  useEffect(() => { getBioPref().then(setBio); LocalAuthentication.supportedAuthenticationTypesAsync().then((t) => {
    const has = (x: number) => t.includes(x); setKind(has(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'Face ID' : has(LocalAuthentication.AuthenticationType.FINGERPRINT) ? 'البصمة' : 'رمز القفل'); }).catch(() => {}); }, []);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 120, gap: 16 }}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>حسابي</T>
      <Card style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' }}><T style={{ color: C.paper, fontSize: 24, fontWeight: '800' }}>{user.name.slice(0, 1)}</T></View>
        <View style={{ flex: 1 }}><T style={{ fontSize: 18, fontWeight: '800' }}>{user.name}</T><T style={{ color: C.muted }}>{ROLE_AR[user.role] ?? user.role}{meta?.company ? ` · ${meta.company.name}` : ''}</T></View></Card>
      <Card>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '800' }}>تأكيد الهوية بـ {kind}</T><T style={{ color: C.muted, fontSize: 13 }}>عند فتح التطبيق وعند تسجيل الحضور</T></View>
          <Switch value={bio} trackColor={{ true: C.black, false: '#cfccc3' }} onValueChange={async (v) => { setBio(v); await setBioPref(v); toast('info', v ? 'تم تفعيل تأكيد الهوية' : 'تم إيقاف تأكيد الهوية'); }} /></View></Card>
      <Card><T style={{ fontWeight: '800' }}>الجهاز</T><T style={{ color: C.muted, lineHeight: 24 }}>هذا هو الجهاز الوحيد المرتبط بحسابك. لتغيير الجهاز تواصل مع الموارد البشرية لإعادة الضبط.</T></Card>
      <Button kind="ghost" title="تسجيل الخروج" onPress={onLogout} />
      <T style={{ color: '#a8a499', fontSize: 11, textAlign: 'center' }}>الإصدار 0.2.0 · {API_URL}</T>
    </ScrollView>
  );
}
