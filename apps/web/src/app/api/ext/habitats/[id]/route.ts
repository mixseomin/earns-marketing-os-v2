import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb, habitats, platforms } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, firstRow } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// GET /api/ext/habitats/[id] — full detail cho Crew ext "🏠 Habitat" tab
// (giống MOS2: rules/gates/topics/voice/members). Read-only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;
  const { id } = await params;
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.title, h.kind, h.project_id, h.platform_key, h.technology_key,
           h.language, h.community_type, h.members, h.weekly_visitors, h.weekly_contributions,
           h.activity, h.status, h.health, h.privacy, h.mod_strictness, h.min_karma,
           h.min_account_age_days, h.min_posts, h.links_allowed_after, h.posting_rules,
           h.posting_rules_url, h.dominant_topics, h.forbidden_topics, h.best_post_times,
           h.voice_profile, h.voice_notes, h.ai_content_detection, h.ai_detection_note,
           h.description, h.icon_url, h.url, h.is_own, h.join_checklist,
           (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
    FROM habitats h WHERE h.id = ${Number(id)} LIMIT 1
  `);
  const r = firstRow(rows);
  if (!r) return NextResponse.json({ habitat: null }, { status: 404 });
  const num = (v: unknown) => (v == null ? 0 : Number(v));
  const str = (v: unknown) => (v == null ? '' : String(v));
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return NextResponse.json({
    habitat: {
      id: num(r.id), name: str(r.name), title: str(r.title), kind: str(r.kind),
      projectId: str(r.project_id), platformKey: r.platform_key ? str(r.platform_key) : null,
      technologyKey: r.technology_key ? str(r.technology_key) : null,
      language: str(r.language), communityType: str(r.community_type),
      members: num(r.members), weeklyVisitors: num(r.weekly_visitors), weeklyContributions: num(r.weekly_contributions),
      activity: str(r.activity), status: str(r.status), health: str(r.health), privacy: str(r.privacy),
      modStrictness: str(r.mod_strictness), minKarma: num(r.min_karma),
      minAccountAgeDays: num(r.min_account_age_days), minPosts: num(r.min_posts),
      linksAllowedAfter: str(r.links_allowed_after), postingRules: str(r.posting_rules),
      postingRulesUrl: str(r.posting_rules_url), dominantTopics: arr(r.dominant_topics),
      forbiddenTopics: arr(r.forbidden_topics), bestPostTimes: str(r.best_post_times),
      voiceProfile: str(r.voice_profile), voiceNotes: str(r.voice_notes),
      aiContentDetection: r.ai_content_detection === true, aiDetectionNote: str(r.ai_detection_note),
      description: str(r.description), iconUrl: r.icon_url ? str(r.icon_url) : null,
      url: r.url ? str(r.url) : null, isOwn: r.is_own === true,
      joinChecklist: arr(r.join_checklist),   // template [{key,label,tip?,actionUrl?}] — progress ở community_briefs
      briefId: r.brief_id ? num(r.brief_id) : null,
    },
  });
}

// PATCH /api/ext/habitats/[id] { platform_key?, kind?, isOwn? }
// Đổi platform map cho habitat đã tồn tại (Req#1 — habitat đã map muốn chọn
// platform khác). Ensure platform tồn tại trước (FK), create nếu mới.
// isOwn = đánh dấu "site của tôi" → tắt tracking (scene/WHO-THEM/scanner).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { platform_key?: string; kind?: string; isOwn?: boolean };

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.platform_key) {
    const pk = body.platform_key.trim();
    // Ensure platform tồn tại (FK habitats_platform_key_fkey).
    const exists = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, pk)).limit(1);
    if (exists.length === 0) {
      await db.insert(platforms).values({
        key: pk,
        label: pk,
        signupUrl: '',
        priority: 'medium',
      }).onConflictDoNothing();
    }
    patch.platformKey = pk;
  }
  if (body.kind) patch.kind = body.kind.trim();
  if (typeof body.isOwn === 'boolean') patch.isOwn = body.isOwn;

  if (Object.keys(patch).length <= 1) {
    return errorResponse('nothing to update', 400);
  }

  await db.update(habitats).set(patch).where(eq(habitats.id, Number(id)));
  return NextResponse.json({ ok: true });
}

// DELETE /api/ext/habitats/[id] → xoá habitat (tạo nhầm). admin-only (deniedForStaff chặn DELETE).
// FK: habitat_channels/community_briefs/habitat_tribes CASCADE · people.habitat_id SET NULL ·
// cards.habitat_id (bare bigint, no FK) → giữ card, chỉ dangling ref. FK chặn → 409 (không 500 mù).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return errorResponse('bad id', 400);
  const [row] = await db.select({ id: habitats.id }).from(habitats).where(eq(habitats.id, idNum)).limit(1);
  if (!row) return errorResponse('not found', 404);
  try {
    await db.delete(habitats).where(eq(habitats.id, idNum));
  } catch (e) {
    return errorResponse('delete failed (FK?): ' + (e instanceof Error ? e.message : String(e)), 409);
  }
  return NextResponse.json({ ok: true, id: idNum });
}
