import './globals.css';
import type { ReactNode } from 'react';
import Nav from '../components/Nav';

export const metadata = { title: 'نظام الحضور' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="ar" dir="rtl"><body><main><Nav />{children}</main></body></html>);
}
