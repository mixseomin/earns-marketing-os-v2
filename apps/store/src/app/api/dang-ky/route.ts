// POST /api/dang-ky {email, trang} — ô "Join Us & Get X% OFF" ở chân trang: lưu email, trả mã giảm (mat_tien.dang_ky.ma) áp được ở checkout.
import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { shopHienTai } from '@/lib/shop';
import { ipCua, quaGioiHan } from '@/lib/chan';

export async function POST(req: Request) {
  const s = await shopHienTai(); const db = getDb();
  if (!s || !db) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  if (quaGioiHan(`dk:${ipCua(req)}`, 8)) return NextResponse.json({ loi: 'nhieu' }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; trang?: string };
  const email = String(b.email ?? '').trim().toLowerCase().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ loi: 'email' }, { status: 400 });
  await db.execute(sql`INSERT INTO shop_dang_ky (cua_hang_id, email, nguon) VALUES (${s.id}, ${email}, ${String(b.trang ?? '').slice(0, 200)}) ON CONFLICT DO NOTHING`);
  return NextResponse.json({ ok: true, ma: s.mt.dang_ky?.ma ?? null });
}
