import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

// POST /api/ext/brief/update
// Body: { briefId, approach_md?, tone?, do_md?, dont_md?, narrative_md? }
//
// Partial update — chỉ field nào gửi được update. Ext side panel cho user
// edit brief "tại thực địa" rồi muốn lưu lại vào DB (không chỉ dùng cho
// session hiện tại). Khác briefOverride trong gen-draft request: lần này
// commit thật vào community_briefs.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    briefId?: number;
    approach_md?: string;
    tone?: string;
    humanizer?: { knobs?: string[]; intensity?: string } | null;   // override per-habitat; null = inherit account
    do_md?: string;
    dont_md?: string;
    narrative_md?: string;
    // TIER 2 join (vào cộng đồng): membership + steps progress + ngày hẹn duyệt.
    joinStatus?: string;
    joinNote?: string;
    joinUrl?: string;
    followUpAt?: string | null;
    joinChecklistUpdates?: Record<string, { done: boolean }>;
  };

  const briefId = Number(body.briefId ?? 0);
  if (!briefId) {
    return errorResponse('briefId required', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // Verify brief tồn tại
  const checkRows = await db.execute(sql`
    SELECT id FROM community_briefs WHERE id = ${briefId} LIMIT 1
  `);
  if (!(checkRows as unknown as Array<unknown>)[0]) {
    return errorResponse('Brief not found', 404);
  }

  // Build SET clause động — chỉ update field user explicit gửi (typeof string).
  // Empty string '' = clear field (intentional). undefined = skip.
  const sets: ReturnType<typeof sql>[] = [];
  if (typeof body.approach_md === 'string') sets.push(sql`approach_md = ${body.approach_md}`);
  if (typeof body.tone === 'string') sets.push(sql`tone = ${body.tone}`);
  if (body.humanizer !== undefined) sets.push(sql`humanizer = ${body.humanizer == null ? null : JSON.stringify(body.humanizer)}::jsonb`);
  if (typeof body.do_md === 'string') sets.push(sql`do_md = ${body.do_md}`);
  if (typeof body.dont_md === 'string') sets.push(sql`dont_md = ${body.dont_md}`);
  if (typeof body.narrative_md === 'string') sets.push(sql`narrative_md = ${body.narrative_md}`);
  // TIER 2 join fields
  const VALID_JOIN = ['not_joined', 'pending', 'joined', 'rejected', 'kicked', 'left'];
  if (typeof body.joinStatus === 'string' && VALID_JOIN.includes(body.joinStatus)) sets.push(sql`join_status = ${body.joinStatus}`);
  if (typeof body.joinNote === 'string') sets.push(sql`join_note = ${body.joinNote}`);
  if (typeof body.joinUrl === 'string') sets.push(sql`join_url = ${body.joinUrl}`);
  if (body.followUpAt !== undefined) sets.push(sql`follow_up_at = ${body.followUpAt ? new Date(body.followUpAt).toISOString() : null}`);
  if (body.joinChecklistUpdates && typeof body.joinChecklistUpdates === 'object') {
    // merge top-level: { stepKey: { done } } → jsonb || (replace key). join_checklist NOT NULL default {}.
    const patch: Record<string, { done: boolean; updatedAt: string }> = {};
    for (const [k, v] of Object.entries(body.joinChecklistUpdates)) patch[k] = { done: !!v?.done, updatedAt: new Date().toISOString() };
    sets.push(sql`join_checklist = join_checklist || ${JSON.stringify(patch)}::jsonb`);
  }
  sets.push(sql`updated_at = NOW()`);

  if (sets.length === 1) {
    return errorResponse('Không có field nào để update', 400);
  }

  const setClause = sql.join(sets, sql`, `);
  await db.execute(sql`UPDATE community_briefs SET ${setClause} WHERE id = ${briefId}`);

  return NextResponse.json({
    ok: true,
    briefId,
    updated: Object.keys(body).filter((k) => k !== 'briefId'),
  });
}
