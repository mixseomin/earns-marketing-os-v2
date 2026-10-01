// GET /api/shop/khach/<khoa>?order=<số đơn>&key=<order_key> | &email=<email> — bản theo dõi đơn CHO KHÁCH (lib/shop/khach.ts).
// Chỉ mu-plugin mellowstep-track.php gọi, server-side qua 127.0.0.1:3821 (Cloudflare chặn POST/GET máy chủ vào mos2.on.tc), kèm
// header x-shop-secret = SHOP_<KHOA>_WEBHOOK. Không khớp đơn → 404 (không phân biệt "sai email" với "không có đơn").
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { biMatWebhook } from '@/lib/shop/nguon';
import { banKhach } from '@/lib/shop/khach';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ khoa: string }> }) {
  const { khoa } = await params;
  const bm = biMatWebhook(khoa), ky = req.headers.get('x-shop-secret') ?? '';
  if (!bm || bm.length !== ky.length || !timingSafeEqual(Buffer.from(bm), Buffer.from(ky)))
    return NextResponse.json({ ok: false }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const ban = await banKhach(khoa, (u.get('order') ?? '').replace(/^#/, '').trim(), { key: u.get('key') ?? undefined, email: u.get('email') ?? undefined });
  return ban ? NextResponse.json({ ok: true, ban }) : NextResponse.json({ ok: false }, { status: 404 });
}
