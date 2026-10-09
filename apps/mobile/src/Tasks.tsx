import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, request } from './api';
import { useMeta } from './app-context';
import { fmtDay, hhmm12, MONTHS_AR } from './format';
import { msg } from './messages';
import MonthSwitcher, { shiftYM } from './MonthSwitcher';
import { C, R } from './theme';
import { Badge, T, useToast } from './ui';

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const openMap = (lat: number, lng: number) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);

export function TaskCard({ t, today, me }: { t: any; today: string; me?: string }) {
  const cancelled = t.status === 'CANCELLED';
  const tag = cancelled ? ['ملغاة', '#ececec', C.muted] : t.date === today ? ['اليوم', C.accent, '#fff'] : t.date < today ? ['منتهية', '#e4f5ea', C.ok] : ['قادمة', '#e4eefc', C.info];
  const mates = (t.assignees ?? []).filter((a: any) => a.userId !== me).map((a: any) => a.name);
  return (
    <View style={{ backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10, opacity: cancelled ? 0.6 : 1, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, backgroundColor: tag[1] as string }} />
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}><Ionicons name="time-outline" size={16} color={C.muted} /><T style={{ fontWeight: '800' }}>{hhmm12(mins(t.startTime))} – {hhmm12(mins(t.endTime))}</T></View>
        <Badge text={tag[0] as string} bg={tag[1] as string} color={tag[2] as string} /></View>
      <T style={{ fontSize: 18, fontWeight: '800', textDecorationLine: cancelled ? 'line-through' : 'none' }}>{t.title}</T>
      {t.address ? <View style={{ flexDirection: 'row-reverse', gap: 6, alignItems: 'center' }}><Ionicons name="location-outline" size={16} color={C.muted} /><T style={{ color: C.muted, flex: 1 }}>{t.address}</T></View> : null}
      {t.details ? <T style={{ lineHeight: 24, color: '#333' }}>{t.details}</T> : null}
      {mates.length > 0 && <T style={{ color: C.muted, fontSize: 13 }}>معك: {mates.join('، ')}</T>}
      {!cancelled && <Pressable onPress={() => openMap(t.latitude, t.longitude)} style={({ pressed }) => ({ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.black, borderRadius: R.md, height: 46, opacity: pressed ? 0.85 : 1 })}>
        <Ionicons name="navigate" size={18} color={C.paper} /><T style={{ color: C.paper, fontWeight: '700' }}>فتح الموقع في الخرائط</T></Pressable>}
    </View>);
}

export default function Tasks({ userId }: { userId: string }) {
  const toast = useToast(); const insets = useSafeAreaInsets(); const { meta } = useMeta();
  const [offset, setOffset] = useState(0); const [rows, setRows] = useState<any[] | null>(null); const [refreshing, setRefreshing] = useState(false);
  const base = useMemo(() => (meta ? { y: Number(meta.today.slice(0, 4)), m: Number(meta.today.slice(5, 7)) } : null), [meta]);
  const cur = base ? shiftYM(base, offset) : null;

  const load = useCallback(async () => {
    if (!cur) return; setRows(null);
    try { setRows(await request(`/tasks/mine?year=${cur.y}&month=${cur.m}`)); } catch (e) { setRows([]); toast('error', msg(e instanceof ApiError ? e.code : '')); }
  }, [cur?.y, cur?.m]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => { const g = new Map<string, any[]>(); for (const t of rows ?? []) { const a = g.get(t.date) ?? []; a.push(t); g.set(t.date, a); } return [...g.entries()].sort(); }, [rows]);
  const active = (rows ?? []).filter((t) => t.status !== 'CANCELLED').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 130, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>مهامي</T>
      {cur && <MonthSwitcher label={`${MONTHS_AR[cur.m - 1]} ${cur.y}`} sub={rows ? `${active} ${active === 1 ? 'مهمة' : 'مهام'}` : undefined} offset={offset} onChange={setOffset} />}
      {rows === null && <ActivityIndicator style={{ marginTop: 30 }} color={C.black} />}
      {rows && rows.length === 0 && (<View style={{ alignItems: 'center', gap: 10, paddingVertical: 50 }}><Ionicons name="calendar-clear-outline" size={44} color="#b9b6ad" /><T style={{ color: C.muted, textAlign: 'center' }}>لا توجد مهام في هذا الشهر.</T></View>)}
      {days.map(([date, list]) => (<View key={date} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta?.today === date ? C.accent : C.black }} /><T style={{ fontWeight: '800', color: meta?.today === date ? C.accent : C.black }}>{fmtDay(date)}{meta?.today === date ? ' · اليوم' : ''}</T></View>
        {list.map((t) => <TaskCard key={t.id} t={t} today={meta?.today ?? ''} me={userId} />)}</View>))}
    </ScrollView>
  );
}
