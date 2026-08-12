'use server';

// Lượt xem theo ngày của từng sản phẩm — do job trình duyệt local đẩy vào `product_daily`
// (POST /api/ext/product-metrics). Gumroad API v2 KHÔNG có trường lượt xem; nó chỉ tồn tại trong
// giao diện Analytics, nên đây là đường duy nhất đưa con số đó lên bảng.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export interface ProductViews {
  views7d: number;
  views30d: number;
  lastDate: string | null;
}

export interface ViewsPayload {
  /** khoá = `${store}:${productId}` */
  byProduct: Record<string, ProductViews>;
  /** ngày gần nhất có dữ liệu — để nói thẳng "số cũ rồi" thay vì hiện 0 im lặng. */
  lastSync: string | null;
}

const EMPTY: ViewsPayload = { byProduct: {}, lastSync: null };

export async function loadProductViews(): Promise<ViewsPayload> {
  const db = getDb();
  if (!db) return EMPTY;
  try {
    const rows = (await db.execute(sql`
      SELECT store, product_id AS "productId",
             sum(views) FILTER (WHERE date >= to_char(current_date - 7, 'YYYY-MM-DD'))  AS v7,
             sum(views) FILTER (WHERE date >= to_char(current_date - 30, 'YYYY-MM-DD')) AS v30,
             max(date) AS "lastDate"
      FROM product_daily
      WHERE date >= to_char(current_date - 30, 'YYYY-MM-DD')
      GROUP BY store, product_id`)) as unknown as Array<{ store: string; productId: string; v7: string | null; v30: string | null; lastDate: string | null }>;
    const byProduct: Record<string, ProductViews> = {};
    let lastSync: string | null = null;
    for (const r of rows) {
      byProduct[`${r.store}:${r.productId}`] = {
        views7d: Number(r.v7 ?? 0),
        views30d: Number(r.v30 ?? 0),
        lastDate: r.lastDate,
      };
      if (r.lastDate && (!lastSync || r.lastDate > lastSync)) lastSync = r.lastDate;
    }
    return { byProduct, lastSync };
  } catch {
    // Bảng chưa migrate trên môi trường nào đó → panel vẫn phải vẽ được phần API.
    return EMPTY;
  }
}
