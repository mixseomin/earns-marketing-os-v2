// POST /api/cron/shop — nhịp SHOP mỗi 10 phút (systemd mos2-shop.timer trên box3): mọi cửa hàng đang bật → kéo đơn đổi từ Woo,
// tự đặt NCC đơn đã trả, theo dõi đơn NCC + vận đơn. ?san_pham=1 kéo cả sản phẩm (timer chạy 1 lần/giờ).
// Auth: header `x-cron-secret` == MOS2_CRON_SECRET.
//   curl -X POST http://127.0.0.1:3821/api/cron/shop -H "x-cron-secret: $SECRET"
import { NextResponse } from 'next/server';
import { dsCuaHang, nhip } from '@/lib/shop/dong-bo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const sanPham = new URL(req.url).searchParams.get('san_pham') === '1';
  const kq = [];
  for (const ch of await dsCuaHang()) kq.push(await nhip(ch, { sanPham }));
  return NextResponse.json({ ok: true, kq });
}
