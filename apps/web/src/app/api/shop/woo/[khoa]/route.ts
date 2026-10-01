// POST /api/shop/woo/<khoa> — webhook WooCommerce (order.created / order.updated) của một cửa hàng → ghi đơn vào sổ ngay,
// đơn vừa trả tiền thì đặt NCC luôn (không đợi nhịp 10 phút). Xác thực: X-WC-Webhook-Signature = base64(HMAC-SHA256(thân, bí mật))
// với bí mật SHOP_<KHOA>_WEBHOOK trong .env.production. Lượt "ping" Woo gửi lúc tạo webhook (không chữ ký) trả 200.
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { biMatWebhook, type WooDon } from '@/lib/shop/nguon';
import { cuaHangTheoKhoa, ghiDon, sangNcc } from '@/lib/shop/dong-bo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ khoa: string }> }) {
  const { khoa } = await params;
  const than = await req.text();
  const ky = req.headers.get('x-wc-webhook-signature');
  if (!ky) return NextResponse.json({ ok: true, ping: true });
  const bm = biMatWebhook(khoa);
  const dung = bm ? createHmac('sha256', bm).update(than).digest('base64') : '';
  if (!dung || dung.length !== ky.length || !timingSafeEqual(Buffer.from(dung), Buffer.from(ky)))
    return NextResponse.json({ ok: false, error: 'sai chữ ký' }, { status: 401 });
  const ch = await cuaHangTheoKhoa(khoa);
  if (!ch || ch.trang_thai !== 'bat') return NextResponse.json({ ok: false, error: 'cửa hàng không bật' }, { status: 404 });
  const o = JSON.parse(than) as WooDon;
  if (!o?.id || !Array.isArray(o.line_items)) return NextResponse.json({ ok: true, bo_qua: true });
  const id = await ghiDon(ch, o);
  const ncc = ch.cau_hinh.tu_sang_ncc && o.status === 'processing' ? await sangNcc(ch, id) : null;
  return NextResponse.json({ ok: true, don: id, ncc });
}
