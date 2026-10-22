import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@attendance/i18n/react';
import { ApiError, request } from './api';
import { useMeta } from './app-context';
import { fmtDay, hhmm12, monthLabel } from './format';
import { msg } from './messages';
import { openMap } from './Tasks';
import { C, R } from './theme';
import { Badge, Button, Card, Field, T, useToast } from './ui';

type Staff = { id: string; name: string; active: boolean; tracksAttendance: boolean };
type Assignee = { userId: string; name: string };
type Task = {
  id: string; title: string; details?: string | null; address?: string | null; latitude: number; longitude: number;
  radiusMeters: number; status: 'SCHEDULED' | 'CANCELLED' | 'DONE'; date: string; startTime: string; endTime: string;
  startsAt: string; endsAt: string; assignees: Assignee[];
};
type TaskForm = {
  id: string; title: string; details: string; address: string; date: string; startTime: string; endTime: string;
  latitude: string; longitude: string; radius: string; assigneeIds: string[];
};

const blank = (date = ''): TaskForm => ({ id: '', title: '', details: '', address: '', date, startTime: '14:00', endTime: '17:00', latitude: '', longitude: '', radius: '150', assigneeIds: [] });
const ST: Record<string, { key: string; bg: string; color: string }> = {
  SCHEDULED: { key: 'm.mt.status.SCHEDULED', bg: '#e4eefc', color: C.info },
  CANCELLED: { key: 'm.mt.status.CANCELLED', bg: '#ececec', color: C.muted },
  DONE: { key: 'm.mt.status.DONE', bg: '#e4f5ea', color: C.ok },
};
const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const locationNumber = (value: string, min: number, max: number) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

