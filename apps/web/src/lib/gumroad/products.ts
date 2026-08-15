// Gumroad = doanh thu SẢN PHẨM MÌNH BÁN, khác hẳn /offers (affiliate của network khác) và khác
// AdSense (quảng cáo). Đọc thẳng API v2 mỗi 5 phút — KHÔNG bảng, KHÔNG cron: API đã trả trạng thái
// hiện tại đầy đủ (sales_count + sales_usd_cents cộng dồn trọn đời), nên snapshot vào DB chỉ là bản
// sao chậm hơn. Cần chuỗi theo NGÀY thì lúc đó mới thêm bảng, không phải bây giờ.
//
// NHIỀU STORE (sửa 2026-08-07). Trước đây đọc đúng MỘT token từ env nên trang doanh thu chỉ thấy
// được một store — token đó là store CŨ (oldcc7391, tên hiển thị "CodeCrate"); store militarycalc và
// store codecrate mới là tài khoản Gumroad RIÊNG (email riêng) nên không bao giờ hiện, và trông
// như "mất". Token giờ lấy từ vault: mọi account platform_key='gumroad' có api_token_enc, cộng
// GUMROAD_TOKEN của env như một entry nữa (khử trùng theo token). Thêm store = thêm token vào
// vault, KHÔNG sửa code. Nhãn store lấy từ chính API (`/user`), không hardcode.

import { and, eq, isNotNull } from 'drizzle-orm';
import { getDb, platformAccounts } from '@mos2/db';
import { REVENUE_TAG } from '@/lib/revenue/networks';
import { decryptValue, cryptoEnabled } from '../crypto';

const API = 'https://api.gumroad.com/v2';
const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export interface GumroadProduct {
  id: string;
  /**
   * Permalink (efvcp, qpzez…) — KHÁC `id`, vốn là chuỗi base64 dài của API v2. Mọi nơi khác trong
   * hệ (URL sản phẩm, cấu hình <slug>.json, bảng product_daily do job trình duyệt đẩy về) đều dùng
   * permalink làm khoá. Thiếu trường này thì bảng views không nối được với sản phẩm nào — nhìn ra
   * đúng như "chưa có dữ liệu", trong khi dữ liệu vẫn nằm đó.
   */
  permalink: string;
  /** Store bán món này (nhãn lấy từ Gumroad /user) — nhiều store thì phải phân biệt được. */
  store: string;
  name: string;
  priceCents: number;
  currency: string;
  published: boolean;
  salesCount: number;
  salesUsdCents: number;
  url: string;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
}

/** Một store Gumroad đã đọc được (hoặc đọc hỏng — giữ lỗi riêng để một store chết không giấu mất store kia). */
export interface GumroadStore {
  handle: string;            // nhãn hiển thị, lấy từ /user
  url: string;               // https://<handle>.gumroad.com
  source: 'vault' | 'env';   // token đến từ đâu — để biết chỗ sửa khi hỏng
  products: number;
  sales: number;
  usd: number;
  error?: string;
}

export interface GumroadSummary {
  ok: boolean;
  error?: string;
  products: GumroadProduct[];
  stores: GumroadStore[];
  totalSales: number;
  totalUsd: number;          // đơn vị USD, không phải cents
  livePaid: number;
  liveFree: number;
  missingDiscover: number;   // chưa có category/tags → không lên Gumroad Discover
}

const EMPTY: GumroadSummary = { ok: false, products: [], stores: [], totalSales: 0, totalUsd: 0, livePaid: 0, liveFree: 0, missingDiscover: 0 };

/** Mọi token Gumroad đang có: vault trước (nguồn chuẩn), env sau (store cũ, chưa chuyển vào vault). */
export async function gumroadTokens(): Promise<{ token: string; source: 'vault' | 'env' }[]> {
  const out: { token: string; source: 'vault' | 'env' }[] = [];
  const db = getDb();
  if (db && cryptoEnabled()) {
    try {
      const rows = await db.select({ enc: platformAccounts.apiTokenEnc })
        .from(platformAccounts)
        .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.platformKey, 'gumroad'), isNotNull(platformAccounts.apiTokenEnc)));
      for (const r of rows) {
        try { const t = await decryptValue(r.enc); if (t) out.push({ token: t, source: 'vault' }); } catch { /* token hỏng → bỏ store đó, đừng chết cả trang */ }
      }
    } catch { /* DB hỏng → vẫn còn env */ }
  }
  const envTok = process.env.GUMROAD_TOKEN;
  if (envTok) out.push({ token: envTok, source: 'env' });
  // Cùng một token khai hai chỗ thì đọc một lần, không nhân đôi doanh thu.
  return out.filter((t, i) => out.findIndex((o) => o.token === t.token) === i);
}

// Đọc có cache 5 phút, NHƯNG lỗi thì không cache. Next cache theo (url, options) nên một lần
// gọi hỏng — token vừa đổi, tài khoản vừa xoá, API chớp lỗi — sẽ bị giữ nguyên 5 phút: trang
// doanh thu tiếp tục báo "không đọc được Gumroad" trong khi token đã đúng từ lâu, và không có
// cách nào ép nó đọc lại. Hỏng thì thử lại ngay với no-store để trạng thái sai không sống dai.
async function fetchLive(url: string): Promise<Response> {
  const r = await fetch(url, { next: { revalidate: 300, tags: [REVENUE_TAG] } });
  return r.ok ? r : fetch(url, { cache: 'no-store' });
}

