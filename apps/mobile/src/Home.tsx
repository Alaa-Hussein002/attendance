import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { ApiError, getBioPref, getDeviceUid, request } from './api';
import { useMeta } from './app-context';
import { fmtDay, hhmm12, sar, tierLabel } from './format';
import { msg, NEUTRAL } from './messages';
import { C, R } from './theme';
import { TaskCard } from './Tasks';
import { Card, Dot, T, useToast } from './ui';

export type TabKey = 'home' | 'tasks' | 'records' | 'requests' | 'profile';

export default function Home({ name, userId, onExpired, go }: { name: string; userId: string; onExpired: () => void; go: (t: TabKey) => void }) {
  const { t, dir, locale, setLocale } = useI18n();
  const toast = useToast(); const insets = useSafeAreaInsets(); const { meta, reload } = useMeta();
  const [data, setData] = useState<any>(null); const [tasks, setTasks] = useState<any[]>([]); const [busy, setBusy] = useState(false); const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!meta) return;
    try {
      const [month, mine] = await Promise.all([request(`/me/month?year=${meta.payrollMonth.year}&month=${meta.payrollMonth.month}`), request(`/tasks/mine?year=${meta.today.slice(0, 4)}&month=${Number(meta.today.slice(5, 7))}`)]);
      setData(month); setTasks(mine.filter((x: any) => x.date === meta.today && x.status === 'SCHEDULED'));
    } catch (e) { const c = e instanceof ApiError ? e.code : ''; if (c === 'SESSION_EXPIRED') onExpired(); else toast('error', msg(c, t)); }
  }, [meta, onExpired, toast, t]);
  useEffect(() => { load(); }, [load]);

  const tiers: any[] = data?.policy ? [...data.policy.tiers, data.policy.absentTier] : [];
  const look = (st: string) => {
    const tier = tiers.find((x) => x.key === st);
    if (tier) return { label: tierLabel(tier.label, t), color: tier.color };
    const neutral = NEUTRAL[st];
    return neutral ? { label: t(neutral.key), color: neutral.color } : { label: st, color: '#999' };
  };
  const today = meta ? data?.result?.days?.find((d: any) => d.date === meta.today) : null;
  const noRecordYet = !today || today.status === 'FUTURE';
  const neutralToday = today && NEUTRAL[today.status] && today.status !== 'FUTURE';
  const r = data?.result; const row = data?.row;

  async function bioGate() {
    if (!(await getBioPref())) return true;
    if (!((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()))) return true;
    return (await LocalAuthentication.authenticateAsync({ promptMessage: t('m.bio.checkIn'), cancelLabel: t('m.bio.cancel') })).success;
  }
  async function checkIn() {
    setBusy(true);
    try {
      if (!(await bioGate())) { toast('info', t('m.home.identityFailed')); setBusy(false); return; }
      let geo: { lat?: number; lng?: number; mockLocation?: boolean } = {};
      try { // GPS is optional: office-network branches verify by IP, so continue without coordinates if unavailable
        const p = await Location.requestForegroundPermissionsAsync();
        if (p.granted) { const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); geo = { lat: l.coords.latitude, lng: l.coords.longitude, mockLocation: (l as any).mocked === true }; }
      } catch { /* proceed without location */ }
      const res = await request('/attendance/check-in', { method: 'POST', body: { deviceUid: await getDeviceUid(), clientTime: new Date().toISOString(), ...geo } });
      const tier = tiers.find((x) => x.key === res.status);
      toast('success', t(res.source === 'TASK' ? 'm.home.checkInTaskDone' : 'm.home.checkInDone'), tier ? tierLabel(tier.label, t) : ''); await load(); reload();
    } catch (e) {
      const c = e instanceof ApiError ? e.code : '';
      toast(c === 'ALREADY_CHECKED_IN' ? 'info' : 'error', msg(c, t)); if (c === 'TOO_LATE' || c === 'ALREADY_CHECKED_IN') await load(); if (c === 'SESSION_EXPIRED') onExpired();
    }
    setBusy(false);
  }

  const rowDir = dir === 'rtl' ? 'row-reverse' : 'row';
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 130, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); reload(); await load(); setRefreshing(false); }} />}>
      <View style={{ flexDirection: rowDir, alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}><T style={{ color: C.muted }}>{meta ? fmtDay(meta.today, t) : ''}</T><T style={{ fontSize: 28, fontWeight: '800' }}>{t('m.home.greeting', { name: name.split(' ')[0] })}</T></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('m.profile.language')} onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
          style={({ pressed }) => ({ flexDirection: rowDir, alignItems: 'center', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="language-outline" size={16} color={C.black} />
          <T style={{ color: C.black, fontSize: 12, fontWeight: '700' }}>{locale === 'ar' ? t('m.profile.english') : t('m.profile.arabic')}</T>
        </Pressable>
      </View>

      <View style={{ backgroundColor: C.black, borderRadius: R.xl, padding: 22, alignItems: 'center', gap: 14 }}>
        <T style={{ color: '#a8a499', fontSize: 12, letterSpacing: 1.5 }}>{t('m.home.todayStatus')}</T>
        {noRecordYet || neutralToday ? (<T style={{ color: C.paper, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{neutralToday ? look(today.status).label : t('m.home.notCheckedIn')}</T>)
          : (<View style={{ flexDirection: rowDir, alignItems: 'center', gap: 10 }}><Dot color={look(today.status).color} size={16} /><T style={{ color: C.paper, fontSize: 24, fontWeight: '800' }}>{look(today.status).label}{today.redeemed ? t('m.home.redeemed') : ''}</T></View>)}
        {!noRecordYet && !neutralToday && today.checkInMinutes != null && <T style={{ color: '#a8a499' }}>{t('m.home.checkInTime', { time: hhmm12(today.checkInMinutes, locale) })}</T>}
        <Pressable disabled={busy || !meta || !data || !noRecordYet} onPress={checkIn} style={({ pressed }) => ({ width: 176, height: 176, borderRadius: 88, alignItems: 'center', justifyContent: 'center', backgroundColor: noRecordYet ? C.accent : '#26262a', opacity: pressed ? 0.88 : 1, borderWidth: 6, borderColor: noRecordYet ? 'rgba(230,90,46,.28)' : '#2f2f33', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          {busy ? <ActivityIndicator color="#fff" size="large" /> : (<View style={{ alignItems: 'center', gap: 4 }}><Ionicons name={noRecordYet ? 'finger-print' : 'checkmark-circle'} size={42} color="#fff" /><T style={{ color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{noRecordYet ? t('m.home.checkIn') : neutralToday ? t('m.home.noWorkToday') : t('m.home.checkedIn')}</T></View>)}
        </Pressable>
        {noRecordYet && tasks.length > 0 && (<View style={{ flexDirection: rowDir, gap: 8, alignItems: 'center', backgroundColor: '#1e1e21', borderRadius: R.md, padding: 12 }}><Ionicons name="location" size={18} color={C.accent} />
          <T style={{ color: '#d7d3c8', flex: 1, fontSize: 13, lineHeight: 20 }}>{tasks[0].address ? t('m.home.taskToday', { address: tasks[0].address }) : t('m.home.taskTodayNoAddress')}</T></View>)}
        {!data && <ActivityIndicator color={C.paper} />}
      </View>

      {tasks.length > 0 && (<View style={{ gap: 10 }}>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}><T style={{ fontSize: 18, fontWeight: '800' }}>{t('m.home.todayTasks')}</T><Pressable onPress={() => go('tasks')}><T style={{ color: C.accent, fontWeight: '700' }}>{t('m.home.allTasks')}</T></Pressable></View>
        {tasks.slice(0, 3).map((task) => <TaskCard key={task.id} t={task} today={meta?.today ?? ''} me={userId} />)}</View>)}

      {r && (<Pressable onPress={() => go('records')}><Card>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}><T style={{ fontSize: 17, fontWeight: '800' }}>{t('m.home.period')}</T><Ionicons name={dir === 'rtl' ? 'chevron-back' : 'chevron-forward'} size={18} color={C.muted} /></View>
        <View style={{ flexDirection: rowDir, flexWrap: 'wrap', gap: 8 }}>{tiers.map((tier) => (<View key={tier.key} style={{ flexDirection: rowDir, alignItems: 'center', gap: 6, backgroundColor: C.soft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 }}><Dot color={tier.color} /><T style={{ fontWeight: '700', fontSize: 13 }}>{tierLabel(tier.label, t)}</T><T style={{ color: C.muted, fontSize: 13 }}>{r.counts[tier.key] ?? 0}</T></View>))}</View>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}><T style={{ color: C.muted }}>{t('m.home.deductions')}</T><T style={{ fontWeight: '800', color: row.lateDeductionsMinor + row.absentDeductionsMinor ? C.bad : C.black }}>{sar(row.lateDeductionsMinor + row.absentDeductionsMinor)} {t('m.common.currency')}</T></View>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}><T style={{ color: C.muted }}>{t('m.home.netExpected')}</T><T style={{ fontWeight: '800' }}>{sar(row.netSalaryMinor)} {t('m.common.currency')}</T></View></Card></Pressable>)}
    </ScrollView>
  );
}
