import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { ApiError, request } from './api';
import { useMeta } from './app-context';
import { fmtDay, fmtShort, hhmm12, monthLabel, sar, tierLabel, weekday } from './format';
import { msg, NEUTRAL } from './messages';
import MonthSwitcher, { shiftYM } from './MonthSwitcher';
import { C, R } from './theme';
import { Badge, Card, Dot, T, useToast } from './ui';

/** "My record": attendance, absence, deductions and bonus for the previous / current / next payroll period. */
export default function Records() {
  const { t, dir, locale } = useI18n();
  const toast = useToast(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions(); const { meta } = useMeta();
  const [offset, setOffset] = useState(0); const [data, setData] = useState<any>(null); const [refreshing, setRefreshing] = useState(false);
  const cur = useMemo(() => (meta ? shiftYM({ y: meta.payrollMonth.year, m: meta.payrollMonth.month }, offset) : null), [meta, offset]);

  const load = useCallback(async () => {
    if (!cur) return; setData(null);
    try { const res = await request(`/me/month?year=${cur.y}&month=${cur.m}`); setData(res.error ? { empty: true } : res); } catch (e) { setData({ empty: true }); toast('error', msg(e instanceof ApiError ? e.code : '', t)); }
  }, [cur?.y, cur?.m, t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const tiers: any[] = data?.policy ? [...data.policy.tiers, data.policy.absentTier] : [];
  const look = (st: string) => {
    const tier = tiers.find((x) => x.key === st);
    if (tier) return { label: tierLabel(tier.label, t), color: tier.color };
    const neutral = NEUTRAL[st];
    return neutral ? { label: t(neutral.key), color: neutral.color } : { label: st, color: '#999' };
  };
  const r = data?.result; const row = data?.row;
  const cell = Math.floor((width - 36 - 36 - 6 * 6) / 7);
  const grid: (any | null)[] = r ? [...Array(weekday(r.days[0].date)).fill(null), ...r.days] : []; const rows: (any | null)[][] = []; for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));
  const bonusNote = !r ? '' : r.bonusEligible ? t('m.records.bonusEarned') : !r.finalized ? t('m.records.bonusPending')
    : (r.bonusExceeded?.length ? t('m.records.bonusMissed', { items: r.bonusExceeded.map((e: any) => t('m.records.missedItem', { label: tierLabel(tiers.find((tier) => tier.key === e.tier)?.label ?? e.tier, t), count: e.count, allowed: e.allowed })).join(t('m.common.listSep')) }) : t('m.records.bonusNone'));
  const past = r ? [...r.days].filter((d: any) => d.status !== 'FUTURE').reverse() : [];
  const rowDir = dir === 'rtl' ? 'row-reverse' : 'row';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 130, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <T style={{ fontSize: 28, fontWeight: '800' }}>{t('m.records.title')}</T>
      {cur && <MonthSwitcher label={`${monthLabel(cur.m, t)} ${cur.y}`} sub={r ? t('m.records.period', { from: fmtShort(r.period.from, t), to: fmtShort(r.period.to, t) }) : undefined} offset={offset} onChange={setOffset} />}
      {data === null && <ActivityIndicator style={{ marginTop: 30 }} color={C.black} />}
      {data?.empty && <T style={{ color: C.muted, textAlign: 'center', marginTop: 30 }}>{t('m.records.empty')}</T>}
      {r && (<>
        <View style={{ backgroundColor: C.black, borderRadius: R.xl, padding: 20, gap: 14 }}>
          <T style={{ color: '#a8a499', fontSize: 12 }}>{t('m.records.netExpected')}</T>
          <T style={{ color: C.paper, fontSize: 34, fontWeight: '800' }}>{sar(row.netSalaryMinor)} <T style={{ color: '#a8a499', fontSize: 14 }}>{t('m.common.currency')}</T></T>
          <View style={{ flexDirection: rowDir, gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#1e1e21', borderRadius: R.md, padding: 12 }}><T style={{ color: '#a8a499', fontSize: 12 }}>{t('m.records.deductions')}</T><T style={{ color: row.lateDeductionsMinor + row.absentDeductionsMinor ? '#ff8a6b' : C.paper, fontWeight: '800', fontSize: 16 }}>{sar(row.lateDeductionsMinor + row.absentDeductionsMinor)}</T></View>
            <View style={{ flex: 1, backgroundColor: '#1e1e21', borderRadius: R.md, padding: 12 }}><T style={{ color: '#a8a499', fontSize: 12 }}>{t('m.records.bonus')}</T><T style={{ color: row.bonusMinor ? '#6fe0a0' : C.paper, fontWeight: '800', fontSize: 16 }}>{r.finalized ? sar(row.bonusMinor) : '—'}</T></View></View>
          <T style={{ color: '#d7d3c8', fontSize: 13 }}>{bonusNote}</T></View>

        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>{t('m.records.summary')}</T>
          <View style={{ flexDirection: rowDir, flexWrap: 'wrap', gap: 10 }}>{tiers.map((tier) => (<View key={tier.key} style={{ flexDirection: rowDir, alignItems: 'center', gap: 6, backgroundColor: C.soft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }}><Dot color={tier.color} /><T style={{ fontWeight: '700' }}>{tierLabel(tier.label, t)}</T><T style={{ color: C.muted }}>{r.counts[tier.key] ?? 0}</T></View>))}
            {r.counts.REDEEMED > 0 && <View style={{ backgroundColor: C.soft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }}><T style={{ fontWeight: '700' }}>{t('m.records.redeemedCount', { n: r.counts.REDEEMED })}</T></View>}</View></Card>

        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>{t('m.records.calendar')}</T>
          <View style={{ gap: 6 }}>{rows.map((wk, i) => (<View key={i} style={{ flexDirection: rowDir, gap: 6 }}>{Array.from({ length: 7 }, (_, j) => { const d = wk[j]; if (!d) return <View key={j} style={{ width: cell, height: cell }} />;
            const lk = look(d.status); const isToday = meta?.today === d.date; const neutral = !!NEUTRAL[d.status];
            return (<View key={j} style={{ width: cell, height: cell, borderRadius: cell / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: lk.color, borderWidth: isToday ? 3 : d.redeemed ? 2.5 : d.status === 'FUTURE' ? 1 : 0, borderColor: isToday ? C.black : d.redeemed ? C.info : C.line, opacity: d.status === 'FUTURE' ? 0.6 : 1 }}>
              <T style={{ fontSize: 12, fontWeight: '700', color: neutral ? C.black : '#fff', textAlign: 'center' }}>{Number(d.date.slice(8))}</T></View>); })}</View>))}</View>
          <T style={{ color: C.muted, fontSize: 12 }}>{t('m.records.calendarHint')}</T></Card>

        <Card><T style={{ fontSize: 17, fontWeight: '800' }}>{t('m.records.days')}</T>
          {past.length === 0 ? <T style={{ color: C.muted }}>{t('m.records.noDays')}</T> : past.map((d: any, i: number) => { const lk = look(d.status); const neutral = !!NEUTRAL[d.status];
            return (<View key={d.date} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.soft, gap: 4 }}>
              <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}><T style={{ fontWeight: '700' }}>{fmtDay(d.date, t)}</T><Badge text={lk.label} bg={neutral ? C.soft : lk.color} color={neutral ? C.black : '#fff'} /></View>
              <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}><T style={{ color: C.muted, fontSize: 13 }}>{d.checkInMinutes != null ? t('m.records.checkInAt', { time: hhmm12(d.checkInMinutes, locale) }) : neutral ? '' : t('m.records.noRecord')}{d.lateMinutes ? t('m.records.late', { n: d.lateMinutes }) : ''}</T>
                {d.deduction > 0 ? <T style={{ color: d.redeemed ? C.muted : C.bad, fontSize: 13, fontWeight: '700', textDecorationLine: d.redeemed ? 'line-through' : 'none' }}>-{sar(d.deduction)}</T> : null}</View>
              {d.redeemed ? <T style={{ color: C.info, fontSize: 12 }}>{t('m.records.redeemedBy', { date: fmtDay(d.redeemedBy[0], t) })}</T> : null}</View>); })}</Card></>)}
    </ScrollView>
  );
}
