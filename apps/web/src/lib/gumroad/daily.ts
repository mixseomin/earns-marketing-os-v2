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
  /** nguồn giới thiệu 7 ngày, đã cộng theo nguồn: {"direct":24,"github.com":3}. Rỗng = chưa có dữ liệu. */
  refs7d: Record<string, number>;
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

    // Nguồn tách riêng một câu: bung jsonb bằng jsonb_each_text rồi cộng theo nguồn. Gộp chung vào
    // câu trên thì mỗi sản phẩm nhân lên theo số nguồn và cột views7d cộng sai.
    const refRows = (await db.execute(sql`
      SELECT store, product_id AS "productId", e.key AS src, sum(e.value::int) AS n
      FROM product_daily, LATERAL jsonb_each_text(refs) AS e(key, value)
      WHERE date >= to_char(current_date - 7, 'YYYY-MM-DD')
      GROUP BY store, product_id, e.key`)) as unknown as Array<{ store: string; productId: string; src: string; n: string | null }>;
    const refsBy: Record<string, Record<string, number>> = {};
    for (const r of refRows) {
      (refsBy[`${r.store}:${r.productId}`] ??= {})[r.src] = Number(r.n ?? 0);
    }

    const byProduct: Record<string, ProductViews> = {};
    let lastSync: string | null = null;
    for (const r of rows) {
      const key = `${r.store}:${r.productId}`;
      byProduct[key] = {
        views7d: Number(r.v7 ?? 0),
        views30d: Number(r.v30 ?? 0),
        lastDate: r.lastDate,
        refs7d: refsBy[key] ?? {},
      };
      if (r.lastDate && (!lastSync || r.lastDate > lastSync)) lastSync = r.lastDate;
    }
    return { byProduct, lastSync };
  } catch {
    // Bảng chưa migrate trên môi trường nào đó → panel vẫn phải vẽ được phần API.
    return EMPTY;
  }
}