export default function ManagedTasks() {
  const { t, dir, locale } = useI18n();
  const toast = useToast(); const insets = useSafeAreaInsets(); const { meta } = useMeta();
  const [monthOffset, setMonthOffset] = useState(0);
  const [rows, setRows] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [form, setForm] = useState<TaskForm>(blank());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const month = useMemo(() => {
    if (!meta) return null;
    const today = { y: Number(meta.today.slice(0, 4)), m: Number(meta.today.slice(5, 7)) };
    const total = today.y * 12 + today.m - 1 + monthOffset;
    return { y: Math.floor(total / 12), m: total % 12 + 1 };
  }, [meta, monthOffset]);
  const employeeOptions = useMemo(() => staff.filter((person) => !staffSearch.trim() || person.name.includes(staffSearch.trim())), [staff, staffSearch]);
  const assignableOptions = useMemo(() => staff.filter((person) => !form.assigneeIds.includes(person.id) && (!assigneeSearch.trim() || person.name.includes(assigneeSearch.trim()))), [staff, form.assigneeIds, assigneeSearch]);

  const load = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    const from = `${month.y}-${pad(month.m)}-01`;
    const to = `${month.y}-${pad(month.m)}-${pad(daysInMonth(month.y, month.m))}`;
    try {
      const params = new URLSearchParams({ from, to });
      if (selectedEmployee) params.set('userId', selectedEmployee);
      setRows(await request(`/tasks?${params.toString()}`));
    } catch (error) {
      toast('error', t('m.mt.loadError'), msg(error instanceof ApiError ? error.code : '', t));
    } finally {
      setLoading(false);
    }
  }, [month, selectedEmployee, toast, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    request<Staff[]>('/employees').then((people) => setStaff(people.filter((person) => person.active && person.tracksAttendance)))
      .catch((error) => toast('error', t('m.mt.staffLoadError'), msg(error instanceof ApiError ? error.code : '', t)));
  }, [toast, t]);

  const days = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of rows) {
      const list = grouped.get(task.date) ?? [];
      list.push(task);
      grouped.set(task.date, list);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const beginEdit = (task?: Task) => {
    setAssigneeSearch('');
    setForm(task ? {
      id: task.id, title: task.title, details: task.details ?? '', address: task.address ?? '', date: task.date,
      startTime: task.startTime, endTime: task.endTime, latitude: String(task.latitude), longitude: String(task.longitude),
      radius: String(task.radiusMeters), assigneeIds: task.assignees.map((person) => person.userId),
    } : blank(meta?.today ?? ''));
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setForm(blank()); };

  const valid = form.title.trim().length > 0 && validDate(form.date) && validTime(form.startTime) && validTime(form.endTime) &&
    form.endTime > form.startTime && locationNumber(form.latitude, -90, 90) && locationNumber(form.longitude, -180, 180) &&
    Number.isInteger(Number(form.radius)) && Number(form.radius) >= 30 && Number(form.radius) <= 2000 && form.assigneeIds.length > 0;

  const useCurrentLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        toast('error', t('m.mt.permission'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((current) => ({ ...current, latitude: String(position.coords.latitude), longitude: String(position.coords.longitude) }));
    } catch (error) {
      toast('error', t('m.mt.locError'), msg(error instanceof ApiError ? error.code : '', t));
    }
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(), details: form.details.trim(), address: form.address.trim(), date: form.date,
        startTime: form.startTime, endTime: form.endTime, latitude: Number(form.latitude), longitude: Number(form.longitude),
        radiusMeters: Number(form.radius), assigneeIds: form.assigneeIds,
      };
      const result = await request<{ conflicts?: { name: string; title: string }[] }>(form.id ? `/tasks/${form.id}` : '/tasks', { method: form.id ? 'PUT' : 'POST', body });
      toast('success', form.id ? t('m.mt.saved') : t('m.mt.created'), t('m.mt.notified'));
      setEditing(false);
      setForm(blank());
      await load();
      if (result.conflicts?.length) {
        Alert.alert(t('m.mt.conflictTitle'), t('m.mt.conflictBody', {
          list: result.conflicts.map((conflict) => `${conflict.name} (${conflict.title})`).join(t('m.common.listSep')),
        }));
      }
    } catch (error) {
      toast('error', t('m.mt.saveError'), msg(error instanceof ApiError ? error.code : '', t));
    } finally {
      setSaving(false);
    }
  };

  const cancelTask = (task: Task) => Alert.alert(t('m.mt.cancelTitle'), t('m.mt.cancelBody', { title: task.title }), [
    { text: t('m.mt.back'), style: 'cancel' },
    { text: t('m.mt.cancelConfirm'), style: 'destructive', onPress: async () => {
      try {
        await request(`/tasks/${task.id}/cancel`, { method: 'POST' });
        toast('success', t('m.mt.cancelled'));
        await load();
      } catch (error) {
        toast('error', t('m.mt.cancelError'), msg(error instanceof ApiError ? error.code : '', t));
      }
    } },
  ]);

  const setLocation = (key: 'latitude' | 'longitude' | 'radius', value: string) => setForm((current) => ({ ...current, [key]: value }));
  const row = dir === 'rtl' ? 'row-reverse' : 'row';
  const textInput = { height: 46, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 12, color: C.black, textAlign: dir === 'rtl' ? 'right' as const : 'left' as const, writingDirection: dir === 'rtl' ? 'rtl' as const : 'ltr' as const };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 130, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}><T style={{ fontSize: 26, fontWeight: '800' }}>{t('m.mt.title')}</T><T style={{ color: C.muted, fontSize: 13, lineHeight: 20 }}>{t('m.mt.sub')}</T></View>
        {!editing && <Pressable accessibilityRole="button" onPress={() => beginEdit()} style={{ backgroundColor: C.black, paddingHorizontal: 14, paddingVertical: 12, borderRadius: R.md, flexDirection: row, alignItems: 'center', gap: 6 }}>
          <Ionicons name="add" size={18} color={C.paper} /><T style={{ color: C.paper, fontWeight: '700', fontSize: 13 }}>{t('m.mt.new')}</T></Pressable>}
      </View>

      {editing && <Card>
        <T style={{ fontSize: 20, fontWeight: '800' }}>{form.id ? t('m.mt.editTitle') : t('m.mt.newTitle')}</T>
        <Field label={t('m.mt.titleField')} value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder={t('m.mt.titlePh')} />
        <View style={{ flexDirection: row, gap: 8 }}>
          <View style={{ flex: 1 }}><Field label={t('m.mt.date')} ltr value={form.date} onChangeText={(date) => setForm((current) => ({ ...current, date }))} placeholder="2026-10-11" keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 1 }}><Field label={t('m.mt.from')} ltr value={form.startTime} onChangeText={(startTime) => setForm((current) => ({ ...current, startTime }))} placeholder="14:00" keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 1 }}><Field label={t('m.mt.to')} ltr value={form.endTime} onChangeText={(endTime) => setForm((current) => ({ ...current, endTime }))} placeholder="17:00" keyboardType="numbers-and-punctuation" /></View>
        </View>
        {validDate(form.date) && validTime(form.startTime) && validTime(form.endTime) && form.endTime <= form.startTime && <T style={{ color: C.bad, fontSize: 12 }}>{t('m.mt.endAfterStart')}</T>}
        <Field label={t('m.mt.details')} value={form.details} onChangeText={(details) => setForm((current) => ({ ...current, details }))} placeholder={t('m.mt.detailsPh')} multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top', paddingTop: 12 }} />
        <View style={{ gap: 8 }}>
          <T style={{ color: C.muted, fontSize: 13 }}>{t('m.mt.assignees', { n: form.assigneeIds.length })}</T>
          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }}>
            {form.assigneeIds.map((id) => <Pressable key={id} onPress={() => setForm((current) => ({ ...current, assigneeIds: current.assigneeIds.filter((selected) => selected !== id) }))} style={{ backgroundColor: C.black, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 }}>
              <T style={{ color: C.paper, fontSize: 13 }}>{staff.find((person) => person.id === id)?.name ?? t('m.mt.employee')} ×</T></Pressable>)}
          </View>
          <TextInput value={assigneeSearch} onChangeText={setAssigneeSearch} placeholder={t('m.mt.searchAssignee')} placeholderTextColor="#aaa79d" style={textInput} />
          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }}>
            {assignableOptions.map((person) => <Pressable key={person.id} onPress={() => setForm((current) => ({ ...current, assigneeIds: [...current.assigneeIds, person.id] }))} style={{ backgroundColor: C.soft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 }}>
              <T style={{ fontSize: 13, fontWeight: '600' }}>+ {person.name}</T></Pressable>)}
          </View>
          {staff.length === 0 && <T style={{ color: C.muted, fontSize: 12 }}>{t('m.mt.noStaff')}</T>}
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}><T style={{ color: C.muted, fontSize: 13 }}>{t('m.mt.location')}</T>
            <Pressable onPress={useCurrentLocation} style={{ flexDirection: row, alignItems: 'center', gap: 5 }}><Ionicons name="navigate-outline" size={16} color={C.accent} /><T style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>{t('m.mt.current')}</T></Pressable></View>
          <View style={{ flexDirection: row, gap: 8 }}>
            <View style={{ flex: 1 }}><Field label={t('m.mt.lat')} ltr value={form.latitude} onChangeText={(value) => setLocation('latitude', value)} keyboardType="decimal-pad" placeholder="24.7136" /></View>
            <View style={{ flex: 1 }}><Field label={t('m.mt.lng')} ltr value={form.longitude} onChangeText={(value) => setLocation('longitude', value)} keyboardType="decimal-pad" placeholder="46.6753" /></View>
          </View>
          {locationNumber(form.latitude, -90, 90) && locationNumber(form.longitude, -180, 180) && <Pressable onPress={() => openMap(Number(form.latitude), Number(form.longitude))} style={{ alignSelf: 'flex-start', flexDirection: row, alignItems: 'center', gap: 5 }}>
            <Ionicons name="map-outline" size={16} color={C.info} /><T style={{ color: C.info, fontSize: 12 }}>{t('m.mt.viewMap')}</T></Pressable>}
          <Field label={t('m.mt.address')} value={form.address} onChangeText={(address) => setForm((current) => ({ ...current, address }))} />
          <Field label={t('m.mt.radius')} ltr value={form.radius} onChangeText={(radius) => setLocation('radius', radius)} keyboardType="number-pad" />
        </View>
        <View style={{ backgroundColor: C.soft, padding: 12, borderRadius: R.md, flexDirection: row, gap: 8 }}>
          <Ionicons name="information-circle-outline" size={18} color={C.info} /><T style={{ flex: 1, color: C.muted, fontSize: 12, lineHeight: 19 }}>{t('m.mt.note')}</T>
        </View>
        <Button title={form.id ? t('m.mt.save') : t('m.mt.book')} onPress={save} loading={saving} disabled={!valid} kind="accent" />
        <Button title={t('m.mt.cancel')} onPress={cancelEdit} kind="ghost" />
      </Card>}

      <Card>
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Pressable accessibilityLabel={t('m.mt.prevMonth')} onPress={() => setMonthOffset((offset) => offset - 1)} hitSlop={8}><Ionicons name={dir === 'rtl' ? 'chevron-forward' : 'chevron-back'} size={23} color={C.black} /></Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T style={{ fontWeight: '800', fontSize: 17 }}>{month ? `${monthLabel(month.m, t)} ${month.y}` : ''}</T>
            {monthOffset !== 0 && <Pressable onPress={() => setMonthOffset(0)}><T style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>{t('m.mt.thisMonth')}</T></Pressable>}
          </View>
          <Pressable accessibilityLabel={t('m.mt.nextMonth')} onPress={() => setMonthOffset((offset) => offset + 1)} hitSlop={8}><Ionicons name={dir === 'rtl' ? 'chevron-back' : 'chevron-forward'} size={23} color={C.black} /></Pressable>
          {loading && <ActivityIndicator color={C.black} />}
        </View>
        <TextInput value={staffSearch} onChangeText={setStaffSearch} placeholder={t('m.mt.searchTasks')} placeholderTextColor="#aaa79d" style={{ ...textInput, backgroundColor: C.paper }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: row, gap: 8 }}>
          <Pressable onPress={() => setSelectedEmployee('')} style={{ backgroundColor: selectedEmployee ? C.soft : C.black, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }}><T style={{ color: selectedEmployee ? C.black : C.paper, fontSize: 13 }}>{t('m.mt.allEmployees')}</T></Pressable>
          {employeeOptions.map((person) => <Pressable key={person.id} onPress={() => setSelectedEmployee(person.id)} style={{ backgroundColor: selectedEmployee === person.id ? C.black : C.soft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }}><T style={{ color: selectedEmployee === person.id ? C.paper : C.black, fontSize: 13 }}>{person.name}</T></Pressable>)}
        </ScrollView>
      </Card>

      {days.length === 0 && !loading && <Card style={{ alignItems: 'center', paddingVertical: 32 }}><Ionicons name="calendar-clear-outline" size={40} color="#b9b6ad" /><T style={{ color: C.muted, textAlign: 'center' }}>{t('m.mt.empty')}</T></Card>}
      {days.map(([date, tasks]) => <Card key={date} style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <View style={{ padding: 12, backgroundColor: meta?.today === date ? C.black : C.soft }}><T style={{ color: meta?.today === date ? C.paper : C.black, fontWeight: '700' }}>{fmtDay(date, t)}{meta?.today === date ? t('m.mt.today') : ''}</T></View>
        {tasks.map((task) => {
          const status = task.status === 'SCHEDULED' && meta && new Date(task.endsAt) < new Date(meta.serverTime) ? ST.DONE : ST[task.status];
          return <View key={task.id} style={{ padding: 14, gap: 9, borderBottomWidth: 1, borderBottomColor: C.line, opacity: task.status === 'CANCELLED' ? 0.58 : 1 }}>
            <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <T style={{ fontWeight: '800' }}>{hhmm12(Number(task.startTime.slice(0, 2)) * 60 + Number(task.startTime.slice(3, 5)), locale)} – {hhmm12(Number(task.endTime.slice(0, 2)) * 60 + Number(task.endTime.slice(3, 5)), locale)}</T>
              <Badge text={t(status.key)} bg={status.bg} color={status.color} />
            </View>
            <T style={{ fontSize: 17, fontWeight: '800', textDecorationLine: task.status === 'CANCELLED' ? 'line-through' : 'none' }}>{task.title}</T>
            {task.address ? <View style={{ flexDirection: row, gap: 5, alignItems: 'center' }}><Ionicons name="location-outline" size={15} color={C.muted} /><T style={{ color: C.muted, flex: 1 }}>{task.address}</T></View> : null}
            {task.details ? <T style={{ color: C.muted, lineHeight: 22 }}>{task.details}</T> : null}
            <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 6 }}>{task.assignees.map((person) => <Badge key={person.userId} text={person.name} />)}</View>
            {task.status === 'SCHEDULED' && <View style={{ flexDirection: row, gap: 8 }}>
              <Pressable onPress={() => beginEdit(task)} style={{ flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 10, alignItems: 'center' }}><T style={{ fontWeight: '700' }}>{t('m.mt.editAction')}</T></Pressable>
              <Pressable onPress={() => cancelTask(task)} style={{ flex: 1, backgroundColor: '#fce9e5', borderRadius: R.md, padding: 10, alignItems: 'center' }}><T style={{ color: C.bad, fontWeight: '700' }}>{t('m.mt.cancelAction')}</T></Pressable>
            </View>}
          </View>;
        })}
      </Card>)}
    </ScrollView>
  );
}
