// Cổng redirect theo TOKEN — link mà publisher thật sự dán ra ngoài.
//
//   /t/<token>?utm_source=google&utm_campaign=hk-aug
//
// Khác `/c/<offer>?p=<pub>` (vẫn giữ, cho link cũ đã phát): ở đây publisher và chiến dịch nằm TRONG
// token, nên không còn tham số nào để sửa sai — không cướp được công của nhau, không xoá nhầm
// thành 403, không gõ nhầm slug thành 404.

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { newClickId, upstreamUrl, readUtm } from '@/lib/network/link';

export const dynamic = 'force-dynamic';

interface Row {
  offer_id: number; network: string; upstream_url: string; active: boolean;
  pub_id: number; pub_status: string; reg_status: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB chưa sẵn sàng' }, { status: 503 });

  const rows = await db.execute(sql`
    SELECT o.id AS offer_id, o.network, o.upstream_url, o.active,
           p.id AS pub_id, p.status AS pub_status, r.status AS reg_status
    FROM net_publisher_offers r
    JOIN net_offers o ON o.id = r.offer_id
    JOIN net_publishers p ON p.id = r.publisher_id
    WHERE r.link_token = ${token}
    LIMIT 1`);
  const row = (rows as unknown as Row[])[0];
  if (!row) return NextResponse.json({ error: 'Link không tồn tại hoặc đã bị thu hồi' }, { status: 404 });
  if (!row.active) return NextResponse.json({ error: 'Chiến dịch đã dừng' }, { status: 404 });
  // Chặn cả ở phía publisher: khoá người thì MỌI link của họ tắt ngay, không phải đi gỡ từng cái.
  if (row.pub_status !== 'active' || row.reg_status !== 'approved') {
    return NextResponse.json({ error: 'Link đã bị tạm dừng' }, { status: 403 });
  }

  const clickId = newClickId();
  const target = upstreamUrl(row.network, row.upstream_url, clickId);
  if (target.error) return NextResponse.json({ error: target.error }, { status: 500 });

  const utm = readUtm(req.nextUrl.searchParams);
  const ipRaw = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  // Ghi TRƯỚC, redirect SAU — mất dòng click là mất vĩnh viễn đường quy công cho đơn về sau.
  await db.execute(sql`
    INSERT INTO net_clicks (click_id, offer_id, publisher_id, utm_source, utm_medium, utm_campaign, utm_content, ip, ua, country, referer)
    VALUES (${clickId}, ${row.offer_id}, ${row.pub_id},
            ${utm.utm_source ?? null}, ${utm.utm_medium ?? null}, ${utm.utm_campaign ?? null}, ${utm.utm_content ?? null},
            ${ipRaw || null}::inet, ${req.headers.get('user-agent')?.slice(0, 500) ?? null},
            ${req.headers.get('cf-ipcountry') ?? null}, ${req.headers.get('referer')?.slice(0, 500) ?? null})`);

  return NextResponse.redirect(target.url, {
    status: 302,
    headers: { 'cache-control': 'no-store, no-cache, must-revalidate' },
  });
}
