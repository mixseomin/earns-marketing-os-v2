// GET/PATCH /api/ext/y-tuong/<id>  — chi tiết (bước + nhật ký) / sửa trường (kể cả trang_thai đặt tay)
import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getYTuong, suaYTuong, Y_TUONG_TRANG_THAI } from '@/lib/y-tuong';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const denied = await checkAuth(req); if (denied) return denied;
  const item = await getYTuong(Number((await ctx.params).id));
  return item ? NextResponse.json({ ok: true, item }) : NextResponse.json({ ok: false, error: 'không có' }, { status: 404 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await checkAuth(req); if (denied) return denied;
  const b = await req.json();
  if (b.trang_thai && !(Y_TUONG_TRANG_THAI as readonly string[]).includes(b.trang_thai)) return NextResponse.json({ ok: false, error: 'trạng thái: ' + Y_TUONG_TRANG_THAI.join(' | ') }, { status: 400 });
  const item = await suaYTuong(Number((await ctx.params).id), b);
  return item ? NextResponse.json({ ok: true, item }) : NextResponse.json({ ok: false, error: 'không có' }, { status: 404 });
}
