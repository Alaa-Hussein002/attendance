import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, request } from './api';
import { useMeta } from './app-context';
import { addDays, fmtDay } from './format';
import { msg } from './messages';
import { C, R } from './theme';
import { Badge, Button, Card, ChipRow, Segmented, T, useToast } from './ui';

const ST: Record<string, [string, string]> = { PENDING: ['بانتظار القرار', '#fdebe4'], APPROVED: ['موافق عليه', '#e4f5ea'], REJECTED: ['مرفوض', '#ececec'] };

export default function Requests() {
  const toast = useToast(); const insets = useSafeAreaInsets(); const { meta } = useMeta();
  const [seg, setSeg] = useState<'excuse' | 'leave'>('excuse');
  const [leaves, setLeaves] = useState<any[]>([]); const [excuses, setExcuses] = useState<any[]>([]); const [month, setMonth] = useState<any>(null);
  const [exDate, setExDate] = useState<string | null>(null); const [reason, setReason] = useState('');
  const [from, setFrom] = useState<string | null>(null); const [to, setTo] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!meta) return;
    try { const [l, x, m] = await Promise.all([request('/leaves'), request('/excuse-requests'), request(`/me/month?year=${meta.payrollMonth.year}&month=${meta.payrollMonth.month}`)]); setLeaves(l); setExcuses(x); setMonth(m); }
    catch (e) { toast('error', msg(e instanceof ApiError ? e.code : '')); }
  }, [meta, toast]);
  useEffect(() => { load(); }, [load]);

  const requested = new Set(excuses.filter((x) => x.status !== 'REJECTED').map((x) => x.localDate));
  const badDays: any[] = (month?.result?.days ?? []).filter((d: any) => (d.kind === 'LATE' || d.kind === 'ABSENT') && !d.redeemed && !requested.has(d.date));
  const today = meta?.today ?? '';
  const fromDays = today ? Array.from({ length: 45 }, (_, i) => addDays(today, i)) : [];
  const toDays = from ? Array.from({ length: 30 }, (_, i) => addDays(from, i)) : [];

  async function send(path: string, body: object, ok: string, reset: () => void) {
    setBusy(true);
    try { await request(path, { method: 'POST', body }); toast('success', ok); reset(); await load(); } catch (e) { toast('error', msg(e instanceof ApiError ? e.code : '')); }
    setBusy(false);
  }
  const Input = (
    <TextInput value={reason} onChangeText={setReason} placeholder={seg === 'excuse' ? 'اكتب عذرك بإيجاز' : 'سبب الإجازة (اختياري)'} placeholderTextColor="#aaa79d" multiline
      style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 14, minHeight: 84, textAlign: 'right', fontSize: 16, textAlignVertical: 'top' }} />);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>الطلبات</T>
      <Segmented value={seg} onChange={setSeg} options={[['excuse', 'تقديم عذر'], ['leave', 'طلب إجازة']]} />

      {seg === 'excuse' ? (
        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>عذر عن يوم تأخر أو غياب</T>
          {badDays.length === 0 ? <T style={{ color: C.muted, lineHeight: 24 }}>لا توجد أيام تأخر أو غياب بحاجة لعذر في الفترة الحالية.</T> : (<>
            <T style={{ color: C.muted }}>اختر اليوم</T>
            <ChipRow items={badDays.map((d) => ({ value: d.date, label: fmtDay(d.date) }))} value={exDate} onChange={setExDate} />{Input}
            <Button title="إرسال العذر" loading={busy} disabled={!exDate || reason.trim().length < 3} onPress={() => send('/excuse-requests', { date: exDate, reason }, 'تم إرسال العذر للمراجعة', () => { setExDate(null); setReason(''); })} /></>)}</Card>
      ) : (
        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>طلب إجازة</T>
          <T style={{ color: C.muted }}>من تاريخ</T><ChipRow items={fromDays.map((d) => ({ value: d, label: fmtDay(d) }))} value={from} onChange={(v) => { setFrom(v); setTo(v); }} />
          {from && (<><T style={{ color: C.muted }}>إلى تاريخ</T><ChipRow items={toDays.map((d) => ({ value: d, label: fmtDay(d) }))} value={to} onChange={setTo} /></>)}{Input}
          <Button title="إرسال الطلب" loading={busy} disabled={!from || !to} onPress={() => send('/leaves', { fromDate: from, toDate: to, reason: reason.trim() || undefined }, 'تم إرسال طلب الإجازة', () => { setFrom(null); setTo(null); setReason(''); })} /></Card>
      )}

      <T style={{ fontSize: 17, fontWeight: '800', marginTop: 4 }}>طلباتي</T>
      {[...excuses.map((x) => ({ id: x.id, kind: 'عذر', title: fmtDay(x.localDate), sub: x.reason, status: x.status, note: x.decisionNote, at: x.createdAt })),
        ...leaves.map((x) => ({ id: x.id, kind: 'إجازة', title: x.fromDate === x.toDate ? fmtDay(x.fromDate) : `${fmtDay(x.fromDate)} ← ${fmtDay(x.toDate)}`, sub: x.reason, status: x.status, note: undefined, at: x.createdAt }))]
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).map((q) => (
          <Card key={q.id} style={{ gap: 6 }}><View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}><T style={{ fontWeight: '800' }}>{q.kind} · {q.title}</T><Badge text={ST[q.status][0]} bg={ST[q.status][1]} /></View>
            {q.sub ? <T style={{ color: C.muted }}>{q.sub}</T> : null}{q.note ? <T style={{ color: C.bad, fontSize: 13 }}>سبب الرفض: {q.note}</T> : null}</Card>))}
      {excuses.length + leaves.length === 0 && <T style={{ color: C.muted, textAlign: 'center' }}>لا توجد طلبات بعد.</T>}
    </ScrollView>
  );
}
