import * as Haptics from 'expo-haptics';
import React, { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from './theme';

export const T = ({ style, ...p }: TextProps) => <Text {...p} style={[{ color: C.black, textAlign: 'right', writingDirection: 'rtl', fontSize: 15 }, style]} />;

/* ---------- unified system messages (banner at the top, below the notch) ---------- */
type Kind = 'success' | 'error' | 'info';
const ToastCtx = createContext<(k: Kind, title: string, body?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets(); const y = useRef(new Animated.Value(-200)).current; const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [t, setT] = useState<{ kind: Kind; title: string; body?: string } | null>(null);
  const show = useCallback((kind: Kind, title: string, body?: string) => {
    setT({ kind, title, body });
    Haptics.notificationAsync(kind === 'error' ? Haptics.NotificationFeedbackType.Error : kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 7 }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(y, { toValue: -200, duration: 220, useNativeDriver: true }).start(() => setT(null)), kind === 'error' ? 5200 : 3300);
  }, [y]);
  const dot = t?.kind === 'success' ? C.ok : t?.kind === 'info' ? C.info : C.accent;
  return (<ToastCtx.Provider value={show}>{children}
    {t && <Animated.View pointerEvents="none" style={[s.toast, { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <View style={[s.toastDot, { backgroundColor: dot }]} /><View style={{ flex: 1 }}><T style={{ color: C.paper, fontWeight: '700' }}>{t.title}</T>{t.body ? <T style={{ color: '#bdb9ae', fontSize: 13, marginTop: 2 }}>{t.body}</T> : null}</View></Animated.View>}
  </ToastCtx.Provider>);
}

/* ---------- building blocks ---------- */
export function Button({ title, onPress, kind = 'primary', disabled, loading, style }: { title: string; onPress: () => void; kind?: 'primary' | 'accent' | 'ghost' | 'light'; disabled?: boolean; loading?: boolean; style?: ViewStyle }) {
  const bg = kind === 'primary' ? C.black : kind === 'accent' ? C.accent : kind === 'light' ? C.white : 'transparent';
  const fg = kind === 'ghost' ? C.black : kind === 'light' ? C.black : C.paper;
  return (<Pressable disabled={disabled || loading} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }} style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: C.line }, style]}>
    {loading ? <ActivityIndicator color={fg} /> : <T style={{ color: fg, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{title}</T>}</Pressable>);
}
export function Field({ label, ltr, ...p }: TextInputProps & { label: string; ltr?: boolean }) {
  return (<View style={{ gap: 6 }}><T style={{ color: C.muted, fontSize: 13 }}>{label}</T>
    <TextInput placeholderTextColor="#aaa79d" {...p} style={[s.input, { textAlign: ltr ? 'left' : 'right', writingDirection: ltr ? 'ltr' : 'rtl' }]} /></View>);
}
export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;
export const Badge = ({ text, bg = C.soft, color = C.black }: { text: string; bg?: string; color?: string }) => (<View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start' }}><T style={{ color, fontSize: 12, fontWeight: '700' }}>{text}</T></View>);
export function Segmented<K extends string>({ value, onChange, options }: { value: K; onChange: (v: K) => void; options: [K, string][] }) {
  return (<View style={s.seg}>{options.map(([k, l]) => (<Pressable key={k} onPress={() => onChange(k)} style={[s.segItem, value === k && { backgroundColor: C.white, shadowOpacity: 0.08 }]}><T style={{ textAlign: 'center', fontWeight: '700', color: value === k ? C.black : C.muted }}>{l}</T></Pressable>))}</View>);
}
export function ChipRow<V extends string>({ items, value, onChange }: { items: { value: V; label: string }[]; value: V | null; onChange: (v: V) => void }) {
  return (<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row-reverse', paddingVertical: 2 }}>{items.map((i) => (
    <Pressable key={i.value} onPress={() => onChange(i.value)} style={[s.chip, value === i.value && { backgroundColor: C.black, borderColor: C.black }]}><T style={{ color: value === i.value ? C.paper : C.black, fontWeight: '600', fontSize: 13 }}>{i.label}</T></Pressable>))}</ScrollView>);
}
export const Dot = ({ color, size = 12 }: { color: string; size?: number }) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;

const s = StyleSheet.create({
  toast: { position: 'absolute', left: 14, right: 14, backgroundColor: C.black, borderRadius: R.lg, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, zIndex: 50, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  toastDot: { width: 10, height: 10, borderRadius: 5 },
  btn: { height: 54, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 14, height: 52, fontSize: 16, color: C.black },
  card: { backgroundColor: C.white, borderRadius: R.lg, padding: 18, borderWidth: 1, borderColor: C.line, gap: 12 },
  seg: { flexDirection: 'row-reverse', backgroundColor: C.soft, borderRadius: R.md, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: R.sm, shadowColor: '#000', shadowOpacity: 0, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
});
