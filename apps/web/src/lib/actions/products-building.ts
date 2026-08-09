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
// tasks = các card đã viết ra chương này (refs.tasks). Một chương có thể do nhiều card: card đầu
// viết bản đầu, card sau đào sâu. Nhờ nó mà mở drawer một card là đọc được ĐÚNG phần nó làm ra.
export interface ProductChapter { id: number; title: string; order: number; chars: number; content: string; keyPoints: string[]; internal: boolean; tasks: number[]; }
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
  /** List email RIÊNG của sản phẩm (MailWizz). Mỗi sản phẩm một list thì mới đo được cái nào sống. */
  list: { provider: string; uid: string } | null;
  /** Bìa bán hàng (vault media). Sản phẩm sắp lên store mà drawer không có bìa thì không duyệt được. */
  cover: string | null;
  /**
   * TẤT CẢ khổ bìa đã dựng, đọc thẳng từ vault. Bộ bìa nằm ở thư mục trên máy cá nhân thì chỉ người
   * dựng nó xem được — mà duyệt bìa là việc phải làm trên bảng, ở đâu cũng mở được.
   */
  covers: Array<{ key: string; label: string; url: string; w: number | null; h: number | null }>;
  /**
   * Card tạo ra TRANG chứ không tạo ra chương (bản quyền, trang cuối, hình) — không có chương để
   * đọc, nhưng vẫn phải xem được kết quả. Khoá = id card, giá trị = các trang trong bản dựng.
   * Thiếu đường này thì mở card 409 ra trắng trơn, người duyệt không có gì để duyệt.
   */
  artifacts: Record<string, Array<{ label: string; page: number }>>;
  cards: ProductCard[];
  done: number;       // đã làm xong — gồm cả đang chờ duyệt
  approved: number;   // đã có người duyệt (completed/verified). done - approved = số card nằm ở Review.
  total: number;
  nextCard: ProductCard | null;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

// refs.cover.<key> → nhãn hiển thị. Thứ tự ở đây LÀ thứ tự hiện trên drawer: bìa chính trước,
// mạng xã hội sau. Thêm khổ mới = thêm một dòng.
const COVER_KINDS: Array<{ key: string; label: string }> = [
  { key: 'bookId', label: 'Bìa sách · ảnh sản phẩm' },
  { key: 'heroId', label: 'Hero trang bán' },
  { key: 'thumbId', label: 'Thumbnail danh sách' },
  { key: 'ogId', label: 'Thẻ chia sẻ (OG)' },
  { key: 'xId', label: 'X / Twitter' },
  { key: 'pinterestId', label: 'Pinterest' },
  { key: 'instagramId', label: 'Instagram' },
  { key: 'mediaId', label: 'Bìa' },
];

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

    // Kích thước lấy từ vault chứ không ghi cứng trong code: dựng lại bìa ở khổ khác thì con số
    // trên drawer tự đúng theo.
    const coverIds = [...new Set(spines.flatMap((s2) =>
      Object.values((s2.refs?.cover as Record<string, unknown>) ?? {}).map(Number).filter((n) => Number.isFinite(n))))];
    const dimRows = coverIds.length ? await db.execute(sql`
      SELECT id, width, height FROM media_assets
      WHERE id IN (${sql.join(coverIds.map((i) => sql`${i}`), sql`, `)})`) : [];
    const dims = new Map((dimRows as unknown as Array<{ id: number; width: number | null; height: number | null }>)
      .map((r) => [Number(r.id), { w: r.width, h: r.height }]));

    return spines.map((s) => {
      const slug = String(s.refs?.slug ?? '');
      const chapters = items
        .filter((r) => r.kind === 'product-chapter' && r.refs?.slug === slug)
        .map((r) => ({ id: Number(r.id), title: r.title, order: Number(r.refs?.order ?? 0), chars: r.content.length, content: r.content,
          keyPoints: Array.isArray(r.refs?.key_points) ? (r.refs.key_points as unknown[]).map(String) : [],
          internal: r.refs?.internal === true,
          tasks: Array.isArray(r.refs?.tasks) ? (r.refs.tasks as unknown[]).map(Number) : [] }));
      const cards = tasks.filter((t) => t.slug === slug)
        .map((t) => ({ id: Number(t.id), title: t.title, status: t.st, date: t.d }));
      const done = cards.filter((c) => isFinished(c.status)).length;   // gồm cả 'review' — xong việc, chưa duyệt
      const approved = cards.filter((c) => c.status === 'completed' || c.status === 'verified').length;
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
        artifacts: (s.refs?.artifacts as BuildingProduct['artifacts']) ?? {},
        list: (() => {
          const l = s.refs?.list as { provider?: string; uid?: string } | undefined;
          return l?.uid ? { provider: String(l.provider ?? 'mailwizz'), uid: String(l.uid) } : null;
        })(),
        covers: (() => {
          const c = (s.refs?.cover as Record<string, unknown>) ?? {};
          return COVER_KINDS.filter((k) => c[k.key] != null).map((k) => {
            const id = Number(c[k.key]);
            return { key: k.key, label: k.label, url: `/api/media/${id}/raw`, w: dims.get(id)?.w ?? null, h: dims.get(id)?.h ?? null };
          });
        })(),
        // Ưu tiên bản NGANG cho drawer (bìa dọc 1:1.6 nhét vào drawer là một cột ảnh cao lêu nghêu);
        // bookId = ảnh sản phẩm gốc, dùng khi chưa có bản ngang.
        cover: (() => {
          const c = s.refs?.cover as { heroId?: number; bookId?: number; mediaId?: number } | undefined;
          const id = c?.heroId ?? c?.bookId ?? c?.mediaId;
          return id ? `/api/media/${Number(id)}/raw` : null;
        })(),
        words: chapters.reduce((n, c) => n + (c.internal ? 0 : wordCount(c.content)), 0),
        cards,
        done,
        approved,
        total: cards.length,
        // Card kế = cái CHƯA làm xong đầu tiên. Dùng isFinished (không tự viết lại danh sách trạng
        // thái): bản cũ so tay 'completed'/'verified' nên một card đã xong đang nằm ở Review vẫn bị
        // gọi là "việc kế" — tiến độ đếm nó là xong mà dòng ngay dưới lại bảo phải làm. 'dropped'
        // là bỏ khỏi kế hoạch, cũng không phải việc kế.
        nextCard: cards.find((c) => !isFinished(c.status) && c.status !== 'dropped') ?? null,
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
