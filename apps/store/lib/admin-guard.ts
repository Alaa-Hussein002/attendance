import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from './admin';

export function adminOk(req?: NextRequest): boolean {
  const token = req ? req.cookies.get('store_admin')?.value : cookies().get('store_admin')?.value;
  return verifyAdminToken(token);
}

export function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
