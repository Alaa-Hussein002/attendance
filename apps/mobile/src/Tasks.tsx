import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { ApiError, request } from './api';
import { useMeta } from './app-context';
import { fmtDay, hhmm12, monthLabel } from './format';
import { msg } from './messages';
import MonthSwitcher, { shiftYM } from './MonthSwitcher';
import { C, R } from './theme';
import { Badge, T, useToast } from './ui';

const mins = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
export const openMap = (lat: number, lng: number) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);

export function TaskCard({ t: task, today, me }: { t: any; today: string; me?: string }) {
  const { t, dir, locale } = useI18n();
  const cancelled = task.status === 'CANCELLED';
  const tag = cancelled
    ? { label: t('m.tasks.cancelled'), bg: '#ececec', fg: C.muted }
    : task.date === today
      ? { label: t('m.tasks.todayBadge'), bg: C.accent, fg: '#fff' }
      : task.date < today
        ? { label: t('m.tasks.finished'), bg: '#e4f5ea', fg: C.ok }
        : { label: t('m.tasks.upcoming'), bg: '#e4eefc', fg: C.info };
  const mates = (task.assignees ?? []).filter((a: any) => a.userId !== me).map((a: any) => a.name);
  const row = dir === 'rtl' ? 'row-reverse' : 'row';
  return (
    <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10, opacity: cancelled ? 0.6 : 1, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: dir === 'rtl' ? 0 : undefined, left: dir === 'rtl' ? undefined : 0, top: 0, bottom: 0, width: 5, backgroundColor: tag.bg }} />
      <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}><Ionicons name="time-outline" size={16} color={C.muted} /><T style={{ fontWeight: '800' }}>{hhmm12(mins(task.startTime), locale)} – {hhmm12(mins(task.endTime), locale)}</T></View>
        <Badge text={tag.label} bg={tag.bg} color={tag.fg} /></View>
      <T style={{ fontSize: 18, fontWeight: '800', textDecorationLine: cancelled ? 'line-through' : 'none' }}>{task.title}</T>
      {task.address ? <View style={{ flexDirection: row, gap: 6, alignItems: 'center' }}><Ionicons name="location-outline" size={16} color={C.muted} /><T style={{ color: C.muted, flex: 1 }}>{task.address}</T></View> : null}
      {task.details ? <T style={{ lineHeight: 24, color: '#333' }}>{task.details}</T> : null}
      {mates.length > 0 && <T style={{ color: C.muted, fontSize: 13 }}>{t('m.tasks.withYou', { names: mates.join(t('m.common.listSep')) })}</T>}
      {!cancelled && <Pressable onPress={() => openMap(task.latitude, task.longitude)} style={({ pressed }) => ({ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.black, borderRadius: R.md, height: 46, opacity: pressed ? 0.85 : 1 })}>
        <Ionicons name="navigate" size={18} color={C.paper} /><T style={{ color: C.paper, fontWeight: '700' }}>{t('m.tasks.openMap')}</T></Pressable>}
    </View>);
}

export default function Tasks({ userId }: { userId: string }) {
  const { t, dir } = useI18n();
  const toast = useToast(); const insets = useSafeAreaInsets(); const { meta } = useMeta();
  const [offset, setOffset] = useState(0); const [rows, setRows] = useState<any[] | null>(null); const [refreshing, setRefreshing] = useState(false);
  const base = useMemo(() => (meta ? { y: Number(meta.today.slice(0, 4)), m: Number(meta.today.slice(5, 7)) } : null), [meta]);
  const cur = base ? shiftYM(base, offset) : null;

  const load = useCallback(async () => {
    if (!cur) return; setRows(null);
    try { setRows(await request(`/tasks/mine?year=${cur.y}&month=${cur.m}`)); } catch (e) { setRows([]); toast('error', msg(e instanceof ApiError ? e.code : '', t)); }
  }, [cur?.y, cur?.m, toast, t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => { const g = new Map<string, any[]>(); for (const task of rows ?? []) { const a = g.get(task.date) ?? []; a.push(task); g.set(task.date, a); } return [...g.entries()].sort(); }, [rows]);
  const active = (rows ?? []).filter((task) => task.status !== 'CANCELLED').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 130, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>{t('m.tasks.title')}</T>
      {cur && <MonthSwitcher label={`${monthLabel(cur.m, t)} ${cur.y}`} sub={rows ? t(active === 1 ? 'm.tasks.one' : 'm.tasks.many', { n: active }) : undefined} offset={offset} onChange={setOffset} />}
      {rows === null && <ActivityIndicator style={{ marginTop: 30 }} color={C.black} />}
      {rows && rows.length === 0 && (<View style={{ alignItems: 'center', gap: 10, paddingVertical: 50 }}><Ionicons name="calendar-clear-outline" size={44} color="#b9b6ad" /><T style={{ color: C.muted, textAlign: 'center' }}>{t('m.tasks.empty')}</T></View>)}
      {days.map(([date, list]) => (<View key={date} style={{ gap: 10 }}>
        <View style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta?.today === date ? C.accent : C.black }} /><T style={{ fontWeight: '800', color: meta?.today === date ? C.accent : C.black }}>{fmtDay(date, t)}{meta?.today === date ? t('m.tasks.today') : ''}</T></View>
        {list.map((task) => <TaskCard key={task.id} t={task} today={meta?.today ?? ''} me={userId} />)}</View>))}
    </ScrollView>
  );
}
