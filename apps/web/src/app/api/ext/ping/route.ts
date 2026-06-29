import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;
  return NextResponse.json({ ok: true, server: 'MOS2' });
}
