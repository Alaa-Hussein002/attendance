'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tokens } from '../lib/api';

const LINKS = [['/employees', 'الموظفون'], ['/branches', 'الفروع'], ['/reports', 'التقارير والرواتب'], ['/leaves', 'الإجازات والأعذار'], ['/holidays', 'العطل'], ['/settings/policy', 'الإعدادات']];
export default function Nav() {
  const path = usePathname();
  if (path === '/login') return null;
  return (<nav>{LINKS.map(([h, t]) => <Link key={h} href={h} className={path.startsWith(h) ? 'on' : ''}>{t}</Link>)}
    <button onClick={() => { tokens.clear(); window.location.href = '/login'; }}>خروج</button></nav>);
}
