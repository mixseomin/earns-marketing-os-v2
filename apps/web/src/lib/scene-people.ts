import { sql } from 'drizzle-orm';

// WHO-THEM forward-fill (migration 0099). From a card's topReplies (author
// handles already captured by the ext's syncForumReplies) → upsert `people` +
// `interactions`, recompute familiarity. Idempotent per (people,card,dir,kind).
// Non-fatal: a failure here must NEVER break the insights write (mirror of
// appendInsightsSnapshot). Spec: earns-strategy wiki/mos/crew-scene-layer.md.
type Executor = { execute: (q: ReturnType<typeof sql>) => Promise<unknown> };
type Reply = { author?: string; body?: string; permalink?: string; repliedToYou?: boolean };

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

      const upRes = await db.execute(sql`
        INSERT INTO people (tenant_id, project_id, platform_key, handle, habitat_id, status, last_engaged_at, created_at, updated_at)
        VALUES ('self', ${projectId}, ${platformKey}, ${handle}, ${habitatId}, 'observed', now(), now(), now())
        ON CONFLICT (project_id, platform_key, handle) DO UPDATE SET updated_at = now()
        RETURNING id`);
      const pid = Number((upRes as unknown as Array<Record<string, unknown>>)[0]?.id);
      if (!pid) continue;

      await db.execute(sql`
        INSERT INTO interactions (tenant_id, people_id, card_id, account_id, thread_url, kind, direction, body_excerpt, at)
        VALUES ('self', ${pid}, ${cardId}, ${accountId}, ${threadUrl}, 'reply', 'theirs', ${bodyExcerpt}, now())
        ON CONFLICT (people_id, card_id, direction, kind) DO NOTHING`);

      // Recompute aggregates from the interaction set (idempotent under re-sync).
      await db.execute(sql`
        UPDATE people p SET
          interaction_count = s.cnt,
          they_replied_back = s.replied,
          last_engaged_at   = s.last_at,
          familiarity_score = LEAST(100, s.cnt * 20),
          status = CASE WHEN p.status IN ('bridged','ignore') THEN p.status
                        WHEN LEAST(100, s.cnt * 20) >= 60 THEN 'warm'
                        WHEN s.cnt > 0 THEN 'engaging' ELSE 'observed' END,
          updated_at = now()
        FROM (SELECT count(*)::int AS cnt, bool_or(direction = 'theirs') AS replied, max(at) AS last_at
              FROM interactions WHERE people_id = ${pid}) s
        WHERE p.id = ${pid}`);
    }
  } catch (e) {
    console.warn('[scene-people] record fail:', (e as Error).message);
  }
}
