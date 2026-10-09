import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';
import { C, R } from './theme';
import { T } from './ui';

export interface YM { y: number; m: number }
export const shiftYM = (b: YM, d: number): YM => { const t = b.y * 12 + (b.m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };

/** Previous / current / next month only, as requested: `offset` is -1, 0 or +1 from the current month. */
export default function MonthSwitcher({ label, sub, offset, onChange }: { label: string; sub?: string; offset: number; onChange: (o: number) => void }) {
  const Btn = ({ icon, disabled, onPress }: { icon: 'chevron-forward' | 'chevron-back'; disabled: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color={C.black} /></Pressable>);
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Btn icon="chevron-forward" disabled={offset <= -1} onPress={() => onChange(offset - 1)} />
      <View style={{ flex: 1, alignItems: 'center' }}><T style={{ fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{label}</T>{sub ? <T style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{sub}</T> : null}
        {offset !== 0 && <Pressable onPress={() => onChange(0)}><T style={{ color: C.accent, fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'center' }}>العودة للحالي</T></Pressable>}</View>
      <Btn icon="chevron-back" disabled={offset >= 1} onPress={() => onChange(offset + 1)} />
    </View>);
}
