'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { ADMIN_ROLES, homeFor, PATH_ROLES, session, SessionUser } from '../lib/session';
import { api } from '../lib/api';
import { fmtClock, fmtDay, ROLE_AR } from '../lib/format';
import { Lockup } from './Logo';
import { useMeta } from './Providers';

const I = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const NAV: [string, string, ReactNode][] = [
  ['/tasks', 'المهام والحجوزات', I('M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11')],
  ['/reports', 'التقارير والرواتب', I('M4 20V10M10 20V4M16 20v-7M22 20H2')],
  ['/employees', 'الموظفون', I('M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8')],
  ['/branches', 'الفروع', I('M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5')],
  ['/leaves', 'الإجازات والأعذار', I('M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4')],
  ['/settings', 'الإعدادات', I('M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4')],
];
const PUBLIC = ['/login', '/setup'];

function ServerClock() {
  const { meta, offsetMs } = useMeta();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { const t = () => setNow(new Date(Date.now() + offsetMs)); t(); const i = setInterval(t, 20000); return () => clearInterval(i); }, [offsetMs]);
  if (!meta || !now) return null;
  return (<div style={{ padding: '0 8px 14px', fontSize: 12, color: '#9b988f', lineHeight: 1.7 }}>
    <div style={{ color: '#d9d6cc' }} className="num">{fmtClock(now, meta.timezone)}</div>
    <div>فترة الرواتب: <span className="num">{fmtDay(meta.payrollMonth.from)}</span> ← <span className="num">{fmtDay(meta.payrollMonth.to)}</span></div></div>);
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  useEffect(() => { const u = session.user(); setUser(u); if (!isPublic && !u) router.replace('/login'); }, [path, isPublic, router]);
  if (isPublic) return <>{children}</>;
  if (!user) return null;

  const logout = async () => { const rt = session.refresh(); if (rt) await api('/auth/logout', { method: 'POST', body: { refreshToken: rt }, auth: false }).catch(() => {}); session.clear(); router.replace('/login'); };
  if (!ADMIN_ROLES.includes(user.role)) return (
    <div className="auth"><div className="art"><Lockup invert height={60} /></div><div className="form"><div className="box">
      <h1>هذه اللوحة للإدارة</h1><p>حسابك ({ROLE_AR[user.role] ?? user.role}) يسجّل الحضور من تطبيق الجوال.</p><button className="btn primary" onClick={logout}>تسجيل الخروج</button></div></div></div>);

  const need = Object.keys(PATH_ROLES).find((k) => path.startsWith(k));
  const allowed = !need || PATH_ROLES[need].includes(user.role);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Lockup invert height={54} /></div>
        <ServerClock />
        {NAV.filter(([href]) => PATH_ROLES[href]?.includes(user.role)).map(([href, label, icon]) => <Link key={href} href={href} className={`navlink ${path.startsWith(href) ? 'on' : ''}`}>{icon}<span>{label}</span></Link>)}
        <div className="spacer" />
        <div className="userchip"><div className="av">{user.name.slice(0, 1)}</div><div className="who"><div>{user.name}</div><div className="en" style={{ opacity: .6, fontSize: 9 }}>{ROLE_AR[user.role] ?? user.role}</div></div>
          <button onClick={logout}>خروج</button></div>
      </aside>
      <main className="main"><div className="wrap">{allowed ? children : (
        <div className="card empty" style={{ padding: 48 }}><h2 style={{ color: 'var(--black)', marginBottom: 8 }}>لا تملك صلاحية هذه الصفحة</h2><p>هذا القسم خاص بمدير النظام.</p><Link className="btn primary" href={homeFor(user.role)}>العودة</Link></div>)}</div></main>
    </div>
  );
}
