import { getDb, platforms } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { canonPlatformKey, platformKeyCandidates } from './habitat-platform-map';
import { slugifyHost } from './host';

// Ext gán platform_key = HOST-SLUG ('govloop.com' → 'govloop-com'). Nếu server ĐÃ có platform CURATED
// cho cùng host (signup_url slugify ra CÙNG slug, key KHÁC) → trả key curated ('govloop') để account
// KHỚP catalog / backlink readiness / login-pill, KHÔNG đẻ platform trùng + account mồ côi.
//
// Thay cho việc thêm PLATFORM_ALIAS tay từng site: reconcile động theo catalog. Đây là chỗ DUY NHẤT
// account create/map/query gọi để chuẩn hoá key → 1 nguồn.
// Fail-safe: db null / lỗi / không match → canonPlatformKey(raw) (alias tĩnh + slug nguyên).
//
// SỬA 2026-08-07 — lỗ hổng subdomain. Bản cũ dừng ngay khi `canon` đã là một key có sẵn, nên
// một khi `ui-awin-com` lọt vào bảng thì nó tự nuôi chính nó: account sau cứ gắn vào key rác
// đó thay vì `awin`. Cùng cơ chế đẻ ra 11 cặp trùng (app-impact-com/impact, buffer-com/buffer,
// make-com/make…), account bị chia đôi giữa hai key. Giờ luôn duyệt LADDER ứng viên
// (nguyên key → bỏ tiền tố subdomain → bỏ TLD) và ưu tiên key CHUẨN NHẤT đang tồn tại, kể cả
// khi nó nằm trong `fallback_keys`. Không bao giờ tự bịa phép gộp: chỉ tái dùng cái đã có,
// nên wordpress.com và wordpress.org vẫn là hai platform riêng.


export async function reconcilePlatformKey(
  db: ReturnType<typeof getDb>,
  raw: string | null | undefined,
): Promise<string> {
  const canon = canonPlatformKey(String(raw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (!canon || !db) return canon;
  try {
    // 1. Ladder ứng viên: cái đứng SAU sạch hơn cái đứng trước (ui-awin-com → awin-com → awin).
    //    Lấy cái sạch nhất mà bảng đã có → account mới về đúng platform chuẩn.
    const cands = platformKeyCandidates(canon);
    if (cands.length) {
      const rows = await db.execute(sql`
        SELECT key FROM platforms
        WHERE key = ANY(${cands}::text[]) OR fallback_keys ?| ${cands}::text[]`);
      const have = new Set((rows as unknown as Array<{ key: string }>).map((r) => r.key));
      // duyệt NGƯỢC: ứng viên cuối là dạng gọn nhất (tên thương hiệu trần)
      for (let i = cands.length - 1; i >= 0; i--) { const c = cands[i]; if (c && have.has(c)) return c; }
      const viaFallback = [...have][0];
      if (viaFallback) return viaFallback;   // khớp qua fallback_keys
    }
    // 2. Chưa có key nào trong ladder → tìm curated có signup_url host slugify == canon.
    const rows = await db.select({ key: platforms.key, signupUrl: platforms.signupUrl }).from(platforms);
    for (const r of rows) {
      if (!r.signupUrl || r.key === canon) continue;
      let host = '';
      try { host = new URL(r.signupUrl).hostname; } catch { continue; }
      if (slugifyHost(host) === canon) return r.key;
    }
  } catch { /* fail-safe → canon */ }
  return canon;
}
