// POST /api/track {order, key|email} — bản theo dõi đơn cho khách (@mos2/shop/khach: chặng ngoài nước khách hiện "<Shop> Center").
import { NextResponse } from 'next/server';
import { banKhach } from '@mos2/shop/khach';
import { shopHienTai } from '@/lib/shop';
import { ipCua, quaGioiHan } from '@/lib/chan';

export async function POST(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  if (quaGioiHan(`td:${ipCua(req)}`, 30)) return NextResponse.json({ loi: 'nhieu' }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { order?: string; key?: string; email?: string; xem?: string; shop?: string };
  // XEM TRƯỚC (vận hành): khoá STORE_PREVIEW_KEY trong .env.production → đọc đơn của cửa hàng khác (vd DEMO chưa có tên miền) dưới khung shop này
  const khoa = b.xem && process.env.STORE_PREVIEW_KEY && b.xem === process.env.STORE_PREVIEW_KEY && b.shop ? String(b.shop).slice(0, 40) : s.khoa;
  const ban = await banKhach(khoa, String(b.order ?? '').replace(/^#/, '').trim(), { key: b.key?.trim() || undefined, email: b.email?.trim() || undefined });
  return ban ? NextResponse.json({ ban }) : NextResponse.json({ loi: 'khong_thay' }, { status: 404 });
}
