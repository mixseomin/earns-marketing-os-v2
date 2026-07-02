import { getDb, platforms } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { canonPlatformKey } from './habitat-platform-map';

// Ext gán platform_key = HOST-SLUG ('govloop.com' → 'govloop-com'). Nếu server ĐÃ có platform CURATED
// cho cùng host (signup_url slugify ra CÙNG slug, key KHÁC) → trả key curated ('govloop') để account
// KHỚP catalog / backlink readiness / login-pill, KHÔNG đẻ platform trùng + account mồ côi.
//
// Thay cho việc thêm PLATFORM_ALIAS tay từng site: reconcile động theo catalog. Đây là chỗ DUY NHẤT
// account create/map/query gọi để chuẩn hoá key → 1 nguồn.
// Fail-safe: db null / lỗi / không match → canonPlatformKey(raw) (alias tĩnh + slug nguyên).
const slugifyHost = (h: string) =>
  h.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function reconcilePlatformKey(
  db: ReturnType<typeof getDb>,
  raw: string | null | undefined,
): Promise<string> {
  const canon = canonPlatformKey(String(raw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (!canon || !db) return canon;
  try {
    // Slug đã là 1 platform key sẵn có (curated HOẶC host-slug đã tạo trước) → giữ nguyên, đừng đổi.
    const [exact] = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, canon)).limit(1);
    if (exact) return canon;
    // Chưa có key này → tìm curated có signup_url host slugify == canon → dùng key curated.
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
