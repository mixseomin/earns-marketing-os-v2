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

  let body: { store?: string; date?: string; rows?: Array<{ productId?: string; date?: string; views?: number; sales?: number; usdCents?: number; refs?: Record<string, unknown> }> };
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
    const refs = cleanRefs(r.refs);
    await db.execute(sql`
      INSERT INTO product_daily (store, product_id, date, views, sales, usd_cents, refs, source, fetched_at)
      VALUES (${store}, ${pid}, ${date}, ${views}, ${sales}, ${usd}, ${JSON.stringify(refs)}::jsonb, 'browser', now())
      ON CONFLICT (store, product_id, date) DO UPDATE
        SET views = EXCLUDED.views, sales = EXCLUDED.sales, usd_cents = EXCLUDED.usd_cents,
            -- Chỉ đè refs khi lần chạy này ĐỌC ĐƯỢC nguồn. Endpoint by_referral hỏng mà vẫn ghi {}
            -- thì lần chạy lỗi xoá sạch dữ liệu nguồn của lần chạy tốt trước đó.
            refs = CASE WHEN EXCLUDED.refs = '{}'::jsonb THEN product_daily.refs ELSE EXCLUDED.refs END,
            fetched_at = now()`);
    n++;
  }
  // Báo rõ dòng bị bỏ thay vì im lặng nuốt — dòng thiếu ngày mà lặng lẽ mất thì bảng trông vẫn ổn.
  return NextResponse.json({ ok: true, store, upserted: n, skipped: bad.length, ...(bad.length ? { bad: bad.slice(0, 5) } : {}) });
}

/** Chỉ nhận map nguồn → số nguyên dương. Job gửi gì lạ thì bỏ, đừng nhét rác vào jsonb. */
function cleanRefs(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim().slice(0, 80);
    const n = Math.round(Number(v));
    if (key && Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}
