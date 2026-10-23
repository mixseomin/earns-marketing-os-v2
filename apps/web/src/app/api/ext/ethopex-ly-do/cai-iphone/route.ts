import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

// LINK CÀI USERSCRIPT iPHONE (anh 23/10/2026): https://mos2.on.tc/api/ext/ethopex-ly-do/cai-iphone — mở trong Safari iPhone đã đăng nhập mos2 (admin)
// → chuyển sang user.js?k=<khoá> để app Userscripts nhận cài. Khoá extension không bao giờ phải dán ra chat / Telegram.
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.redirect('https://mos2.on.tc/login?next=/api/ext/ethopex-ly-do/cai-iphone');
  const r = (await getDb()!.execute(sql`SELECT gia_tri->>'token' AS t FROM xv_khoa_ngoai WHERE ten = 'ethopex_ext'`)) as unknown as { t: string | null }[];
  if (!r[0]?.t) return new Response('chưa có khoá extension', { status: 500 });
  return NextResponse.redirect(`https://mos2.on.tc/api/ext/ethopex-ly-do/user.js?k=${encodeURIComponent(r[0].t)}`);
}
