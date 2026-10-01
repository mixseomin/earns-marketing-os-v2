// Stripe — gọi REST thẳng (không kéo SDK). Khoá theo cửa hàng ở .env.production: SHOP_<KHOA>_STRIPE_PK / _STRIPE_SK / _STRIPE_WH.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { envShop } from './mat-tien';

export type Pi = { id: string; status: string; amount: number; amount_received: number; currency: string; client_secret: string;
  metadata: Record<string, string>; latest_charge?: string | null; last_payment_error?: { message?: string } | null };

const phang = (o: Record<string, unknown>, tien = ''): [string, string][] =>
  Object.entries(o).flatMap(([k, v]) => {
    const ten = tien ? `${tien}[${k}]` : k;
    if (v === undefined || v === null) return [];
    if (Array.isArray(v)) return v.map((x, i) => [`${ten}[${i}]`, String(x)] as [string, string]);
    if (typeof v === 'object') return phang(v as Record<string, unknown>, ten);
    return [[ten, String(v)] as [string, string]];
  });

export const coStripe = (khoa: string) => !!envShop(khoa, 'STRIPE_SK') && !!envShop(khoa, 'STRIPE_PK');
export const pkStripe = (khoa: string) => envShop(khoa, 'STRIPE_PK');

export async function stripe<T>(khoa: string, method: 'GET' | 'POST', path: string, body?: Record<string, unknown>, khoaLap?: string): Promise<T> {
  const sk = envShop(khoa, 'STRIPE_SK');
  if (!sk) throw new Error(`thiếu khoá Stripe SHOP_${khoa.toUpperCase()}_STRIPE_SK`);
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/x-www-form-urlencoded', ...(khoaLap ? { 'Idempotency-Key': khoaLap } : {}) },
    body: body ? new URLSearchParams(phang(body)).toString() : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const j = (await r.json()) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`Stripe ${path.split('?')[0]} → ${r.status}: ${j.error?.message ?? ''}`);
  return j;
}

/** Xác minh chữ ký webhook (Stripe-Signature: t=…,v1=…) — sai lệch giờ quá 5 phút thì từ chối. */
export function webhookHopLe(body: string, chuKy: string | null, biMat: string, bayGio = Date.now()): boolean {
  if (!chuKy || !biMat) return false;
  const p = Object.fromEntries(chuKy.split(',').map((x) => x.split('=') as [string, string]));
  const ds = chuKy.split(',').filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  const t = Number(p.t);
  if (!t || Math.abs(bayGio / 1000 - t) > 300) return false;
  const can = createHmac('sha256', biMat).update(`${t}.${body}`).digest('hex');
  return ds.some((v) => v.length === can.length && timingSafeEqual(Buffer.from(v), Buffer.from(can)));
}
