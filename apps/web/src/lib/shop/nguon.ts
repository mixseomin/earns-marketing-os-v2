// SHOP — hai cửa ra ngoài: WooCommerce REST (mặt tiền, mỗi cửa hàng một bộ khoá) và CJ Dropshipping (nhà cung cấp).
// Khoá nằm ở .env.production trên box3, KHÔNG trong DB: SHOP_<KHOA>_WOO_CK / _WOO_CS / _WEBHOOK, SHOP_CJ_TOKEN.
// Chỉ chạy phía máy chủ.

const env = (k: string) => process.env[k] ?? '';
const tenEnv = (khoa: string, duoi: string) => `SHOP_${khoa.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${duoi}`;

export function biMatWebhook(khoa: string) { return env(tenEnv(khoa, 'WEBHOOK')); }

/* ── WooCommerce ─────────────────────────────────────────────────────────── */
export type WooMeta = { key: string; value: unknown };
export type WooDon = {
  id: number; number: string; status: string; currency: string; total: string; shipping_total: string;
  date_created_gmt: string; date_paid_gmt: string | null; date_modified_gmt: string; payment_method_title: string;
  billing: Record<string, string>; shipping: Record<string, string>;
  line_items: { id: number; name: string; product_id: number; variation_id: number; quantity: number; total: string; sku: string }[];
  refunds: { id: number; total: string; reason: string }[];
  meta_data: WooMeta[];
};
export type WooSp = { id: number; name: string; permalink: string; status: string; type: string; price: string; sku: string; images: { src: string }[]; variations: number[]; meta_data: WooMeta[] };
export type WooBt = { id: number; sku: string; price: string; attributes: { name: string; option: string }[]; meta_data: WooMeta[] };

export const meta = (m: WooMeta[] | undefined, k: string) => {
  const v = m?.find((x) => x.key === k)?.value;
  return v === undefined || v === null || v === '' ? null : String(v);
};

export async function woo<T>(ch: { khoa: string; domain: string }, method: string, path: string, body?: unknown): Promise<T> {
  const ck = env(tenEnv(ch.khoa, 'WOO_CK')), cs = env(tenEnv(ch.khoa, 'WOO_CS'));
  if (!ck || !cs) throw new Error(`thiếu khoá Woo ${tenEnv(ch.khoa, 'WOO_CK')} trong .env.production`);
  const r = await fetch(`https://${ch.domain}/wp-json/wc/v3/${path}`, {
    method, cache: 'no-store',
    headers: { Authorization: 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64'), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Woo ${method} ${path.split('?')[0]} → ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t) as T;
}

/** Kéo hết các trang của một danh sách Woo (100/trang). */
export async function wooHet<T>(ch: { khoa: string; domain: string }, path: string): Promise<T[]> {
  const ra: T[] = [];
  for (let trang = 1; trang < 50; trang++) {
    const d = await woo<T[]>(ch, 'GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${trang}`);
    ra.push(...d);
    if (d.length < 100) break;
  }
  return ra;
}

/* ── CJ Dropshipping ─────────────────────────────────────────────────────── */
const CJ = 'https://developers.cjdropshipping.com/api2.0/v1/';
export type CjKq<T = Record<string, unknown>> = { result: boolean; message?: string; data?: T };

export async function cj<T = Record<string, unknown>>(path: string, body?: unknown): Promise<CjKq<T>> {
  const token = env('SHOP_CJ_TOKEN');
  if (!token) return { result: false, message: 'thiếu SHOP_CJ_TOKEN trong .env.production' };
  try {
    const r = await fetch(CJ + path, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
      headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    return (await r.json()) as CjKq<T>;
  } catch (e) { return { result: false, message: (e as Error).message }; }
}

/** Số ngày giao tối đa từ chuỗi "4-7" / "5-11". */
export const ngayToiDa = (s: unknown) => Math.max(...(String(s ?? '').match(/\d+/g) ?? ['99']).map(Number));

export { LINK_DS_CJ, linkVanDon } from './buoc';
