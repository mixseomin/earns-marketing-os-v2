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
import { textArray } from '@/lib/sql-array';
import { isFinished } from '@/lib/site-status';

// keyPoints = ý chính, hiện NGOÀI phần gập: người review/đọc nắm nội dung mà không phải mở ra đọc hết.
// internal = tài liệu NỘI BỘ (outline, ghi chú) — vẫn xem được nhưng KHÔNG tính vào số từ bản thảo,
// không thì tiến độ tự thổi phồng bằng chính kế hoạch của mình.
export interface ProductChapter { id: number; title: string; order: number; chars: number; content: string; keyPoints: string[]; internal: boolean; }
export interface ProductCard { id: number; title: string; status: string; date: string | null; }
export interface BuildingProduct {
  slug: string;
  projectId: string;       // trang toàn cục lọc theo project đang chọn — sản phẩm của project khác không được lẫn vào
  title: string;
  description: string;
  price: number | null;
  currency: string;
  status: string;          // building | ready | live
  store: string | null;
  liveUrl: string | null;
  chapters: ProductChapter[];
  words: number;           // tổng số từ đã viết — thước tiến độ THẬT của một sản phẩm viết
  /** Bản dựng đọc được (PDF trong vault) — sản phẩm viết thì "xem thử" là thứ đầu tiên người ta cần. */
  build: { url: string; label: string; pages: number; plannedPages: number | null; builtAt: string | null } | null;
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
      SELECT id, kind, title, content, refs, project_id AS "projectId" FROM knowledge_items
      WHERE kind IN ('product', 'product-chapter')
        AND (${projectId ?? null}::text IS NULL OR project_id = ${projectId ?? null})
      ORDER BY (refs->>'order')::int NULLS LAST, id`);
    const items = rows as unknown as Array<{ id: number; kind: string; title: string; content: string; refs: Record<string, unknown>; projectId: string }>;
    const spines = items.filter((r) => r.kind === 'product');
    if (!spines.length) return [];

    const slugs = spines.map((s) => String(s.refs?.slug ?? '')).filter(Boolean);
    // Đọc thẳng `human_tasks`, KHÔNG qua view `backlinks`: view không phơi `prep_payload` (nó chỉ
    // trải vài khoá con ra thành cột), nên lọc theo prep_payload->>'product' ở view sẽ ném
    // "column prep_payload does not exist". Trạng thái/lịch cũng nằm trong prep_payload, lấy theo
    // project_id CỦA CHÍNH CARD nên dùng chung được cho cả trang project lẫn trang toàn cục.
    const taskRows = slugs.length ? await db.execute(sql`
      SELECT id, title, prep_payload->>'product' AS slug,
             coalesce(prep_payload->'site_status'->>project_id, status) AS st,
             prep_payload->'site_scheduled_at'->>project_id AS d
      FROM human_tasks
      WHERE prep_payload->>'product' = ANY(${textArray(slugs)})
      ORDER BY id`) : [];
    const tasks = taskRows as unknown as Array<{ id: number; title: string; slug: string; st: string; d: string | null }>;

    return spines.map((s) => {
      const slug = String(s.refs?.slug ?? '');
      const chapters = items
        .filter((r) => r.kind === 'product-chapter' && r.refs?.slug === slug)
        .map((r) => ({ id: Number(r.id), title: r.title, order: Number(r.refs?.order ?? 0), chars: r.content.length, content: r.content,
          keyPoints: Array.isArray(r.refs?.key_points) ? (r.refs.key_points as unknown[]).map(String) : [],
          internal: r.refs?.internal === true }));
      const cards = tasks.filter((t) => t.slug === slug)
        .map((t) => ({ id: Number(t.id), title: t.title, status: t.st, date: t.d }));
      const done = cards.filter((c) => isFinished(c.status)).length;   // gồm cả 'review' — xong việc, chưa duyệt
      return {
        slug,
        projectId: s.projectId,
        title: s.title,
        description: s.content,
        price: s.refs?.price != null ? Number(s.refs.price) : null,
        currency: String(s.refs?.currency ?? 'USD'),
        status: String(s.refs?.status ?? 'building'),
        store: (s.refs?.store as string) ?? null,
        liveUrl: (s.refs?.liveUrl as string) ?? null,
        chapters,
        // refs.build.mediaId → /api/media/<id>/raw (route stream bytes + content-type thật), không
        // phải đường dẫn file trên máy cá nhân — box không với tới file local, link sẽ chết.
        build: (() => {
          const bd = s.refs?.build as Record<string, unknown> | undefined;
          if (!bd?.mediaId) return null;
          return { url: `/api/media/${Number(bd.mediaId)}/raw`, label: String(bd.label ?? 'Bản dựng'),
            pages: Number(bd.pages ?? 0), plannedPages: bd.plannedPages != null ? Number(bd.plannedPages) : null,
            builtAt: (bd.builtAt as string) ?? null };
        })(),
        words: chapters.reduce((n, c) => n + (c.internal ? 0 : wordCount(c.content)), 0),
        cards,
        done,
        total: cards.length,
        // Card kế = cái chưa xong có ngày sớm nhất. Trả lời thẳng "đang làm đến đâu".
        nextCard: cards.find((c) => c.status !== 'completed' && c.status !== 'verified') ?? null,
      };
    });
  } catch (e) {
    // KHÔNG nuốt im lặng: bản đầu `catch {}` làm câu query sai cột trả về mảng rỗng, và dải sản
    // phẩm chỉ đơn giản KHÔNG hiện — không có gì để lần ra nguyên nhân. Trang vẫn chạy, nhưng lỗi
    // phải để lại dấu trong log.
    console.error('[products-building] không đọc được sản phẩm đang dựng:', (e as Error).message);
    return [];
  }
}
