// Cổng redirect của network: ghi một dòng click rồi đẩy sang link upstream kèm mã click.
//
//   /c/trip-hk?p=thoai&utm_source=google&utm_campaign=hk-aug
//
// Đây là đường duy nhất trong hệ KHÔNG được đăng nhập (người bấm là khách của publisher), và cũng
// là đường duy nhất mà mất dữ liệu là mất vĩnh viễn: đơn về sau 30 ngày mà không có dòng click thì
// không còn cách nào biết nó của ai. Ghi TRƯỚC, redirect SAU.

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { newClickId, upstreamUrl, readUtm } from '@/lib/network/link';

export const dynamic = 'force-dynamic';

interface OfferRow {
  id: number; network: string; upstream_url: string; active: boolean;
  pub_id: number | null; reg_status: string | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = req.nextUrl.searchParams;
  const pub = q.get('p')?.trim() || null;
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB chưa sẵn sàng' }, { status: 503 });

  const rows = await db.execute(sql`
    SELECT o.id, o.network, o.upstream_url, o.active,
           p.id AS pub_id, r.status AS reg_status
    FROM net_offers o
    LEFT JOIN net_publishers p ON p.slug = ${pub} AND p.status = 'active'
    LEFT JOIN net_publisher_offers r ON r.offer_id = o.id AND r.publisher_id = p.id
    WHERE o.slug = ${slug}
    LIMIT 1`);
  const offer = (rows as unknown as OfferRow[])[0];
  if (!offer || !offer.active) return NextResponse.json({ error: 'Chiến dịch không tồn tại hoặc đã dừng' }, { status: 404 });

  // Chưa được duyệt thì KHÔNG đẩy traffic đi. Nếu vẫn đẩy, đơn sẽ về tài khoản upstream của mình
  // mà không ai được trả — tức là mình vừa lấy không công của publisher và không hề biết.
  if (!offer.pub_id || offer.reg_status !== 'approved') {
    return NextResponse.json({ error: 'Publisher chưa được duyệt cho chiến dịch này' }, { status: 403 });
  }

  const clickId = newClickId();
  const target = upstreamUrl(offer.network, offer.upstream_url, clickId);
  // Không dựng được link upstream (network chưa có ô sub-id) = redirect đi cũng mất dấu. Dừng ở
  // đây để lỗi hiện ra lúc cấu hình, thay vì âm thầm mất tiền vài tuần rồi mới phát hiện.
  if (target.error) return NextResponse.json({ error: target.error }, { status: 500 });

  const utm = readUtm(q);
  const ipRaw = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  await db.execute(sql`
    INSERT INTO net_clicks (click_id, offer_id, publisher_id, utm_source, utm_medium, utm_campaign, utm_content, ip, ua, country, referer)
    VALUES (${clickId}, ${offer.id}, ${offer.pub_id},
            ${utm.utm_source ?? null}, ${utm.utm_medium ?? null}, ${utm.utm_campaign ?? null}, ${utm.utm_content ?? null},
            ${ipRaw || null}::inet, ${req.headers.get('user-agent')?.slice(0, 500) ?? null},
            ${req.headers.get('cf-ipcountry') ?? null}, ${req.headers.get('referer')?.slice(0, 500) ?? null})`);

  // 302 chứ không 301: 301 bị trình duyệt cache vĩnh viễn → lần bấm sau đi thẳng upstream, không
  // qua đây, và click đó biến mất khỏi báo cáo. no-store để CDN cũng không giữ hộ.
  return NextResponse.redirect(target.url, {
    status: 302,
    headers: { 'cache-control': 'no-store, no-cache, must-revalidate' },
  });
}