async function readStore(token: string, source: 'vault' | 'env'): Promise<{ store: GumroadStore; products: GumroadProduct[] }> {
  const blank = (handle: string, error?: string): GumroadStore => ({ handle, url: '', source, products: 0, sales: 0, usd: 0, error });
  try {
    const q = encodeURIComponent(token);
    const [ru, rp] = await Promise.all([fetchLive(`${API}/user?access_token=${q}`), fetchLive(`${API}/products?access_token=${q}`)]);
    const ju = ru.ok ? (await ru.json()) as { user?: { name?: string; url?: string } } : undefined;
    const url = ju?.user?.url ?? '';
    // Nhãn = subdomain store (định danh thật, duy nhất). Tên hiển thị trùng nhau được — "CodeCrate"
    // là tên của CẢ store cũ oldcc7391 lẫn store mới, nên lấy tên là nhập nhèm.
    const handle = (() => { try { return new URL(url).hostname.split('.')[0] || ''; } catch { return ''; } })()
      || ju?.user?.name || 'store';
    if (!rp.ok) return { store: blank(handle, `Gumroad API ${rp.status}`), products: [] };
    const j = (await rp.json()) as { success?: boolean; products?: RawProduct[] };
    if (!j.success) return { store: blank(handle, 'API trả success=false (token hỏng?)'), products: [] };
    const products = (j.products ?? []).filter((p) => !p.deleted).map((p) => toProduct(p, handle));
    return {
      store: { handle, url, source, products: products.length,
        sales: products.reduce((s, p) => s + p.salesCount, 0),
        usd: products.reduce((s, p) => s + p.salesUsdCents, 0) / 100 },
      products,
    };
  } catch (e) {
    return { store: blank('store', e instanceof Error ? e.message : 'fetch lỗi'), products: [] };
  }
}

export async function getGumroadSummary(): Promise<GumroadSummary> {
  const toks = await gumroadTokens();
  if (!toks.length) return { ...EMPTY, error: 'Chưa có token Gumroad nào — thêm API token vào vault cho account gumroad, hoặc đặt GUMROAD_TOKEN' };
  const read = await Promise.all(toks.map((t) => readStore(t.token, t.source)));
  const stores = read.map((r) => r.store);
  const products = read.flatMap((r) => r.products)
    .sort((a, b) => b.salesUsdCents - a.salesUsdCents || b.priceCents - a.priceCents);
  const dead = stores.filter((s) => s.error);
  return {
    // ok = còn đọc được ít nhất một store; store nào hỏng thì báo riêng ở `stores`.
    ok: dead.length < stores.length,
    error: dead.length === stores.length ? (dead[0]?.error ?? 'không đọc được store nào') : undefined,
    products,
    stores,
    totalSales: products.reduce((s, p) => s + p.salesCount, 0),
    totalUsd: products.reduce((s, p) => s + p.salesUsdCents, 0) / 100,
    livePaid: products.filter((p) => p.published && p.priceCents > 0).length,
    liveFree: products.filter((p) => p.published && p.priceCents === 0).length,
    // Bỏ trống category/tags = tự cắt kênh Gumroad Discover (traffic free). Đếm ra để nhắc.
    missingDiscover: products.filter((p) => p.published && lacksDiscover(p)).length,
  };
}

/**
 * Chưa đủ điều kiện lên Discover: thiếu tag, hoặc còn nằm ở danh mục "Other".
 *
 * `=== 'other'` (phân biệt hoa thường) là SAI: Gumroad trả đúng chữ "Other", nên sản phẩm nằm y
 * nguyên trong Other vẫn được chấm là ổn — đó là lý do Write Like a Person không hiện cảnh báo
 * suốt thời gian nó ở Other. So sau khi hạ chữ thường.
 */
export function lacksDiscover(p: { tags: string[]; category: string | null }): boolean {
  return !p.tags.length || !p.category || p.category.trim().toLowerCase() === 'other';
}

interface RawProduct {
  id: string; name: string; price: number; currency: string; published: boolean; deleted?: boolean;
  sales_count?: number; sales_usd_cents?: number; short_url?: string; landing_url?: string;
  category?: string | null; tags?: string[] | string; thumbnail_url?: string | null;
}

function toProduct(p: RawProduct, store: string): GumroadProduct {
  // `tags` về khi thì mảng, khi thì chuỗi JSON kiểu Python ("[]" / "['a', 'b']") — chuẩn hoá về mảng.
  let tags: string[] = [];
  if (Array.isArray(p.tags)) tags = p.tags;
  else if (typeof p.tags === 'string') {
    try { tags = JSON.parse(p.tags.replace(/'/g, '"')) as string[]; } catch { tags = []; }
  }
  const url = p.short_url || p.landing_url || '';
  return {
    id: p.id,
    permalink: (url.match(/\/l\/([A-Za-z0-9_-]+)/) || [])[1] || '',
    store,
    name: p.name,
    priceCents: p.price ?? 0,
    currency: (p.currency || 'usd').toUpperCase(),
    published: !!p.published,
    salesCount: Number(p.sales_count) || 0,
    salesUsdCents: Number(p.sales_usd_cents) || 0,
    url,
    category: p.category ?? null,
    tags: Array.isArray(tags) ? tags : [],
    thumbnailUrl: p.thumbnail_url ?? null,
  };
}
