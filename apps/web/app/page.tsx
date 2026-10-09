'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { homeFor, session } from '../lib/session';
export default function Home() { const r = useRouter(); useEffect(() => { const u = session.user(); r.replace(u ? homeFor(u.role) : '/login'); }, [r]); return null; }
