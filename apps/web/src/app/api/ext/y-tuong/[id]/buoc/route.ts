// PUT /api/ext/y-tuong/<id>/buoc  {mode: 'append'|'replace', buoc: string[]}
import { NextResponse } from 'next/server';
import { checkAuth } from '../../../_auth';
import { datBuoc, getYTuong } from '@/lib/y-tuong';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await checkAuth(req); if (denied) return denied;
  const id = Number((await ctx.params).id);
  if (!(await getYTuong(id))) return NextResponse.json({ ok: false, error: 'không có' }, { status: 404 });
  const b = await req.json();
  const buoc = Array.isArray(b.buoc) ? b.buoc.map(String).filter(Boolean) : [];
  if (!buoc.length && b.mode !== 'replace') return NextResponse.json({ ok: false, error: 'thiếu buoc' }, { status: 400 });
  const out = await datBuoc(id, buoc, b.mode === 'replace' ? 'replace' : 'append');
  return NextResponse.json({ ok: true, buoc: out });
}
