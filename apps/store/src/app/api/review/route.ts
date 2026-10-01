// POST /api/review — khách viết đánh giá → hàng chờ duyệt (trang_thai 'cho'). Email trùng người đã mua đúng sản phẩm này → Verified Buyer.
import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { shopHienTai } from '@/lib/shop';
import { ipCua, quaGioiHan } from '@/lib/chan';

const cat = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

export async function POST(req: Request) {
  const s = await shopHienTai(); const db = getDb();
  if (!s || !db) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  if (quaGioiHan(`dg:${ipCua(req)}`, 5)) return NextResponse.json({ loi: 'nhieu' }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sao = Math.round(Number(b.sao)), ten = cat(b.ten, 60), email = cat(b.email, 200).toLowerCase(), nd = cat(b.noi_dung, 3000);
  if (!(sao >= 1 && sao <= 5) || !ten || nd.length < 10) return NextResponse.json({ loi: 'thieu' }, { status: 400 });
  const r = await db.execute(sql`
    INSERT INTO shop_danh_gia (cua_hang_id, san_pham_id, don_id, ten, email, sao, tieu_de, noi_dung)
    SELECT ${s.id}, p.id,
           (SELECT d.id FROM shop_don d JOIN shop_don_mon m ON m.don_id = d.id JOIN shop_bien_the b ON b.id = m.bien_the_id
             WHERE d.cua_hang_id = ${s.id} AND b.san_pham_id = p.id AND lower(d.khach->>'email') = ${email} AND d.tra_luc IS NOT NULL LIMIT 1),
           ${ten}, ${email || null}, ${sao}, ${cat(b.tieu_de, 120) || null}, ${nd}
      FROM shop_san_pham p WHERE p.id = ${Number(b.sp)} AND p.cua_hang_id = ${s.id}
    RETURNING id`);
  return (r as unknown as unknown[]).length ? NextResponse.json({ ok: true }) : NextResponse.json({ loi: 'sp' }, { status: 400 });
}
