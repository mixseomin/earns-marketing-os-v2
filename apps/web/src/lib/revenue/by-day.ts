// Doanh thu THEO NGÀY, gộp mọi nguồn về một trục thời gian để /revenue vẽ được lịch.
//
// Ba nguồn, ba cơ chế khác nhau — trước đây mỗi cái nằm một chỗ (hoặc không nằm đâu cả):
//   • adsense  — bảng `adsense_daily` trong MOS2 (cron pull 09:00 UTC)
//   • product  — Directus `product_stats` (doanh thu/ngày theo product: chaturbate, mql5,
//                udemy, stripe…). Đây là nguồn LỚN NHẤT mà /revenue trước giờ bỏ sót.
//   • gumroad  — API v2 `/sales`, quy về ngày mua (hàng CodeCrate mình bán)
//
// Trả về dạng phẳng {date, source, amount} để UI tự gộp/lọc, không ép sẵn cấu trúc.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { gumroadTokens } from '@/lib/gumroad/products';

export type RevenueSource = 'adsense' | 'product' | 'gumroad';

export interface RevenueDayRow {
  date: string;            // YYYY-MM-DD
  source: RevenueSource;
  channel: string;         // adsense: domain · product: platform · gumroad: tên sản phẩm
  amount: number;          // USD THỰC NHẬN (hoa hồng/net) — đây mới là tiền vào túi
  /** Doanh số gốc: khách tiêu / giá bán trước khi chia. Affiliate 20% thì gross = 5× amount. */
  gross?: number;
}

export interface RevenueByDay {
  rows: RevenueDayRow[];
  errors: string[];        // nguồn nào lỗi thì nói ra, KHÔNG im lặng trả 0
}

/** "Toàn bộ" = 10 năm; đủ xa để không cắt mất dữ liệu nào mà vẫn là một con số. */
export const ALL_DAYS = 3650;

/** ?days= → khung thời gian hợp lệ. 0 = toàn bộ. Chỉ nhận đúng bộ chip của RevenueRange. */
export function parseRange(raw?: string): number {
  const n = parseInt(raw ?? '', 10);
  return [7, 30, 90, 365, 0].includes(n) ? n : 30;
}

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

export async function getRevenueByDay(sinceDays = 120): Promise<RevenueByDay> {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10);
  const [adsense, product, gumroad] = await Promise.all([
    adsenseRows(since).catch((e: Error) => ({ rows: [], error: `adsense: ${e.message}` })),
    productRows(since).catch((e: Error) => ({ rows: [], error: `product_stats: ${e.message}` })),
    gumroadRows(since).catch((e: Error) => ({ rows: [], error: `gumroad: ${e.message}` })),
  ]);
  const parts = [adsense, product, gumroad];
  return {
    rows: parts.flatMap((p) => p.rows),
    errors: parts.map((p) => ('error' in p ? p.error : undefined)).filter((x): x is string => !!x),
  };
}

type Part = { rows: RevenueDayRow[]; error?: string };

async function adsenseRows(since: string): Promise<Part> {
  const db = getDb();
  if (!db) return { rows: [], error: 'adsense: DATABASE_URL chưa cấu hình' };
  const r = await db.execute(sql`
    -- site_domain là NOT NULL DEFAULT '' → dòng tổng-account là chuỗi RỖNG, không phải NULL.
    SELECT date::text AS date, COALESCE(NULLIF(site_domain, ''), 'account total') AS channel,
           SUM(earnings_usd)::float8 AS amount
    FROM adsense_daily
    WHERE date >= ${since}::date
    GROUP BY 1, 2
    HAVING SUM(earnings_usd) > 0
    ORDER BY 1`);
  return {
    rows: (r as unknown as Array<Record<string, unknown>>).map((x) => ({
      date: String(x.date), source: 'adsense' as const,
      channel: String(x.channel), amount: Number(x.amount) || 0,
    })),
  };
}

async function productRows(since: string): Promise<Part> {
  if (!DIRECTUS_TOKEN) return { rows: [], error: 'product_stats: DIRECTUS_TOKEN chưa cấu hình' };
  const qs = new URLSearchParams({
    limit: '-1',
    // revenue = thực nhận · gross_revenue = doanh số gốc. Hai con số này KHÁC NHAU
    // (affiliate chaturbate ăn 20%) — trộn chúng làm một là cách báo lố 5 lần.
    fields: 'date,platform,revenue,gross_revenue',
    'filter[date][_gte]': since,
    'filter[revenue][_gt]': '0',
  });
  const res = await fetch(`${DIRECTUS_URL}/items/product_stats?${qs}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    next: { revalidate: 600 },
  });
  if (!res.ok) return { rows: [], error: `product_stats: Directus ${res.status}` };
  const j = (await res.json()) as { data?: Array<{ date: string; platform: string | null; revenue: string | number | null; gross_revenue: string | number | null }> };
  return {
    rows: (j.data ?? []).map((x) => ({
      date: String(x.date).slice(0, 10), source: 'product' as const,
      channel: x.platform || 'unknown', amount: Number(x.revenue) || 0,
      gross: Number(x.gross_revenue) || 0,
    })).filter((x) => x.amount > 0),
  };
}

async function gumroadRows(since: string): Promise<Part> {
  // Read tokens from the SAME source as the Gumroad products block (vault accounts + env), not env
  // alone — the 2 real stores (militarycalc + codecrate) live in the vault, so env-only reported
  // "GUMROAD_TOKEN chưa cấu hình" and dropped all Gumroad revenue from the calendar. One fetch per
  // store, merged; a single store failing doesn't sink the rest.
  const toks = await gumroadTokens();
  if (!toks.length) return { rows: [], error: 'gumroad: chưa có token (thêm API token vào vault account platform_key=gumroad, hoặc đặt env GUMROAD_TOKEN)' };
  const rows: RevenueDayRow[] = [];
  const errs: string[] = [];
  for (const { token } of toks) {
    try {
      const url = `https://api.gumroad.com/v2/sales?access_token=${encodeURIComponent(token)}&after=${since}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) { errs.push(`API ${res.status}`); continue; }
      const j = (await res.json()) as {
        success?: boolean;
        sales?: Array<{ created_at?: string; product_name?: string; price?: number }>;
      };
      if (!j.success) { errs.push('API success=false'); continue; }
      for (const s of j.sales ?? []) {
        const date = String(s.created_at ?? '').slice(0, 10);
        const amount = (Number(s.price) || 0) / 100;   // price = cents
        if (date && amount > 0) rows.push({ date, source: 'gumroad', channel: s.product_name || 'Gumroad', amount });
      }
    } catch (e) {
      errs.push((e as Error).message);
    }
  }
  return { rows, error: errs.length ? `gumroad: ${errs.join('; ')}` : undefined };
}
