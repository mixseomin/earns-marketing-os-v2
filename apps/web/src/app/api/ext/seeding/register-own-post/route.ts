import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

export const dynamic = 'force-dynamic';

// POST /api/ext/seeding/register-own-post
// Đăng ký 1 bài GỐC trên CHÍNH account own → card seeding (self-owned), kế thừa tracking
// views/replies/likes qua pipeline card sẵn có. Card seed vào *own-profile habitat*
// (is_own=true, name='@handle') của account → dashboard hiện dưới 👑 own habitat, scanTrk/
// insights chạy nguyên. KHÔNG migration: dùng lại pattern auto-create habitat/brief/card
// (xem insights-by-thing-id). Idempotent qua card_ref='EXT-<postId>' / post_url.
// Body: { accountId?, handle, platformKey, projectId, postUrl, postId, bodyFinal, contentType? }
interface Body {
  accountId?: number;
  handle?: string;
  platformKey?: string;
  projectId?: string;
  postUrl?: string;
  postId?: string;
  bodyFinal?: string;
  contentType?: string;
}

export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const body = (await req.json()) as Body;

  const handle = String(body.handle ?? '').replace(/^@/, '').trim();
  // Canon platform_key server-side — KHÔNG default 'x'. Ext gửi canonPk()||PLATFORM_KEY||'x'; khi canonPk()
  // rỗng (race load) sẽ ra 'x' → trước đây tạo habitat platform_key='x' LỆCH catalog 'twitter'. Map mirror
  // core/platform.js CANON; rỗng → 400 (ko đoán).
  const rawPk = String(body.platformKey ?? '').trim().toLowerCase();
  const platformKey = ({ x: 'twitter', twitter: 'twitter', bsky: 'bluesky' } as Record<string, string>)[rawPk] || rawPk;
  const projectId = String(body.projectId ?? '').trim();
  const postUrl = String(body.postUrl ?? '').trim();
  const postId = String(body.postId ?? '').trim();
  const bodyFinal = String(body.bodyFinal ?? '').trim();
  const contentType = String(body.contentType ?? 'text').trim() || 'text';
  if (!handle || !platformKey || !projectId || !postUrl || !postId) {
    return NextResponse.json({ ok: false, error: 'handle, platformKey, projectId, postUrl, postId required' }, { status: 400 });
  }

  // 1. Resolve account (id truyền vào, hoặc handle + platform).
  let accountId = body.accountId != null ? Number(body.accountId) : 0;
  if (!accountId) {
    const rows = await db.execute(sql`SELECT id FROM platform_accounts WHERE platform_key = ${platformKey} AND LOWER(handle) = LOWER(${handle}) LIMIT 1`);
    const a = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!a) return NextResponse.json({ ok: false, reason: 'account_not_found', error: `@${handle} chưa map trong MOS2` }, { status: 200 });
    accountId = Number(a.id);
  }

  // 2. Idempotency: card đã tồn tại (card_ref EXT-<postId> hoặc cùng post_url) → trả luôn.
  const exist = await db.execute(sql`SELECT id, brief_id FROM cards WHERE card_ref = ${`EXT-${postId}`} OR post_url = ${postUrl} LIMIT 1`);
  const ex = (exist as unknown as Array<Record<string, unknown>>)[0];
  if (ex) return NextResponse.json({ ok: true, cardId: Number(ex.id), briefId: ex.brief_id != null ? Number(ex.brief_id) : null, existed: true });

  // 3. Resolve/ensure own-profile habitat (is_own=true, name='@handle').
  const habName = '@' + handle;
  let habitatId = 0;
  {
    const rows = await db.execute(sql`SELECT id FROM habitats WHERE project_id = ${projectId} AND platform_key = ${platformKey} AND is_own = true AND LOWER(name) = LOWER(${habName}) LIMIT 1`);
    const h = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (h) habitatId = Number(h.id);
    else {
      const insH = await db.execute(sql`INSERT INTO habitats (tenant_id, project_id, name, platform_key, is_own, language) VALUES ('self', ${projectId}, ${habName}, ${platformKey}, true, 'en') RETURNING id`);
      habitatId = Number((insH as unknown as Array<Record<string, unknown>>)[0]!.id);
    }
  }

  // 4. Resolve/ensure brief (account, own-habitat) trong project THẬT (ko '_orphan').
  let briefId = 0;
  {
    const rows = await db.execute(sql`SELECT id FROM community_briefs WHERE account_id = ${accountId} AND habitat_id = ${habitatId} ORDER BY updated_at DESC LIMIT 1`);
    const b = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (b) briefId = Number(b.id);
    else {
      const insB = await db.execute(sql`
        INSERT INTO community_briefs (tenant_id, project_id, account_id, habitat_id, current_phase, join_status, tone, approach_md, do_md, dont_md)
        VALUES ('self', ${projectId}, ${accountId}, ${habitatId}, 'warm-up', 'joined', '', 'Own-account posts — bài gốc trên profile chính chủ (auto-tracked).', '', '')
        RETURNING id`);
      briefId = Number((insB as unknown as Array<Record<string, unknown>>)[0]!.id);
    }
  }

  // 5. INSERT card — bài GỐC (parent_url NULL); post_url set ngay (đã đăng) → scanTrk bỏ qua
  // mark-posted, chạy thẳng insights.
  const title = (bodyFinal || `Post ${postId}`).replace(/\s+/g, ' ').slice(0, 80);
  const insC = await db.execute(sql`
    INSERT INTO cards (
      tenant_id, project_id, brief_id, card_ref, squad_key,
      title, body_target, content_type, target_lang,
      post_url, posted_at, answer_source,
      col, level, brief_phase, agent_kind,
      post_lifecycle, post_lifecycle_at, post_lifecycle_note
    ) VALUES (
      'self', ${projectId}, ${briefId}, ${`EXT-${postId}`}, 'wf-writer',
      ${title}, ${bodyFinal.slice(0, 4000)}, ${contentType}, 'en',
      ${postUrl}, NOW(), 'external',
      'production', 2, 'warm-up', 'community-seed',
      'live', NOW(), 'auto-registered own-account post'
    ) RETURNING id`);
  const cardId = Number((insC as unknown as Array<Record<string, unknown>>)[0]!.id);

  return NextResponse.json({ ok: true, cardId, briefId, habitatId, existed: false });
}
