import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { docLuoiSocial } from '@/lib/social-traffic';

export const dynamic = 'force-dynamic';

// LỊCH MÁY ĐĂNG (may-dang-lich.tsx) — cùng dữ liệu với server action taiLuoiSocial, nhưng qua GET thường:
// server action của Next chạy NỐI ĐUÔI nhau trong một trang (một hàng đợi chung của router), nên lượt tải lịch đầu
// trang xếp sau mọi action khác đang chạy / làm mới trên trang và đứng "đang tải lịch…" hàng phút dù máy chủ trả 1,8 s.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ ok: false, loi: 'Chỉ admin' }, { status: 403 });
  try { return NextResponse.json({ ok: true, ...(await docLuoiSocial()) }); }
  catch (e) { return NextResponse.json({ ok: false, loi: (e as Error).message }, { status: 500 }); }
}
