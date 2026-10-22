'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { ADMIN_ROLES, homeFor, PATH_ROLES, session, SessionUser } from '../lib/session';
import { api } from '../lib/api';
import { fmtClock, fmtDay, roleLabel } from '../lib/format';
import { Lockup } from './Logo';
import { useMeta } from './Providers';
import { useI18n } from '@attendance/i18n/react';

const I = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const NAV: [string, string, ReactNode][] = [
  ['/tasks', 'w.nav.tasks', I('M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11')],
  ['/reports', 'w.nav.reports', I('M4 20V10M10 20V4M16 20v-7M22 20H2')],
  ['/employees', 'w.nav.employees', I('M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8')],
  ['/branches', 'w.nav.branches', I('M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5')],
  ['/leaves', 'w.nav.leaves', I('M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4')],
  ['/settings', 'w.nav.settings', I('M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4')],
];
const PUBLIC = ['/login', '/setup'];

function ServerClock() {
  const { meta, offsetMs } = useMeta();
  const { t, locale } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { const tick = () => setNow(new Date(Date.now() + offsetMs)); tick(); const i = setInterval(tick, 20000); return () => clearInterval(i); }, [offsetMs]);
  if (!meta || !now) return null;
  return (<div style={{ padding: '0 8px 14px', fontSize: 12, color: '#9b988f', lineHeight: 1.7 }}>
    <div style={{ color: '#d9d6cc' }} className="num">{fmtClock(now, meta.timezone, locale)}</div>
    <div>{t('w.shell.payrollPeriod')}: <span className="num">{fmtDay(meta.payrollMonth.from, t)}</span> ← <span className="num">{fmtDay(meta.payrollMonth.to, t)}</span></div></div>);
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  useEffect(() => { const u = session.user(); setUser(u); if (!isPublic && !u) router.replace('/login'); }, [path, isPublic, router]);
  if (isPublic) return <>{children}</>;
  if (!user) return null;

  const logout = async () => { const rt = session.refresh(); if (rt) await api('/auth/logout', { method: 'POST', body: { refreshToken: rt }, auth: false }).catch(() => {}); session.clear(); router.replace('/login'); };
  const switchTo = (next: 'ar' | 'en') => { if (next === locale) return; setLocale(next); document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`; router.refresh(); };
  if (!ADMIN_ROLES.includes(user.role)) return (
    <div className="auth"><div className="art"><Lockup invert height={60} /></div><div className="form"><div className="box">
      <h1>{t('w.shell.adminOnly')}</h1><p>{t('w.shell.adminOnlyBody', { role: roleLabel(user.role, t) })}</p><button className="btn primary" onClick={logout}>{t('w.shell.logout')}</button></div></div></div>);

  const need = Object.keys(PATH_ROLES).find((k) => path.startsWith(k));
  const allowed = !need || PATH_ROLES[need].includes(user.role);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Lockup invert height={54} /></div>
        <ServerClock />
        <div className="lang-switch" aria-label={t('w.shell.languageLabel')}>
          <button type="button" className={locale === 'ar' ? 'on' : ''} onClick={() => switchTo('ar')}>{t('common.arabic')}</button>
          <button type="button" className={locale === 'en' ? 'on' : ''} onClick={() => switchTo('en')}>{t('common.english')}</button>
        </div>
        {NAV.filter(([href]) => PATH_ROLES[href]?.includes(user.role)).map(([href, label, icon]) => <Link key={href} href={href} className={`navlink ${path.startsWith(href) ? 'on' : ''}`}>{icon}<span>{t(label)}</span></Link>)}
        <div className="spacer" />
        <div className="userchip"><div className="av">{user.name.slice(0, 1)}</div><div className="who"><div>{user.name}</div><div className="en" style={{ opacity: .6, fontSize: 9 }}>{roleLabel(user.role, t)}</div></div>
          <button onClick={logout}>{t('w.shell.logout')}</button></div>
      </aside>
      <main className="main"><div className="wrap">{allowed ? children : (
        <div className="card empty" style={{ padding: 48 }}><h2 style={{ color: 'var(--black)', marginBottom: 8 }}>{t('w.shell.noAccess')}</h2><p>{t('w.shell.noAccessBody')}</p><Link className="btn primary" href={homeFor(user.role)}>{t('w.shell.backHome')}</Link></div>)}</div></main>
    </div>
  );
}
