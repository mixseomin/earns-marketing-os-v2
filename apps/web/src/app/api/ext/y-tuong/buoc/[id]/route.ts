// PATCH /api/ext/y-tuong/buoc/<buocId>  {trang_thai?, ket_qua?, ghi_chu?, buoc?} → trả bước + ý tưởng (đã tính lại trạng thái)
import { NextResponse } from 'next/server';
import { checkAuth } from '../../../_auth';
import { suaBuoc } from '@/lib/y-tuong';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await checkAuth(req); if (denied) return denied;
  try {
    const r = await suaBuoc(Number((await ctx.params).id), await req.json());
    return r ? NextResponse.json({ ok: true, ...r }) : NextResponse.json({ ok: false, error: 'không có' }, { status: 404 });
  } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 }); }
}
