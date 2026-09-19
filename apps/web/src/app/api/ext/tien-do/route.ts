// GET  /api/ext/tien-do?project=ios-app|nhom=iOS[&full=1]  — danh sách (full=1 kèm bước, để `tiendo export` chiếu ra sheet)
// POST /api/ext/tien-do  {project_id, nhom, ten, uu_tien?, trang_thai?, lan?, goc?, mo_ta?, ghi_chu?, ai?, so?, cong?, link?, ma?, buoc?: string[]}
import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { listHangMuc, getHangMuc, themHangMuc } from '@/lib/tien-do';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await checkAuth(req); if (denied) return denied;
  const u = new URL(req.url);
  const list = await listHangMuc({ project_id: u.searchParams.get('project') ?? undefined, nhom: u.searchParams.get('nhom') ?? undefined });
  if (u.searchParams.get('full') !== '1') return NextResponse.json({ ok: true, items: list });
  const full = [];
  for (const y of list) full.push(await getHangMuc(y.id));
  return NextResponse.json({ ok: true, items: full });
}

export async function POST(req: Request) {
  const denied = await checkAuth(req); if (denied) return denied;
  const b = await req.json();
  if (!b?.project_id || !b?.nhom || !b?.ten) return NextResponse.json({ ok: false, error: 'thiếu project_id/nhom/ten' }, { status: 400 });
  const item = await themHangMuc(b, Array.isArray(b.buoc) ? b.buoc.map(String) : []);
  return NextResponse.json({ ok: true, item });
}
