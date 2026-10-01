// POST /api/checkout/khach {id, khach, dia_chi} — ghi người nhận ngay trước khi xác nhận thanh toán.
import { NextResponse } from 'next/server';
import { ghiKhach, type DiaChiTT, type KhachTT } from '@mos2/shop/thanh-toan';
import { shopHienTai } from '@/lib/shop';

const cat = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

export async function POST(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; khach?: Record<string, unknown>; dia_chi?: Record<string, unknown> };
  if (!b.id || !/^[0-9a-f-]{36}$/.test(b.id)) return NextResponse.json({ loi: 'id' }, { status: 400 });
  const k = b.khach ?? {}, d = b.dia_chi ?? {};
  const khach: KhachTT = { ten: cat(k.ten, 120), email: cat(k.email, 200).toLowerCase(), sdt: cat(k.sdt, 40) };
  const diaChi: DiaChiTT = { ten: cat(d.ten, 120), dong1: cat(d.dong1, 200), dong2: cat(d.dong2, 200), thanh_pho: cat(d.thanh_pho, 100), bang: cat(d.bang, 60),
    zip: cat(d.zip, 20), nuoc: cat(d.nuoc, 2).toUpperCase() || 'US' };
  try { await ghiKhach(s, b.id, khach, diaChi); return NextResponse.json({ ok: true }); }
  catch (e) { console.error('khach', (e as Error).message); return NextResponse.json({ loi: 'khach' }, { status: 400 }); }
}
