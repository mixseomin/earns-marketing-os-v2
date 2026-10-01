// POST /api/checkout {id?, mon:[{b, sl}]} — mở/cập nhật phiên thanh toán + PaymentIntent. Giá tính lại từ sổ.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { moThanhToan } from '@mos2/shop/thanh-toan';
import { shopHienTai } from '@/lib/shop';

export async function POST(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { id?: string | null; mon?: { b: number; sl: number }[] };
  let utm: Record<string, string> = {};
  try { utm = JSON.parse((await cookies()).get('nguon')?.value ?? '{}'); } catch { /* cookie hỏng: đơn không có nguồn */ }
  try {
    const p = await moThanhToan(s, b.id && /^[0-9a-f-]{36}$/.test(b.id) ? b.id : null, (b.mon ?? []).slice(0, 30), utm);
    return NextResponse.json(p);
  } catch (e) {
    console.error('checkout', (e as Error).message);
    return NextResponse.json({ loi: (e as Error).message === 'giỏ trống' ? 'empty' : 'checkout' }, { status: 400 });
  }
}
