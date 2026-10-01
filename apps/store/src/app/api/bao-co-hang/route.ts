// POST /api/bao-co-hang {sp, bt?, email} — khách bấm "Notify me" khi món đang hết (thường vì NCC hết hàng / gỡ tạm). Máy gửi thư
// "Back in stock" khi mở bán lại (mos2 dong-bo apDungNcc). Một email chỉ ghi một lần cho mỗi món đang chờ.
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { q } from '@mos2/shop/su-kien';
import { shopHienTai } from '@/lib/shop';
import { ipCua, quaGioiHan } from '@/lib/chan';

export async function POST(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  if (quaGioiHan(`bch:${ipCua(req)}`, 10)) return NextResponse.json({ loi: 'nhieu' }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { sp?: number; bt?: number | null; email?: string };
  const email = String(b.email ?? '').trim().toLowerCase().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ loi: 'email' }, { status: 400 });
  const [sp] = await q<{ id: number }>(sql`SELECT id FROM shop_san_pham WHERE id = ${Number(b.sp) || 0} AND cua_hang_id = ${s.id}`);
  if (!sp) return NextResponse.json({ loi: 'sp' }, { status: 404 });
  const bt = b.bt ? Number(b.bt) : null;
  if (bt) { const [x] = await q(sql`SELECT 1 FROM shop_bien_the WHERE id = ${bt} AND san_pham_id = ${sp.id}`); if (!x) return NextResponse.json({ loi: 'bt' }, { status: 404 }); }
  await q(sql`INSERT INTO shop_bao_co_hang (cua_hang_id, san_pham_id, bien_the_id, email) VALUES (${s.id}, ${sp.id}, ${bt}, ${email}) ON CONFLICT DO NOTHING`);
  return NextResponse.json({ ok: true });
}
