import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { ApiError, clearSession, getDeviceUid, request } from './api';
import { msg, NEUTRAL } from './messages';
import { s } from './styles';

const sar = (minor: number) => (minor / 100).toFixed(2);
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Home({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<any>(null); const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false); const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const n = new Date();
    try { setData(await request(`/me/month?year=${n.getFullYear()}&month=${n.getMonth() + 1}`)); }
    catch (e) { if (e instanceof ApiError && e.code === 'SESSION_EXPIRED') onLogout(); else setNote({ ok: false, text: msg(e instanceof ApiError ? e.code : '') }); }
  }, [onLogout]);
  useEffect(() => { load(); }, [load]);

  const tiers: any[] = data ? [...data.policy.tiers, data.policy.absentTier] : [];
  const look = (st: string) => { const t = tiers.find((x) => x.key === st); return t ? { label: t.label, color: t.color } : NEUTRAL[st] ?? { label: st, color: '#999' }; };
  const today = data?.result.days.find((d: any) => d.date === localDate());

  async function checkIn() {
    setBusy(true); setNote(null);
    try {
      let geo: { lat?: number; lng?: number; mockLocation?: boolean } = {};
      try { // GPS is optional: office-network branches verify by IP, so continue without coordinates if unavailable
        const p = await Location.requestForegroundPermissionsAsync();
        if (p.granted) { const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); geo = { lat: l.coords.latitude, lng: l.coords.longitude, mockLocation: (l as any).mocked === true }; }
      } catch { /* proceed without location */ }
      const r = await request('/attendance/check-in', { method: 'POST', body: { deviceUid: await getDeviceUid(), clientTime: new Date().toISOString(), ...geo } });
      setNote({ ok: true, text: `تم تسجيل حضورك: ${look(r.status).label}` }); await load();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setNote({ ok: code === 'ALREADY_CHECKED_IN', text: msg(code) }); if (code === 'TOO_LATE') await load();
      if (code === 'SESSION_EXPIRED') onLogout();
    }
    setBusy(false);
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Text style={s.h1}>مرحباً {data?.name ?? ''}</Text>
      <View style={s.card}>
        <Text style={s.label}>حالة اليوم</Text>
        <Text style={[s.big, { color: today ? look(today.status).color : '#64748b' }]}>{today ? look(today.status).label + (today.redeemed ? ' (معوَّض)' : '') : 'لم تسجّل بعد'}</Text>
        <TouchableOpacity style={[s.checkin, busy && { opacity: 0.6 }]} disabled={busy} onPress={checkIn}>
          {busy ? <ActivityIndicator color="#fff" size="large" /> : <Text style={s.checkinT}>تسجيل الحضور</Text>}</TouchableOpacity>
        {note && <Text style={[note.ok ? s.ok : s.err, { marginTop: 12 }]}>{note.text}</Text>}
      </View>

      {data && <View style={s.card}><Text style={s.h2}>هذا الشهر</Text>
        <View style={s.cal}>{data.result.days.map((d: any) => { const l = look(d.status); return (
          <View key={d.date} style={[s.cell, { backgroundColor: l.color, borderWidth: d.redeemed ? 2 : d.status === 'FUTURE' ? 1 : 0 }]}><Text style={s.cellT}>{Number(d.date.slice(8))}</Text></View>); })}</View>
        <View style={s.legend}>{tiers.map((t) => <Text key={t.key} style={s.hint}><Text style={{ color: t.color }}>● </Text>{t.label}  </Text>)}</View>
        <Text style={s.hint}>في الوقت {data.row.onTimeDays} · تأخر {data.row.lateDays} · غياب {data.row.absentDays} · معوَّض {data.row.redeemedDays}</Text>
        <Text style={s.hint}>خصومات حتى الآن: {sar(data.row.lateDeductionsMinor + data.row.absentDeductionsMinor)} ريال{data.result.finalized ? ` · مكافأة: ${sar(data.row.bonusMinor)} ريال` : ''}</Text>
        <Text style={s.hint}>الدائرة بإطار = يوم سيئ تم تعويضه بأيام جيدة.</Text></View>}
      {!data && !note && <ActivityIndicator />}
      <TouchableOpacity onPress={async () => { await clearSession(); onLogout(); }}><Text style={s.link}>تسجيل الخروج</Text></TouchableOpacity>
    </ScrollView>);
}
