import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { firstRow, errorResponse } from '@/lib/ext-route';
import { recomputeFamiliarity, ensureIdentity, ensureRelationship } from '@/lib/scene-people';

// POST /api/ext/scene/interact
// Tương tác OUTBOUND mình→họ (like/reply/follow/repost/bookmark) với 1 scene person →
// upsert people + insert interaction (direction='ours') + recompute familiarity. Đây là
// đường familiarity LÊN từ HÀNH ĐỘNG CỦA MÌNH (khác /seeding/insights = khi HỌ reply lại,
// khác /scene/observe = passive, giữ nguyên familiarity). Skip owned habitat (sân nhà).
// Dedup: like/follow KHÔNG có card_id → ON CONFLICT(people_id,card_id,dir,kind) không cover
// (NULL distinct) → check tay theo (people_id, dir, kind, thread_url). Idempotent (re-like
// cùng post = no-op). Recompute = CÙNG công thức scene-people.ts (cnt*20) → 2 đường nhất quán.
// Body: { projectId, habitatId?, platformKey?, handle, kind?, threadUrl?, bodyExcerpt?, accountId? }
const KINDS = new Set(['like', 'reply', 'follow', 'repost', 'bookmark', 'mention']);

export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    projectId?: string; habitatId?: number; platformKey?: string; handle?: string;
    kind?: string; threadUrl?: string; bodyExcerpt?: string; accountId?: number; undo?: boolean;
  };
  const projectId = (body.projectId || '').trim();
  const handle = String(body.handle || '').replace(/^@/, '').trim().toLowerCase();
  const kind = KINDS.has(String(body.kind)) ? String(body.kind) : 'like';
  const undo = body.undo === true;   // unfollow / unlike → xoá interaction, recompute XUỐNG
  if (!projectId || !handle) return errorResponse('projectId + handle required', 400);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  let habitatId = Number(body.habitatId || 0) || null;
  let pk = (body.platformKey || '').trim();
  if (habitatId) {
    const h = firstRow(await db.execute(sql`SELECT is_own, platform_key FROM habitats WHERE id = ${habitatId} LIMIT 1`));
    if (h && h.platform_key) pk = String(h.platform_key);
    // KHÔNG skip owned: outbound = MÌNH chủ động tương tác với scene person → LUÔN log (mình→họ,
    // xây hiện diện). Gate isOwn chỉ cho INBOUND forward-fill (repliers trên post của mình ≠ scene).
    // Nếu thread thuộc owned habitat (sân nhà) → đừng gắn người vào habitat đó → habitat_id = null.
    if (h && h.is_own === true) habitatId = null;
  }
  // x/twitter duality: habitat lưu canonical 'twitter'. Profile-fallback (habitat=null) gửi 'x' →
  // ép 'twitter' để ON CONFLICT(project,platform_key,handle) KHÔNG tách thành 2 row trùng người.
  if (pk === 'x') pk = 'twitter';
  const threadUrl = body.threadUrl ? String(body.threadUrl).slice(0, 400) : null;
  const bodyExcerpt = body.bodyExcerpt ? String(body.bodyExcerpt).slice(0, 600) : null;
  const accountId = body.accountId != null ? (Number(body.accountId) || null) : null;

  // 2-tier upsert: identity GLOBAL + relationship per (project, ACCOUNT) — familiarity riêng theo
  // account mình tương tác (account A thân ≠ account B). account null → 0 (project-level).
  void habitatId;   // người KHÔNG buộc vào habitat nữa
  const identityId = await ensureIdentity(db, pk, handle);
  if (!identityId) return errorResponse('identity upsert failed', 500);
  const pid = await ensureRelationship(db, { projectId, identityId, accountId, platformKey: pk, handle, engaged: !undo });
  if (!pid) return errorResponse('person upsert failed', 500);

  // follow = person-level (KHÔNG buộc thread) → match bỏ qua thread_url; like/reply = per-thread.
  const threadCond = kind === 'follow' ? sql`TRUE` : sql`thread_url IS NOT DISTINCT FROM ${threadUrl}`;
  let deduped = false;
  if (undo) {
    // Bỏ tương tác (unfollow / unlike): xoá interaction khớp → familiarity recompute XUỐNG.
    await db.execute(sql`
      DELETE FROM interactions
      WHERE people_id = ${pid} AND direction = 'ours' AND kind = ${kind} AND ${threadCond}`);
  } else {
    // Dedup tay (card_id NULL): cùng người + cùng kind (+ thread cho like/reply) = đã log → bỏ qua.
    const dup = firstRow(await db.execute(sql`
      SELECT id FROM interactions
      WHERE people_id = ${pid} AND direction = 'ours' AND kind = ${kind} AND ${threadCond}
      LIMIT 1`));
    deduped = !!dup;
    if (!dup) {
      await db.execute(sql`
        INSERT INTO interactions (tenant_id, people_id, card_id, account_id, thread_url, kind, direction, body_excerpt, at)
        VALUES ('self', ${pid}, NULL, ${accountId}, ${threadUrl}, ${kind}, 'ours', ${bodyExcerpt}, now())`);
    }
  }

  // Recompute (weighted) — 1 SOURCE dùng chung với forward-fill insights.
  await recomputeFamiliarity(db, pid);

  const row = firstRow(await db.execute(sql`
    SELECT familiarity_score, status, interaction_count, they_replied_back FROM people WHERE id = ${pid}`));
  return NextResponse.json({
    ok: true, deduped, undone: undo,
    person: {
      handle,
      familiarity: Number(row?.familiarity_score ?? 0),
      status: String(row?.status ?? 'observed'),
      interactions: Number(row?.interaction_count ?? 0),
      repliedBack: row?.they_replied_back === true,
    },
  });
}
