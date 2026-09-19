// GET /api/ext/tien-do/ket — mọi bước đang Kẹt (blocker) toàn portfolio, cho /now (kèm project_id)
import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { listBuocKet } from '@/lib/tien-do';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await checkAuth(req); if (denied) return denied;
  return NextResponse.json({ ok: true, items: await listBuocKet() });
}
