// Nhận số theo ngày của sản phẩm từ job trình duyệt chạy ở MÁY CỦA NGƯỜI DÙNG.
//
// Vì sao job không chạy trên server: phiên đăng nhập Gumroad nằm trong profile Chrome ở máy cá nhân,
// và trang Analytics đòi đăng nhập thật. Đưa phiên đó lên box = chép cookie phiên qua mạng, vừa dễ
// hỏng vừa thừa. Job chạy local (LaunchAgent), đẩy KẾT QUẢ lên đây.
//
// Upsert theo (store, product_id, date) → chạy lại nhiều lần trong ngày không đẻ dòng trùng.
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';

export async function POST(req: Request) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 500 });

  let body: { store?: string; date?: string; rows?: Array<{ productId?: string; date?: string; views?: number; sales?: number; usdCents?: number }> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body không phải JSON' }, { status: 400 }); }

  const store = String(body.store ?? '').trim();
  if (!store) return NextResponse.json({ ok: false, error: 'thiếu store' }, { status: 400 });
  // Ngày khai theo TỪNG DÒNG (job gửi cả dải một lần); `body.date` chỉ là mặc định cho dòng thiếu.
  const fallback = String(body.date ?? '').trim();
  const rows = (body.rows ?? []).filter((r) => r && String(r.productId ?? '').trim());
  if (!rows.length) return NextResponse.json({ ok: false, error: 'rows rỗng' }, { status: 400 });

  let n = 0;
  const bad = [];
  for (const r of rows) {
    const pid = String(r.productId).trim();
    const date = String(r.date ?? fallback).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { bad.push(`${pid}:${date || '(trống)'}`); continue; }
    const views = Math.max(0, Math.round(Number(r.views) || 0));
    const sales = Math.max(0, Math.round(Number(r.sales) || 0));
    const usd = Math.max(0, Math.round(Number(r.usdCents) || 0));
    await db.execute(sql`
      INSERT INTO product_daily (store, product_id, date, views, sales, usd_cents, source, fetched_at)
      VALUES (${store}, ${pid}, ${date}, ${views}, ${sales}, ${usd}, 'browser', now())
      ON CONFLICT (store, product_id, date) DO UPDATE
        SET views = EXCLUDED.views, sales = EXCLUDED.sales, usd_cents = EXCLUDED.usd_cents, fetched_at = now()`);
    n++;
  }
  // Báo rõ dòng bị bỏ thay vì im lặng nuốt — dòng thiếu ngày mà lặng lẽ mất thì bảng trông vẫn ổn.
  return NextResponse.json({ ok: true, store, upserted: n, skipped: bad.length, ...(bad.length ? { bad: bad.slice(0, 5) } : {}) });
}
