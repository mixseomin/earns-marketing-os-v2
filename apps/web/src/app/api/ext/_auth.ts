import { NextResponse } from 'next/server';

export function checkAuth(req: Request): NextResponse | null {
  const key = process.env.MOS2_EXT_KEY;
  if (!key) return NextResponse.json({ error: 'MOS2_EXT_KEY not configured' }, { status: 503 });
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${key}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
