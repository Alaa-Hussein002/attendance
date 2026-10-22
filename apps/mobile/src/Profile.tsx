import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { API_URL, getBioPref, SessionUser, setBioPref } from './api';
import { useMeta } from './app-context';
import { roleLabel } from './format';
import { C, R } from './theme';
import { Button, Card, Segmented, T, useToast } from './ui';

export default function Profile({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { t, dir, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets(); const toast = useToast(); const { meta } = useMeta();
  const [bio, setBio] = useState(true); const [kind, setKind] = useState('m.profile.kind.bio');
  useEffect(() => { getBioPref().then(setBio); LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
    const has = (x: number) => types.includes(x);
    setKind(has(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'm.profile.kind.face' : has(LocalAuthentication.AuthenticationType.FINGERPRINT) ? 'm.profile.kind.finger' : 'm.profile.kind.passcode');
  }).catch(() => {}); }, []);
  const row = dir === 'rtl' ? 'row-reverse' : 'row';
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 120, gap: 16 }}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>{t('m.profile.title')}</T>
      <Card style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' }}><T style={{ color: C.paper, fontSize: 24, fontWeight: '800' }}>{user.name.slice(0, 1)}</T></View>
        <View style={{ flex: 1 }}><T style={{ fontSize: 18, fontWeight: '800' }}>{user.name}</T><T style={{ color: C.muted }}>{meta?.company ? t('m.profile.roleAt', { role: roleLabel(user.role, t), company: meta.company.name }) : roleLabel(user.role, t)}</T></View></Card>

      <Card>
        <T style={{ fontSize: 17, fontWeight: '800' }}>{t('m.profile.language')}</T>
        <Segmented value={locale} onChange={(next) => setLocale(next)} options={[['ar', t('m.profile.arabic')], ['en', t('m.profile.english')]]} />
        <T style={{ color: C.muted, fontSize: 13 }}>{t('m.profile.languageHint')}</T></Card>

      <Card>
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '800' }}>{t('m.profile.bioTitle', { kind: t(kind) })}</T><T style={{ color: C.muted, fontSize: 13 }}>{t('m.profile.bioSub')}</T></View>
          <Switch value={bio} trackColor={{ true: C.black, false: '#cfccc3' }} onValueChange={async (v) => { setBio(v); await setBioPref(v); toast('info', v ? t('m.profile.bioOn') : t('m.profile.bioOff')); }} /></View></Card>
      <Card><T style={{ fontWeight: '800' }}>{t('m.profile.device')}</T><T style={{ color: C.muted, lineHeight: 24 }}>{t('m.profile.deviceBody')}</T></Card>
      <Button kind="ghost" title={t('m.profile.logout')} onPress={onLogout} />
      <T style={{ color: '#a8a499', fontSize: 11, textAlign: 'center' }}>{t('m.profile.version', { version: '0.2.0', url: API_URL })}</T>
    </ScrollView>
  );
}
