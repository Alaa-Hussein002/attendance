import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, Image, Pressable, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { clearSession, getBioPref, getUser, hasSession, logoutRemote, meta as fetchMeta, SessionUser } from './src/api';
import { AppMeta, MetaCtx } from './src/app-context';
import Auth from './src/Auth';
import Home, { TabKey } from './src/Home';
import Records from './src/Records';
import Tasks from './src/Tasks';
import ManagedTasks from './src/ManagedTasks';
import Profile from './src/Profile';
import Requests from './src/Requests';
import { brand, C, R } from './src/theme';
import { Button, T, ToastProvider } from './src/ui';
import { MobileI18nProvider } from './src/i18n';

I18nManager.allowRTL(true);
type Screen = 'boot' | 'login' | 'locked' | 'main';
type IonName = React.ComponentProps<typeof Ionicons>['name'];
const TABS: [TabKey, string, IonName, IonName][] = [
  ['home', 'm.tab.home', 'home-outline', 'home'],
  ['tasks', 'm.tab.tasks', 'briefcase-outline', 'briefcase'],
  ['records', 'm.tab.records', 'calendar-outline', 'calendar'],
  ['requests', 'm.tab.requests', 'paper-plane-outline', 'paper-plane'],
  ['profile', 'm.tab.profile', 'person-outline', 'person'],
];

function Main({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { t, dir } = useI18n();
  const insets = useSafeAreaInsets(); const [tab, setTab] = useState<TabKey>('home');
  const teamLead = user.role === 'TEAM_LEAD';
  const tabs: [TabKey, string, IonName, IonName][] = TABS.map(([key, label, off, on]) => [key, key === 'tasks' && teamLead ? 'm.tab.tasksBookings' : label, off, on]);
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <Home name={user.name} userId={user.id} onExpired={onLogout} go={setTab} />}
        {tab === 'tasks' && (teamLead ? <ManagedTasks /> : <Tasks userId={user.id} />)}
        {tab === 'records' && <Records />}
        {tab === 'requests' && <Requests />}
        {tab === 'profile' && <Profile user={user} onLogout={onLogout} />}
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 12), flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', backgroundColor: C.black, borderRadius: 26, padding: 6, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
        {tabs.map(([key, label, off, on]) => (<Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityLabel={t(label)} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 20, backgroundColor: tab === key ? '#242427' : 'transparent', gap: 3 }}>
          <Ionicons name={tab === key ? on : off} size={22} color={tab === key ? C.accent : '#8d8a80'} /><T style={{ color: tab === key ? C.paper : '#8d8a80', fontSize: 10.5, fontWeight: '700', textAlign: 'center' }}>{t(label)}</T></Pressable>))}
      </View>
    </View>
  );
}

function Root() {
  const { t } = useI18n();
  const [screen, setScreen] = useState<Screen>('boot'); const [user, setUser] = useState<SessionUser | null>(null); const [meta, setMeta] = useState<AppMeta | null>(null);
  const reload = useCallback(() => { fetchMeta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [reload]);

  const enter = useCallback(async () => { setUser(await getUser()); setScreen('main'); }, []);
  const unlock = useCallback(async () => {
    const can = (await getBioPref()) && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    if (!can) return enter();
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: t('m.bio.unlock'), cancelLabel: t('m.bio.cancel') });
    r.success ? enter() : setScreen('locked');
  }, [enter, t]);
  useEffect(() => { hasSession().then((ok) => (ok ? unlock() : setScreen('login'))); }, [unlock]);
  const logout = useCallback(async () => { await logoutRemote(); await clearSession(); setUser(null); setScreen('login'); }, []);

  return (
    <MetaCtx.Provider value={{ meta, reload }}>
      <StatusBar style={screen === 'login' ? 'light' : 'dark'} />
      {screen === 'boot' && <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }}><Image source={brand.markBlack} style={{ width: 90, height: 90 }} resizeMode="contain" /><ActivityIndicator style={{ marginTop: 24 }} color={C.black} /></View>}
      {screen === 'login' && <Auth onDone={enter} />}
      {screen === 'locked' && (<View style={{ flex: 1, backgroundColor: C.black, padding: 28, justifyContent: 'center', gap: 18 }}><Image source={brand.lockupWhite} style={{ width: 200, height: 56, alignSelf: 'center' }} resizeMode="contain" />
        <T style={{ color: C.paper, textAlign: 'center', fontSize: 20, fontWeight: '800' }}>{t('m.lock.title')}</T><Button kind="light" title={t('m.lock.open')} onPress={unlock} /></View>)}
      {screen === 'main' && user && <Main user={user} onLogout={logout} />}
    </MetaCtx.Provider>
  );
}
export default function App() {
  // The chosen in-app language, not the device language, drives the layout. We mirror rows explicitly
  // (row / row-reverse) per locale, so the tree must stay LTR even on an RTL device.
  return (<SafeAreaProvider><MobileI18nProvider><View style={{ flex: 1, direction: 'ltr' }}><ToastProvider><Root /></ToastProvider></View></MobileI18nProvider></SafeAreaProvider>);
}
