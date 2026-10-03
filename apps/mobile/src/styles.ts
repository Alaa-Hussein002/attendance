import { StyleSheet } from 'react-native';
export const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f8fafc' }, screen: { padding: 20, paddingTop: 56, gap: 12, flexGrow: 1, backgroundColor: '#f8fafc' },
  h1: { fontSize: 24, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl', color: '#0f172a' }, h2: { fontSize: 17, fontWeight: '600', textAlign: 'right', color: '#0f172a' },
  label: { fontSize: 13, color: '#64748b', textAlign: 'right', marginBottom: 4 }, hint: { fontSize: 13, color: '#64748b', textAlign: 'right', writingDirection: 'rtl' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 16, textAlign: 'right' },
  btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center' }, btnT: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', padding: 12 }, err: { color: '#dc2626', textAlign: 'right' }, ok: { color: '#16a34a', textAlign: 'right' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 }, big: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginVertical: 8 },
  checkin: { backgroundColor: '#2563eb', borderRadius: 100, height: 150, width: 150, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  checkinT: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  cal: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }, cell: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderColor: '#2563eb' },
  cellT: { fontSize: 12, color: '#0f172a', fontWeight: '600' }, legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
