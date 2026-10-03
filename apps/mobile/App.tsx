import { useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { hasSession } from './src/api';
import Home from './src/Home';
import Login from './src/Login';
import { s } from './src/styles';

I18nManager.allowRTL(true);
type Screen = 'boot' | 'login' | 'locked' | 'home';

export default function App() {
  const [screen, setScreen] = useState<Screen>('boot');

  /** Returning users must pass the phone's biometrics/PIN when the device supports it. */
  async function unlock() {
    const can = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    if (!can) return setScreen('home');
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'افتح تطبيق الحضور', cancelLabel: 'إلغاء' });
    setScreen(r.success ? 'home' : 'locked');
  }
  useEffect(() => { hasSession().then((ok) => (ok ? unlock() : setScreen('login'))); }, []);

  return (<><StatusBar style="auto" />
    {screen === 'boot' && <View style={s.screen}><ActivityIndicator /></View>}
    {screen === 'login' && <Login onDone={() => setScreen('home')} />}
    {screen === 'locked' && <View style={s.screen}><Text style={s.h1}>التطبيق مقفل</Text>
      <TouchableOpacity style={s.btn} onPress={unlock}><Text style={s.btnT}>فتح</Text></TouchableOpacity></View>}
    {screen === 'home' && <Home onLogout={() => setScreen('login')} />}</>);
}
