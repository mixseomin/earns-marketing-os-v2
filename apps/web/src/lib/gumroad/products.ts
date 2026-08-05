// Gumroad = doanh thu SẢN PHẨM MÌNH BÁN (CodeCrate), khác hẳn /offers (affiliate của
// network khác) và khác AdSense (quảng cáo). Đọc thẳng API v2 mỗi 5 phút — KHÔNG bảng,
// KHÔNG cron: API đã trả trạng thái hiện tại đầy đủ (sales_count + sales_usd_cents cộng
// dồn trọn đời), nên snapshot vào DB chỉ là bản sao chậm hơn. Cần chuỗi theo NGÀY thì
// lúc đó mới thêm bảng, không phải bây giờ.
// Token: GUMROAD_TOKEN trong .env.production (app "As.on.tc", authorize 2026-04-06).

const API = 'https://api.gumroad.com/v2';

export interface GumroadProduct {
  id: string;
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

export interface GumroadSummary {
  ok: boolean;
  error?: string;
  products: GumroadProduct[];
  totalSales: number;
  totalUsd: number;          // đơn vị USD, không phải cents
  livePaid: number;
  liveFree: number;
  missingDiscover: number;   // chưa có category/tags → không lên Gumroad Discover
}

const EMPTY: GumroadSummary = { ok: false, products: [], totalSales: 0, totalUsd: 0, livePaid: 0, liveFree: 0, missingDiscover: 0 };

export async function getGumroadSummary(): Promise<GumroadSummary> {
  const token = process.env.GUMROAD_TOKEN;
  if (!token) return { ...EMPTY, error: 'GUMROAD_TOKEN chưa đặt trong .env.production' };
  try {
    const r = await fetch(`${API}/products?access_token=${encodeURIComponent(token)}`, {
      next: { revalidate: 300 },
    });
    if (!r.ok) return { ...EMPTY, error: `Gumroad API ${r.status}` };
    const j = (await r.json()) as { success?: boolean; products?: RawProduct[] };
    if (!j.success) return { ...EMPTY, error: 'Gumroad API trả success=false (token hỏng?)' };

    const products = (j.products ?? [])
      .filter((p) => !p.deleted)
      .map(toProduct)
      .sort((a, b) => b.salesUsdCents - a.salesUsdCents || b.priceCents - a.priceCents);

    return {
      ok: true,
      products,
      totalSales: products.reduce((s, p) => s + p.salesCount, 0),
      totalUsd: products.reduce((s, p) => s + p.salesUsdCents, 0) / 100,
      livePaid: products.filter((p) => p.published && p.priceCents > 0).length,
      liveFree: products.filter((p) => p.published && p.priceCents === 0).length,
      // Bỏ trống category/tags = tự cắt kênh Gumroad Discover (traffic free). Đếm ra để nhắc.
      missingDiscover: products.filter((p) => p.published && (!p.tags.length || !p.category || p.category === 'other')).length,
    };
  } catch (e) {
    return { ...EMPTY, error: e instanceof Error ? e.message : 'fetch lỗi' };
  }
}

interface RawProduct {
  id: string; name: string; price: number; currency: string; published: boolean; deleted?: boolean;
  sales_count?: number; sales_usd_cents?: number; short_url?: string; landing_url?: string;
  category?: string | null; tags?: string[] | string; thumbnail_url?: string | null;
}

function toProduct(p: RawProduct): GumroadProduct {
  // `tags` về khi thì mảng, khi thì chuỗi JSON kiểu Python ("[]" / "['a', 'b']") — chuẩn hoá về mảng.
  let tags: string[] = [];
  if (Array.isArray(p.tags)) tags = p.tags;
  else if (typeof p.tags === 'string') {
    try { tags = JSON.parse(p.tags.replace(/'/g, '"')) as string[]; } catch { tags = []; }
  }
  return {
    id: p.id,
    name: p.name,
    priceCents: p.price ?? 0,
    currency: (p.currency || 'usd').toUpperCase(),
    published: !!p.published,
    salesCount: Number(p.sales_count) || 0,
    salesUsdCents: Number(p.sales_usd_cents) || 0,
    url: p.short_url || p.landing_url || '',
    category: p.category ?? null,
    tags: Array.isArray(tags) ? tags : [],
    thumbnailUrl: p.thumbnail_url ?? null,
  };
}
