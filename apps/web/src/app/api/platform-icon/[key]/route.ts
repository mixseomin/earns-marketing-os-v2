// Favicon của platform, phục vụ từ origin CỦA MÌNH.
//
// Vì sao không để UI trỏ thẳng icons.duckduckgo.com: (1) phải ĐOÁN host từ platform_key — map cứng
// cũ chỉ khớp ~12 platform, còn lại hiện glyph dù DB có URL thật; (2) mỗi lần render là một request
// ra ngoài, chậm và lộ referrer; (3) họ đổi endpoint là vỡ toàn hệ.
//
// Ở đây: host lấy từ CHÍNH cột URL của platform → tải một lần → cất vào platforms.icon_data →
// những lần sau trả từ DB, cache 1 năm. Không tải được thì 404 để <SiteFavicon> rơi về glyph.
//
// NEGATIVE-CACHE (2026-08-13): platform không có favicon tải được (305/466) trước đây trả 404 KHÔNG
// cache-control + icon_data vẫn NULL → MỖI render server chạy lại chuỗi 3 fetch (×6s) + browser xin
// lại → nhìn như "không cache". Nay: fail cũng stamp icon_fetched_at → trong MISS_TTL bỏ qua fetch,
// và 404 mang cache-control để browser không hammer.
import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

const YEAR = 'public, max-age=31536000, immutable';
const MISS = 'public, max-age=604800';       // 404 cache 7 ngày → browser không xin lại icon đã biết là thiếu
const MISS_TTL_MS = 7 * 864e5;               // trong 7 ngày, không chạy lại chuỗi fetch cho platform đã thử-hụt

function hostOf(...urls: Array<string | null | undefined>): string | null {
  for (const u of urls) {
    if (!u) continue;
    try { return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); }
    catch { /* bỏ qua URL hỏng, thử cột kế */ }
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9_-]{1,64}$/i.test(key)) return new NextResponse(null, { status: 400 });
  const db = getDb();
  if (!db) return new NextResponse(null, { status: 404 });

  const rows = (await db.execute(sql`
    SELECT icon_data, icon_mime, icon_slug, icon_fetched_at, session_check_url, post_url, signup_url, profile_url_pattern
    FROM platforms WHERE key = ${key} LIMIT 1`)) as unknown as Array<Record<string, string | null>>;
  const p = rows[0];
  if (!p) return new NextResponse(null, { status: 404 });

  if (p.icon_data) {
    return new NextResponse(Buffer.from(p.icon_data, 'base64'), {
      headers: { 'content-type': p.icon_mime || 'image/x-icon', 'cache-control': YEAR },
    });
  }

  // Đã thử-hụt gần đây → đừng chạy lại chuỗi fetch (3×6s) mỗi request; trả 404 cache ngắn.
  if (p.icon_fetched_at && Date.now() - new Date(p.icon_fetched_at).getTime() < MISS_TTL_MS) {
    return new NextResponse(null, { status: 404, headers: { 'cache-control': MISS } });
  }

  // Chưa có → tải một lần. simpleicons cho brand chuẩn, ip3 cho phần còn lại (dựa host THẬT).
  const host = hostOf(p.session_check_url, p.post_url, p.signup_url,
    p.profile_url_pattern ? p.profile_url_pattern.split('{')[0] : null);
  const candidates = [
    p.icon_slug ? `https://cdn.simpleicons.org/${encodeURIComponent(p.icon_slug)}` : null,
    host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : null,
    host ? `https://${host}/favicon.ico` : null,
  ].filter(Boolean) as string[];

  for (const url of candidates) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength < 64) continue;               // ảnh rỗng/placeholder
      const mime = r.headers.get('content-type') || 'image/x-icon';
      await db.execute(sql`UPDATE platforms SET icon_data = ${buf.toString('base64')},
        icon_mime = ${mime}, icon_fetched_at = now() WHERE key = ${key}`);
      return new NextResponse(buf, { headers: { 'content-type': mime, 'cache-control': YEAR } });
    } catch { /* thử nguồn kế */ }
  }
  // Tất cả nguồn hụt → GHI dấu đã-thử (icon_data vẫn NULL) để MISS_TTL_MS tới không retry mỗi render.
  await db.execute(sql`UPDATE platforms SET icon_fetched_at = now() WHERE key = ${key}`);
  return new NextResponse(null, { status: 404, headers: { 'cache-control': MISS } });
}
