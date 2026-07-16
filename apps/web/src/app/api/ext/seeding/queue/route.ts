import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/seeding/queue?projectId=&platformKey=&limit=
// Hàng đợi content SẴN ĐĂNG của 1 project cho post composer (#3): card đã duyệt, CHƯA đăng,
// order scheduled_at. "Đã duyệt" = seedGuard: col<>'backlog' OR dispatch_ready (khớp semantics
// hiện có). Join media_assets để trả url ảnh kèm bài. platformKey lọc tuỳ chọn (canon).
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const p = new URL(req.url).searchParams;
  const projectId = p.get('projectId') || null;
  const platformKey = p.get('platformKey') ? canonPlatformKey(p.get('platformKey')!) : null;
  const limit = Math.min(Number(p.get('limit') ?? 60) || 60, 100);
  if (!projectId) return errorResponse('projectId required', 400);
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);
  try {
    const rows = await db.execute(sql`
      SELECT c.id, c.card_ref, c.title, c.content_type, c.target_lang,
        c.body_target, c.body, c.col, c.dispatch_ready, c.scheduled_at,
        c.parent_url, c.brief_id,
        COALESCE(c.account_id, b.account_id)  AS account_id,
        COALESCE(c.habitat_id, b.habitat_id)  AS habitat_id,
        h.name AS habitat_name,
        COALESCE(NULLIF(h.platform_key,''), NULLIF(pa.platform_key,'')) AS platform_key,
        pa.handle AS account_handle,
        m.id AS media_id, m.url AS media_url, m.mime_type AS media_mime, m.kind AS media_kind
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = COALESCE(c.habitat_id, b.habitat_id)
      LEFT JOIN platform_accounts pa ON pa.id = COALESCE(c.account_id, b.account_id)
      LEFT JOIN media_assets m ON m.id = c.media_asset_id
      WHERE c.project_id = ${projectId}
        AND c.archived_at IS NULL
        AND c.post_url IS NULL
        AND c.posted_at IS NULL
        AND (c.col <> 'backlog' OR c.dispatch_ready = true)
        AND (${platformKey}::text IS NULL
             OR COALESCE(NULLIF(h.platform_key,''), NULLIF(pa.platform_key,'')) = ${platformKey})
      ORDER BY (c.scheduled_at IS NULL), c.scheduled_at ASC, c.id DESC
      LIMIT ${limit}`);
    const cards = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      cardRef: r.card_ref ? String(r.card_ref) : '',
      title: r.title ? String(r.title) : '',
      contentType: r.content_type ? String(r.content_type) : 'text',
      targetLang: r.target_lang ? String(r.target_lang) : 'en',
      body: String(r.body_target || r.body || ''),
      col: r.col ? String(r.col) : '',
      dispatchReady: r.dispatch_ready === true,
      scheduledAt: r.scheduled_at ? String(r.scheduled_at) : null,
      parentUrl: r.parent_url ? String(r.parent_url) : null,
      briefId: r.brief_id == null ? null : Number(r.brief_id),
      accountId: r.account_id == null ? null : Number(r.account_id),
      habitatId: r.habitat_id == null ? null : Number(r.habitat_id),
      habitatName: r.habitat_name ? String(r.habitat_name) : '',
      platformKey: r.platform_key ? String(r.platform_key) : '',
      accountHandle: r.account_handle ? String(r.account_handle) : '',
      media: r.media_id
        ? { id: Number(r.media_id), url: String(r.media_url || ''), mime: r.media_mime ? String(r.media_mime) : '', kind: r.media_kind ? String(r.media_kind) : 'image' }
        : null,
    }));
    return NextResponse.json({ ok: true, count: cards.length, cards });
  } catch (e) {
    return errorResponse((e as Error).message, 200);
  }
}
