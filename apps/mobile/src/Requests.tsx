import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { ApiError, request } from './api';
import { useMeta } from './app-context';
import { addDays, fmtDay } from './format';
import { msg } from './messages';
import { C, R } from './theme';
import { Badge, Button, Card, ChipRow, Segmented, T, useToast } from './ui';

const ST: Record<string, { key: string; bg: string }> = {
  PENDING: { key: 'm.req.status.PENDING', bg: '#fdebe4' },
  APPROVED: { key: 'm.req.status.APPROVED', bg: '#e4f5ea' },
  REJECTED: { key: 'm.req.status.REJECTED', bg: '#ececec' },
};

export default function Requests() {
  const { t, dir } = useI18n();
  const toast = useToast(); const insets = useSafeAreaInsets(); const { meta } = useMeta();
  const [seg, setSeg] = useState<'excuse' | 'leave'>('excuse');
  const [leaves, setLeaves] = useState<any[]>([]); const [excuses, setExcuses] = useState<any[]>([]); const [month, setMonth] = useState<any>(null);
  const [exDate, setExDate] = useState<string | null>(null); const [reason, setReason] = useState('');
  const [from, setFrom] = useState<string | null>(null); const [to, setTo] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!meta) return;
    try { const [l, x, m] = await Promise.all([request('/leaves'), request('/excuse-requests'), request(`/me/month?year=${meta.payrollMonth.year}&month=${meta.payrollMonth.month}`)]); setLeaves(l); setExcuses(x); setMonth(m); }
    catch (e) { toast('error', msg(e instanceof ApiError ? e.code : '', t)); }
  }, [meta, toast, t]);
  useEffect(() => { load(); }, [load]);

  const requested = new Set(excuses.filter((x) => x.status !== 'REJECTED').map((x) => x.localDate));
  const badDays: any[] = (month?.result?.days ?? []).filter((d: any) => (d.kind === 'LATE' || d.kind === 'ABSENT') && !d.redeemed && !requested.has(d.date));
  const today = meta?.today ?? '';
  const fromDays = today ? Array.from({ length: 45 }, (_, i) => addDays(today, i)) : [];
  const toDays = from ? Array.from({ length: 30 }, (_, i) => addDays(from, i)) : [];

  async function send(path: string, body: object, ok: string, reset: () => void) {
    setBusy(true);
    try { await request(path, { method: 'POST', body }); toast('success', ok); reset(); await load(); } catch (e) { toast('error', msg(e instanceof ApiError ? e.code : '', t)); }
    setBusy(false);
  }
  const Input = (
    <TextInput value={reason} onChangeText={setReason} placeholder={seg === 'excuse' ? t('m.req.excusePh') : t('m.req.leavePh')} placeholderTextColor="#aaa79d" multiline
      style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 14, minHeight: 84, textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir === 'rtl' ? 'rtl' : 'ltr', fontSize: 16, textAlignVertical: 'top' }} />);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>{t('m.req.title')}</T>
      <Segmented value={seg} onChange={setSeg} options={[['excuse', t('m.req.excuseTab')], ['leave', t('m.req.leaveTab')]]} />

      {seg === 'excuse' ? (
        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>{t('m.req.excuseTitle')}</T>
          {badDays.length === 0 ? <T style={{ color: C.muted, lineHeight: 24 }}>{t('m.req.excuseEmpty')}</T> : (<>
            <T style={{ color: C.muted }}>{t('m.req.pickDay')}</T>
            <ChipRow items={badDays.map((d) => ({ value: d.date, label: fmtDay(d.date, t) }))} value={exDate} onChange={setExDate} />{Input}
            <Button title={t('m.req.sendExcuse')} loading={busy} disabled={!exDate || reason.trim().length < 3} onPress={() => send('/excuse-requests', { date: exDate, reason }, t('m.req.excuseSent'), () => { setExDate(null); setReason(''); })} /></>)}</Card>
      ) : (
        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>{t('m.req.leaveTitle')}</T>
          <T style={{ color: C.muted }}>{t('m.req.fromDate')}</T><ChipRow items={fromDays.map((d) => ({ value: d, label: fmtDay(d, t) }))} value={from} onChange={(v) => { setFrom(v); setTo(v); }} />
          {from && (<><T style={{ color: C.muted }}>{t('m.req.toDate')}</T><ChipRow items={toDays.map((d) => ({ value: d, label: fmtDay(d, t) }))} value={to} onChange={setTo} /></>)}{Input}
          <Button title={t('m.req.sendLeave')} loading={busy} disabled={!from || !to} onPress={() => send('/leaves', { fromDate: from, toDate: to, reason: reason.trim() || undefined }, t('m.req.leaveSent'), () => { setFrom(null); setTo(null); setReason(''); })} /></Card>
      )}

      <T style={{ fontSize: 17, fontWeight: '800', marginTop: 4 }}>{t('m.req.mine')}</T>
      {[...excuses.map((x) => ({ id: x.id, kind: t('m.req.kindExcuse'), title: fmtDay(x.localDate, t), sub: x.reason, status: x.status, note: x.decisionNote, at: x.createdAt })),
        ...leaves.map((x) => ({ id: x.id, kind: t('m.req.kindLeave'), title: x.fromDate === x.toDate ? fmtDay(x.fromDate, t) : t('m.req.range', { from: fmtDay(x.fromDate, t), to: fmtDay(x.toDate, t) }), sub: x.reason, status: x.status, note: undefined, at: x.createdAt }))]
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).map((q) => {
          const st = ST[q.status] ?? { key: '', bg: '#ececec' };
          return (
          <Card key={q.id} style={{ gap: 6 }}><View style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}><T style={{ fontWeight: '800' }}>{q.kind} · {q.title}</T><Badge text={st.key ? t(st.key) : q.status} bg={st.bg} /></View>
            {q.sub ? <T style={{ color: C.muted }}>{q.sub}</T> : null}{q.note ? <T style={{ color: C.bad, fontSize: 13 }}>{t('m.req.rejectionReason', { note: q.note })}</T> : null}</Card>); })}
      {excuses.length + leaves.length === 0 && <T style={{ color: C.muted, textAlign: 'center' }}>{t('m.req.empty')}</T>}
    </ScrollView>
  );
}
