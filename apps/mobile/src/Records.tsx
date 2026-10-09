import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, request } from './api';
import { useMeta } from './app-context';
import { fmtDay, fmtShort, hhmm12, MONTHS_AR, sar, weekday } from './format';
import { msg, NEUTRAL } from './messages';
import MonthSwitcher, { shiftYM } from './MonthSwitcher';
import { C, R } from './theme';
import { Badge, Card, Dot, T, useToast } from './ui';

/** "سجلي": attendance, absence, deductions and bonus for the previous / current / next payroll period. */
export default function Records() {
  const toast = useToast(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions(); const { meta } = useMeta();
  const [offset, setOffset] = useState(0); const [data, setData] = useState<any>(null); const [refreshing, setRefreshing] = useState(false);
  const cur = useMemo(() => (meta ? shiftYM({ y: meta.payrollMonth.year, m: meta.payrollMonth.month }, offset) : null), [meta, offset]);

  const load = useCallback(async () => {
    if (!cur) return; setData(null);
    try { const r = await request(`/me/month?year=${cur.y}&month=${cur.m}`); setData(r.error ? { empty: true } : r); } catch (e) { setData({ empty: true }); toast('error', msg(e instanceof ApiError ? e.code : '')); }
  }, [cur?.y, cur?.m]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const tiers: any[] = data?.policy ? [...data.policy.tiers, data.policy.absentTier] : [];
  const look = (st: string) => { const t = tiers.find((x) => x.key === st); return t ? { label: t.label, color: t.color } : NEUTRAL[st] ?? { label: st, color: '#999' }; };
  const r = data?.result; const row = data?.row;
  const cell = Math.floor((width - 36 - 36 - 6 * 6) / 7);
  const grid: (any | null)[] = r ? [...Array(weekday(r.days[0].date)).fill(null), ...r.days] : []; const rows: (any | null)[][] = []; for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));
  const bonusNote = !r ? '' : r.bonusEligible ? 'استحققت مكافأة الالتزام 🎉' : !r.finalized ? 'تُحسب المكافأة عند انتهاء الفترة' : (r.bonusExceeded?.length ? `لم تستحق المكافأة: ${r.bonusExceeded.map((e: any) => `«${look(e.tier).label}» ${e.count} (المسموح ${e.allowed})`).join('، ')}` : 'لا مكافأة لهذه الفترة');
  const past = r ? [...r.days].filter((d: any) => d.status !== 'FUTURE').reverse() : [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 130, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>سجلي</T>
      {cur && <MonthSwitcher label={`${MONTHS_AR[cur.m - 1]} ${cur.y}`} sub={r ? `من ${fmtShort(r.period.from)} إلى ${fmtShort(r.period.to)}` : undefined} offset={offset} onChange={setOffset} />}
      {data === null && <ActivityIndicator style={{ marginTop: 30 }} color={C.black} />}
      {data?.empty && <T style={{ color: C.muted, textAlign: 'center', marginTop: 30 }}>لا توجد بيانات حضور لهذه الفترة.</T>}
      {r && (<>
        <View style={{ backgroundColor: C.black, borderRadius: R.xl, padding: 20, gap: 14 }}>
          <T style={{ color: '#a8a499', fontSize: 12 }}>صافي الراتب المتوقع</T>
          <T style={{ color: C.paper, fontSize: 34, fontWeight: '800' }}>{sar(row.netSalaryMinor)} <T style={{ color: '#a8a499', fontSize: 14 }}>ريال</T></T>
          <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#1e1e21', borderRadius: R.md, padding: 12 }}><T style={{ color: '#a8a499', fontSize: 12 }}>الخصومات</T><T style={{ color: row.lateDeductionsMinor + row.absentDeductionsMinor ? '#ff8a6b' : C.paper, fontWeight: '800', fontSize: 16 }}>{sar(row.lateDeductionsMinor + row.absentDeductionsMinor)}</T></View>
            <View style={{ flex: 1, backgroundColor: '#1e1e21', borderRadius: R.md, padding: 12 }}><T style={{ color: '#a8a499', fontSize: 12 }}>المكافأة</T><T style={{ color: row.bonusMinor ? '#6fe0a0' : C.paper, fontWeight: '800', fontSize: 16 }}>{r.finalized ? sar(row.bonusMinor) : '—'}</T></View></View>
          <T style={{ color: '#d7d3c8', fontSize: 13 }}>{bonusNote}</T></View>

        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>ملخص الحضور</T>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>{tiers.map((t) => (<View key={t.key} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: C.soft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }}><Dot color={t.color} /><T style={{ fontWeight: '700' }}>{t.label}</T><T style={{ color: C.muted }}>{r.counts[t.key] ?? 0}</T></View>))}
            {r.counts.REDEEMED > 0 && <View style={{ backgroundColor: C.soft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }}><T style={{ fontWeight: '700' }}>معوَّض {r.counts.REDEEMED}</T></View>}</View></Card>

        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>التقويم</T>
          <View style={{ gap: 6 }}>{rows.map((wk, i) => (<View key={i} style={{ flexDirection: 'row-reverse', gap: 6 }}>{Array.from({ length: 7 }, (_, j) => { const d = wk[j]; if (!d) return <View key={j} style={{ width: cell, height: cell }} />;
            const lk = look(d.status); const isToday = meta?.today === d.date; const neutral = !!NEUTRAL[d.status];
            return (<View key={j} style={{ width: cell, height: cell, borderRadius: cell / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: lk.color, borderWidth: isToday ? 3 : d.redeemed ? 2.5 : d.status === 'FUTURE' ? 1 : 0, borderColor: isToday ? C.black : d.redeemed ? C.info : C.line, opacity: d.status === 'FUTURE' ? 0.6 : 1 }}>
              <T style={{ fontSize: 12, fontWeight: '700', color: neutral ? C.black : '#fff', textAlign: 'center' }}>{Number(d.date.slice(8))}</T></View>); })}</View>))}</View>
          <T style={{ color: C.muted, fontSize: 12 }}>الدائرة السوداء = اليوم · الإطار الأزرق = يوم تم تعويضه</T></Card>

        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>تفاصيل الأيام</T>
          {past.length === 0 ? <T style={{ color: C.muted }}>لا توجد أيام مسجّلة بعد.</T> : past.map((d: any, i: number) => { const lk = look(d.status); const neutral = !!NEUTRAL[d.status];
            return (<View key={d.date} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.soft, gap: 4 }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}><T style={{ fontWeight: '700' }}>{fmtDay(d.date)}</T><Badge text={lk.label} bg={neutral ? C.soft : lk.color} color={neutral ? C.black : '#fff'} /></View>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}><T style={{ color: C.muted, fontSize: 13 }}>{d.checkInMinutes != null ? `حضور ${hhmm12(d.checkInMinutes)}` : neutral ? '' : 'بلا تسجيل'}{d.lateMinutes ? ` · متأخر ${d.lateMinutes} د` : ''}</T>
                {d.deduction > 0 ? <T style={{ color: d.redeemed ? C.muted : C.bad, fontSize: 13, fontWeight: '700', textDecorationLine: d.redeemed ? 'line-through' : 'none' }}>-{sar(d.deduction)}</T> : null}</View>
              {d.redeemed ? <T style={{ color: C.info, fontSize: 12 }}>عُوِّض بيوم {fmtDay(d.redeemedBy[0])}</T> : null}</View>); })}</Card></>)}
    </ScrollView>
  );
}
