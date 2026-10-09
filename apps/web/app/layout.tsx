import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import Providers from '../components/Providers';
import Shell from '../components/Shell';

export const metadata = { title: 'بيت المصور — الحضور', description: 'نظام الحضور والرواتب' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><Providers><Shell>{children}</Shell></Providers></body>
    </html>
  );
}
