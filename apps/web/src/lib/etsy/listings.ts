// Listing Etsy ĐỌC THẲNG API (Open API v3), như Gumroad — sổ cái tay thì lệch ngay khi đăng listing mới (05/10/2026: 3 listing
// đã public mà cây Tài sản ghi "chưa có listing"). Khoá app (keystring + shared secret) mã hoá ở account_state ref 'etsy-app'
// của tài khoản etsy trong vault; x-api-key PHẢI là "keystring:shared_secret" (chỉ keystring = 403).
// Gọi từ máy chủ MOS2 (box3) — đúng IP đã dùng cho API từ đầu, không phải máy anh đăng nhập Etsy.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { decryptValue } from '@/lib/crypto';

export type EtsyListing = { id: number; title: string; url: string; state: string; /** download | physical | both */ type: string; price: number; currency: string; views: number | null; favorites: number | null };
export type EtsyShop = { accountId: number; handle: string; shopId: number | null; url: string | null; listings: EtsyListing[]; error: string | null };

export async function docEtsy(): Promise<EtsyShop[]> {
  const d = getDb(); if (!d) return [];
  const rows = (await d.execute(sql`SELECT a.id, a.handle, s.data->>'keystring_enc' AS ks, s.data->>'shared_secret_enc' AS ss
    FROM platform_accounts a JOIN account_state s ON s.account_id = a.id AND s.ref = 'etsy-app'
    WHERE a.platform_key = 'etsy' AND a.status NOT IN ('banned', 'blocked', 'closed')`)) as unknown as { id: number; handle: string; ks: string; ss: string }[];
  return Promise.all(rows.map(async (r): Promise<EtsyShop> => {
    const base: EtsyShop = { accountId: r.id, handle: r.handle, shopId: null, url: null, listings: [], error: null };
    try {
      const key = `${await decryptValue(r.ks)}:${await decryptValue(r.ss)}`;
      const get = async (p: string) => {
        const res = await fetch(`https://openapi.etsy.com/v3/application${p}`, { headers: { 'x-api-key': key }, next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
        const j = await res.json() as { error?: string; results?: unknown[] };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        return j;
      };
      const shop = (await get(`/shops?shop_name=${encodeURIComponent(r.handle)}`)).results?.[0] as { shop_id: number; url: string } | undefined;
      if (!shop) return { ...base, error: `Etsy không thấy shop ${r.handle}` };
      // Chỉ listing ĐANG BÁN: /listings/active là endpoint công khai (chỉ cần x-api-key). Nháp / hết hạn nằm ở /shops/{id}/listings?state=…
      // — endpoint đó đòi OAuth (listings_r), bản đầu gọi nó bằng api-key trơn nên trả rỗng mà không lỗi, cây ghi "chưa có listing" (05/10/2026).
      const lists = [await get(`/shops/${shop.shop_id}/listings/active?limit=100`)];
      const listings = lists.flatMap((l) => (l.results ?? []) as { listing_id: number; title: string; url: string; state: string; type?: string; price: { amount: number; divisor: number; currency_code: string }; views?: number; num_favorers?: number }[])
        .map((l) => ({ id: l.listing_id, title: l.title, url: l.url, state: l.state, type: l.type ?? 'download', price: l.price.amount / l.price.divisor, currency: l.price.currency_code,
          views: l.views ?? null, favorites: l.num_favorers ?? null }));
      return { ...base, shopId: shop.shop_id, url: shop.url, listings };
    } catch (e) { return { ...base, error: (e as Error).message }; }
  }));
}
