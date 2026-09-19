// GET  /api/ext/y-tuong?nhom=iOS[&full=1]  — danh sách (full=1 kèm bước, để `ideas export` chiếu ra sheet)
// POST /api/ext/y-tuong  {nhom, ten, uu_tien?, trang_thai?, lan?, goc?, mo_ta?, ghi_chu?, link?, tab?, project_id?, buoc?: string[]}
import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { listYTuong, getYTuong, themYTuong } from '@/lib/y-tuong';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await checkAuth(req); if (denied) return denied;
  const u = new URL(req.url);
  const list = await listYTuong(u.searchParams.get('nhom') ?? undefined);
  if (u.searchParams.get('full') !== '1') return NextResponse.json({ ok: true, items: list });
  const full = [];
  for (const y of list) full.push(await getYTuong(y.id));
  return NextResponse.json({ ok: true, items: full });
}

export async function POST(req: Request) {
  const denied = await checkAuth(req); if (denied) return denied;
  const b = await req.json();
  if (!b?.nhom || !b?.ten) return NextResponse.json({ ok: false, error: 'thiếu nhom/ten' }, { status: 400 });
  const item = await themYTuong(b, Array.isArray(b.buoc) ? b.buoc.map(String) : []);
  return NextResponse.json({ ok: true, item });
}
