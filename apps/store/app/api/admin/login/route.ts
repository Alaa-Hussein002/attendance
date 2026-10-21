export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminPasswordValid, signAdminToken, adminCookieValue } from '@/lib/admin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminPasswordValid(String(body?.password ?? ''))) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }
  const token = signAdminToken();
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', adminCookieValue(token));
  return res;
}


