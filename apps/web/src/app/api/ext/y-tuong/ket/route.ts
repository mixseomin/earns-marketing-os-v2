// GET /api/ext/y-tuong/ket — mọi bước đang Kẹt (blocker) toàn portfolio, cho /now
import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { listBuocKet } from '@/lib/y-tuong';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await checkAuth(req); if (denied) return denied;
  return NextResponse.json({ ok: true, items: await listBuocKet() });
}
