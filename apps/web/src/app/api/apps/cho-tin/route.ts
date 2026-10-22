// POST /api/apps/cho-tin — form "báo tôi khi có" trên trang sản phẩm clane.app (nginx clane.app/cho-tin → đây, giới hạn tốc độ ở nginx).
// Body JSON hoặc form: { sp, email, web? } — `web` là ô bẫy ẩn: có chữ = máy spam, giả vờ nhận. Gửi lại cùng email không nhân đôi.
// Bảng app_cho_tin (0308); thư báo do scripts/bao-cho-tin.mjs gửi khi sản phẩm lên store.
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;
const SP = /^[a-z0-9][a-z0-9-]{0,40}$/;

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  let b: Record<string, string> = {};
  const ct = req.headers.get('content-type') ?? '';
  // form thường (trình duyệt tắt JS) → quay về đúng trang sản phẩm với ?cho=ok|loi; fetch JSON → trả JSON
  const ve = (ok: boolean, ma = 200) => {
    if (ct.includes('json')) return NextResponse.json(ok ? { ok } : { ok, loi: 'email' }, { status: ma });
    const nguon = /^https:\/\/clane\.app\/[a-z0-9/-]*$/.test(String(b.nguon ?? '')) ? String(b.nguon) : 'https://clane.app/';
    return NextResponse.redirect(`${nguon}?cho=${ok ? 'ok' : 'loi'}#cho`, 303);
  };
  try {
    b = ct.includes('json') ? await req.json() : Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  } catch { return NextResponse.json({ ok: false, loi: 'body' }, { status: 400 }); }
  if (String(b.web ?? '').trim()) return ve(true);   // bẫy spam
  const sp = String(b.sp ?? '').trim().toLowerCase(), email = String(b.email ?? '').trim().toLowerCase();
  if (!SP.test(sp) || !EMAIL.test(email)) return ve(false, 400);
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim().slice(0, 64) || null;
  await db.execute(sql`INSERT INTO app_cho_tin (sp, email, nguon, ip) VALUES (${sp}, ${email}, ${String(b.nguon ?? '').slice(0, 200) || null}, ${ip})
    ON CONFLICT (sp, email) DO NOTHING`);
  return ve(true);
}
