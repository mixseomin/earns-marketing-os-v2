import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { guardrailSkip, composeTier, type AccountFacts, type Overlay } from '@/lib/board-radar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/boards/badge?platformKey=reddit&projectId=X&accountId=N&names=r/a,r/b
// 3-layer lookup per board name found on the live page → composed GO/ADD/TRACK/SKIP tier.
// Batch (chunk client-side when names>10). Private boards gated server-side.
export async function GET(req: Request) {
  const authErr = checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const p = new URL(req.url).searchParams;
  const projectId = (p.get('projectId') || '').trim();
  const platformKey = (p.get('platformKey') || '').trim() || null;
  const accountIdRaw = (p.get('accountId') || '').trim();
  const accountId = accountIdRaw && Number.isFinite(Number(accountIdRaw)) ? Number(accountIdRaw) : null;
  const names = (p.get('names') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!projectId) return errorResponse('projectId required', 400);
  if (!names.length) return okResponse({ badges: [] });
  const lowered = [...new Set(names.map((n) => n.toLowerCase()))].slice(0, 60);

  // account facts once (for guardrail) — effective status via the account row.
  let acc: AccountFacts | null = null;
  if (accountId != null) {
    const ar = (await db.execute(sql`SELECT status, created_at, account_stats FROM platform_accounts WHERE id = ${accountId} LIMIT 1`)) as Array<Record<string, unknown>>;
    const a = ar[0];
    if (a) {
      const st = (a.account_stats || {}) as Record<string, unknown>;
      const created = a.created_at ? new Date(String(a.created_at)).getTime() : 0;
      acc = {
        status: a.status ? String(a.status) : '',
        karma: numOr(st.karma),
        posts: numOr(st.posts) ?? numOr(st.post_karma),
        ageDays: created ? (Date.now() - created) / 86400000 : undefined,
      };
    }
  }

  // one batch query: board + project score + project habitat + account brief
  const rows = (await db.execute(sql`
    SELECT pb.id AS board_id, pb.name, pb.members, pb.privacy AS board_privacy,
           s.topic_tier,
           h.id AS habitat_id, h.privacy AS h_privacy, h.min_karma, h.min_account_age_days, h.min_posts, h.mod_strictness,
           b.id AS brief_id, b.join_status, b.approach_md
    FROM platform_boards pb
    LEFT JOIN board_project_score s ON s.board_id = pb.id AND s.project_id = ${projectId} AND s.tenant_id = pb.tenant_id
    LEFT JOIN habitats h ON h.board_id = pb.id AND h.project_id = ${projectId}
    LEFT JOIN community_briefs b ON b.habitat_id = h.id ${accountId != null ? sql`AND b.account_id = ${accountId}` : sql`AND false`}
    WHERE pb.tenant_id = 'self'
      AND pb.platform_key IS NOT DISTINCT FROM ${platformKey}
      AND lower(pb.name) IN (${sql.join(lowered.map((n) => sql`${n}`), sql`, `)})`)) as Array<Record<string, unknown>>;

  const byName = new Map<string, Record<string, unknown>>();
  for (const r of rows) byName.set(String(r.name).toLowerCase(), r);

  const badges = names.map((name) => {
    const r = byName.get(name.toLowerCase());
    if (!r) return { name, boardId: null, tier: 'NONE' as const, topicTier: null, hasHabitat: false, hasBrief: false, joinStatus: null, reason: '', members: 0 };
    const overlay: Overlay = {
      habitatId: r.habitat_id != null ? Number(r.habitat_id) : null,
      hasHabitat: r.habitat_id != null,
      briefId: r.brief_id != null ? Number(r.brief_id) : null,
      hasBrief: r.brief_id != null,
      joinStatus: r.join_status != null ? String(r.join_status) : null,
      approachReady: !!(r.approach_md && String(r.approach_md).trim()),
    };
    const gate = {
      privacy: String(r.h_privacy ?? r.board_privacy ?? ''),
      minKarma: numOr(r.min_karma) ?? 0,
      minAccountAgeDays: numOr(r.min_account_age_days) ?? 0,
      minPosts: numOr(r.min_posts) ?? 0,
      modStrictness: String(r.mod_strictness ?? ''),
    };
    const guardrail = guardrailSkip(gate, acc, overlay.joinStatus);
    const { tier, reason } = composeTier({ topicTier: r.topic_tier != null ? String(r.topic_tier) : null, overlay, guardrail });
    return {
      name, boardId: Number(r.board_id), tier, topicTier: r.topic_tier != null ? String(r.topic_tier) : null,
      hasHabitat: overlay.hasHabitat, hasBrief: overlay.hasBrief, joinStatus: overlay.joinStatus,
      reason, members: numOr(r.members) ?? 0,
    };
  });

  return okResponse({ badges });
}
function numOr(v: unknown): number | undefined { return typeof v === 'number' ? v : (typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined); }
