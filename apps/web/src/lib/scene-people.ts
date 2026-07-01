import { sql } from 'drizzle-orm';
import { getSceneEvents, familiarityScoreCase } from './scene-events';

// WHO-THEM forward-fill (migration 0099). From a card's topReplies (author
// handles already captured by the ext's syncForumReplies) → upsert `people` +
// `interactions`, recompute familiarity. Idempotent per (people,card,dir,kind).
// Non-fatal: a failure here must NEVER break the insights write (mirror of
// appendInsightsSnapshot). Spec: earns-strategy wiki/mos/crew-scene-layer.md.
type Executor = { execute: (q: ReturnType<typeof sql>) => Promise<unknown> };
type Reply = { author?: string; body?: string; permalink?: string; repliedToYou?: boolean };

// ── SCENE 2-tier (identity global + relationship per project/account) ─────────
// scene_identities = 1 row/(platform,handle) GLOBAL. people = relationship (familiarity
// per project + account). Canonical platform x→twitter (đồng nhất identity, khỏi tách đôi).
const firstId = (res: unknown): number | null => Number((res as Array<Record<string, unknown>>)[0]?.id) || null;
export function canonScenePlatform(pk: string): string {
  const k = (pk || '').trim().toLowerCase();
  return k === 'x' ? 'twitter' : k;
}
/** Resolve/create identity GLOBAL theo (platform canonical, handle). Trả identity_id. */
export async function ensureIdentity(db: Executor, platformKey: string, handle: string, displayName?: string | null): Promise<number | null> {
  const pk = canonScenePlatform(platformKey);
  const h = String(handle || '').replace(/^@/, '').trim().toLowerCase();
  if (!pk || !h) return null;
  return firstId(await db.execute(sql`
    INSERT INTO scene_identities (tenant_id, platform_key, handle, display_name)
    VALUES ('self', ${pk}, ${h}, ${displayName ?? null})
    ON CONFLICT (tenant_id, platform_key, handle)
    DO UPDATE SET display_name = COALESCE(scene_identities.display_name, EXCLUDED.display_name), updated_at = now()
    RETURNING id`));
}
/** Upsert relationship (people row) theo (project, identity, account). account 0 = project-level (observe). */
export async function ensureRelationship(
  db: Executor,
  o: { projectId: string; identityId: number; accountId?: number | null; platformKey: string; handle: string; engaged?: boolean },
): Promise<number | null> {
  const acct = o.accountId != null ? Number(o.accountId) || 0 : 0;
  const eng = o.engaged ? sql`, last_engaged_at = now()` : sql``;
  return firstId(await db.execute(sql`
    INSERT INTO people (tenant_id, project_id, identity_id, account_id, platform_key, handle, status, last_engaged_at, created_at, updated_at)
    VALUES ('self', ${o.projectId}, ${o.identityId}, ${acct}, ${canonScenePlatform(o.platformKey)}, ${String(o.handle || '').replace(/^@/, '').trim().toLowerCase()}, 'observed', ${o.engaged ? sql`now()` : sql`NULL`}, now(), now())
    ON CONFLICT (project_id, identity_id, account_id) DO UPDATE SET updated_at = now()${eng}
    RETURNING id`));
}

// Recompute familiarity (0..100) — 1 SOURCE cho MỌI đường (forward-fill insights + outbound
// /scene/interact). Nguyên tắc: **mọi tương tác = cơ hội tăng hiện diện** → mỗi interaction
// cộng trọng số theo loại; reciprocation (direction='theirs', họ reply/engage lại mình) nặng
// nhất. Idempotent (recompute từ toàn bộ interaction set). Cap 100 → warm≥60, engaging>0.
export async function recomputeFamiliarity(db: Executor, peopleId: number): Promise<void> {
  // Trọng số điểm = config app_settings.scene_events (default DEFAULT_SCENE_EVENTS). Hết hardcode SQL.
  const scoreCase = familiarityScoreCase(await getSceneEvents(db));
  await db.execute(sql`
    UPDATE people p SET
      interaction_count = s.cnt,
      they_replied_back = s.replied,
      last_engaged_at   = s.last_at,
      familiarity_score = LEAST(100, s.score),
      status = CASE WHEN p.status IN ('bridged','ignore') THEN p.status
                    WHEN LEAST(100, s.score) >= 60 THEN 'warm'
                    WHEN s.score > 0 THEN 'engaging' ELSE 'observed' END,
      updated_at = now()
    FROM (
      SELECT count(*)::int AS cnt,
             bool_or(direction = 'theirs') AS replied,
             max(at) AS last_at,
             COALESCE(SUM(${scoreCase}), 0)::int AS score
      FROM interactions WHERE people_id = ${peopleId}
    ) s
    WHERE p.id = ${peopleId}`);
}

export async function recordReplierInteractions(db: Executor, cardId: number, replies: Reply[]): Promise<void> {
  try {
    if (!cardId || !Array.isArray(replies) || replies.length === 0) return;

    // Scope: card → brief → habitat → project. No project → can't place a person.
    const ctxRes = await db.execute(sql`
      SELECT h.project_id AS project_id, h.platform_key AS platform_key, b.habitat_id AS habitat_id,
             h.is_own AS is_own,
             COALESCE(c.account_id, b.account_id) AS account_id, c.post_url AS post_url
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = b.habitat_id
      WHERE c.id = ${cardId} LIMIT 1`);
    const ctx = (ctxRes as unknown as Array<Record<string, unknown>>)[0];
    if (!ctx || ctx.project_id == null) return;
    // Owned habitat (isOwn) = sân nhà, KHÔNG track WHO-THEM (repliers = customer/lead,
    // không phải scene-to-bridge). Gate theo habitat (cover mọi platform, không chỉ domain).
    if (ctx.is_own === true) return;
    const projectId = String(ctx.project_id);
    const platformKey = String(ctx.platform_key ?? '');
    const habitatId = ctx.habitat_id != null ? Number(ctx.habitat_id) : null;
    const accountId = ctx.account_id != null ? Number(ctx.account_id) : null;
    const postUrl = ctx.post_url != null ? String(ctx.post_url) : null;

    const seen = new Set<string>();
    for (const r of replies.slice(0, 15)) {
      const handle = String(r.author ?? '').replace(/^@/, '').trim().toLowerCase();
      if (!handle || seen.has(handle)) continue;
      seen.add(handle);
      const threadUrl = (r.permalink ? String(r.permalink) : postUrl)?.slice(0, 400) ?? null;
      const bodyExcerpt = r.body ? String(r.body).slice(0, 600) : null;

      void habitatId;   // habitat KHÔNG còn buộc vào người (relationship per project/account)
      const identityId = await ensureIdentity(db, platformKey, handle);
      if (!identityId) continue;
      const pid = await ensureRelationship(db, { projectId, identityId, accountId, platformKey, handle, engaged: true });
      if (!pid) continue;

      await db.execute(sql`
        INSERT INTO interactions (tenant_id, people_id, card_id, account_id, thread_url, kind, direction, body_excerpt, at)
        VALUES ('self', ${pid}, ${cardId}, ${accountId}, ${threadUrl}, 'reply', 'theirs', ${bodyExcerpt}, now())
        ON CONFLICT (people_id, card_id, direction, kind) DO NOTHING`);

      // Recompute aggregates (weighted) — 1 SOURCE dùng chung outbound + forward-fill.
      await recomputeFamiliarity(db, pid);
    }
  } catch (e) {
    console.warn('[scene-people] record fail:', (e as Error).message);
  }
}
