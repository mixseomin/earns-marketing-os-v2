// POST /api/stripe/webhook — Stripe báo payment_intent.succeeded → chốt đơn (một trong ba cửa, xem @mos2/shop/thanh-toan).
// Một tài khoản Stripe có thể nhận sự kiện của cả shop Woo cũ: PaymentIntent không mang metadata.tt của mặt tiền này thì bỏ qua.
import { NextResponse } from 'next/server';
import { chotThanhToan } from '@mos2/shop/thanh-toan';
import { webhookHopLe } from '@mos2/shop/stripe';
import { envShop } from '@mos2/shop/mat-tien';
import { shopHienTai } from '@/lib/shop';

export async function POST(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  const than = await req.text();
  if (!webhookHopLe(than, req.headers.get('stripe-signature'), envShop(s.khoa, 'STRIPE_WH'))) return NextResponse.json({ loi: 'chu ky' }, { status: 400 });
  const ev = JSON.parse(than) as { type: string; data: { object: { metadata?: Record<string, string> } } };
  const tt = ev.data.object.metadata?.tt;
  if (ev.type !== 'payment_intent.succeeded' || !tt || ev.data.object.metadata?.shop !== s.khoa) return NextResponse.json({ bo_qua: true });
  try { const d = await chotThanhToan(s, tt); return NextResponse.json({ ok: true, don: d?.so_don ?? null }); }
  catch (e) { console.error('webhook', (e as Error).message); return NextResponse.json({ loi: 'chot' }, { status: 500 }); }
}
