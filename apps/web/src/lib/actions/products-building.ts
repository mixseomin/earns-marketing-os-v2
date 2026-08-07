'use server';

// SẢN PHẨM ĐANG DỰNG — mặt tiền cho hàng CHƯA bán, khác hẳn /products (danh mục hàng ĐÃ bán,
// đo doanh thu). Trước đây một sản phẩm đang làm không có chỗ nào nhìn được: tiến độ nằm rải ở
// vài card trên board, còn bản thảo nằm trong file ở máy cá nhân — box không với tới, nên câu
// "muốn xem quyển sách thì vào đâu" không có câu trả lời.
//
// KHÔNG thêm bảng. Sản phẩm = một hàng `knowledge_items` kind='product' (refs.slug là khoá),
// các chương = kind='product-chapter' cùng slug, tiến độ = các card mang prep_payload.product
// = slug. Ba thứ đã có sẵn chỗ chứa, chỉ thiếu đường nối.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export interface ProductChapter { id: number; title: string; order: number; chars: number; content: string; }
export interface ProductCard { id: number; title: string; status: string; date: string | null; }
export interface BuildingProduct {
  slug: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  status: string;          // building | ready | live
  store: string | null;
  liveUrl: string | null;
  chapters: ProductChapter[];
  words: number;           // tổng số từ đã viết — thước tiến độ THẬT của một sản phẩm viết
  cards: ProductCard[];
  done: number;
  total: number;
  nextCard: ProductCard | null;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** projectId bỏ trống = mọi project (dùng cho bảng /plays toàn cục). */
export async function listBuildingProducts(projectId?: string): Promise<BuildingProduct[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`
      SELECT id, kind, title, content, refs FROM knowledge_items
      WHERE kind IN ('product', 'product-chapter')
        AND (${projectId ?? null}::text IS NULL OR project_id = ${projectId ?? null})
      ORDER BY (refs->>'order')::int NULLS LAST, id`);
    const items = rows as unknown as Array<{ id: number; kind: string; title: string; content: string; refs: Record<string, unknown> }>;
    const spines = items.filter((r) => r.kind === 'product');
    if (!spines.length) return [];

    const slugs = spines.map((s) => String(s.refs?.slug ?? '')).filter(Boolean);
    // Trạng thái/lịch đọc theo project_id CỦA CHÍNH CARD, không theo project đang xem — nhờ vậy
    // dùng chung được cho cả trang project lẫn trang toàn cục, không phải hai đường.
    const taskRows = slugs.length ? await db.execute(sql`
      SELECT id, title, prep_payload->>'product' AS slug,
             coalesce(site_status->>project_id, status) AS st,
             site_scheduled_at->>project_id AS d
      FROM backlinks
      WHERE prep_payload->>'product' = ANY(${slugs}::text[])
      ORDER BY site_scheduled_at->>project_id NULLS LAST, id`) : [];
    const tasks = taskRows as unknown as Array<{ id: number; title: string; slug: string; st: string; d: string | null }>;

    return spines.map((s) => {
      const slug = String(s.refs?.slug ?? '');
      const chapters = items
        .filter((r) => r.kind === 'product-chapter' && r.refs?.slug === slug)
        .map((r) => ({ id: r.id, title: r.title, order: Number(r.refs?.order ?? 0), chars: r.content.length, content: r.content }));
      const cards = tasks.filter((t) => t.slug === slug)
        .map((t) => ({ id: t.id, title: t.title, status: t.st, date: t.d }));
      const done = cards.filter((c) => c.status === 'completed' || c.status === 'verified').length;
      return {
        slug,
        title: s.title,
        description: s.content,
        price: s.refs?.price != null ? Number(s.refs.price) : null,
        currency: String(s.refs?.currency ?? 'USD'),
        status: String(s.refs?.status ?? 'building'),
        store: (s.refs?.store as string) ?? null,
        liveUrl: (s.refs?.liveUrl as string) ?? null,
        chapters,
        words: chapters.reduce((n, c) => n + wordCount(c.content), 0),
        cards,
        done,
        total: cards.length,
        // Card kế = cái chưa xong có ngày sớm nhất. Trả lời thẳng "đang làm đến đâu".
        nextCard: cards.find((c) => c.status !== 'completed' && c.status !== 'verified') ?? null,
      };
    });
  } catch {
    return [];   // thiếu bảng/cột thì trang vẫn chạy, chỉ mất dải sản phẩm
  }
}
