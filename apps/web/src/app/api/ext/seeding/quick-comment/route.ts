import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { createPostForBriefPhase, updatePost } from '@/lib/actions/brief-posts';
import { generateFullDraft } from '@/lib/ai/post-draft';
import type { Phase } from '@/lib/phase-plan';

// POST /api/ext/seeding/quick-comment
// Body: { habitatId, projectId, briefId, contentType ('comment'|'reply'),
//         parentUrl, parentTitle, parentBody, parentAuthor }
//
// Tạo card mới với content_type=comment/reply + parent_* fields → call AI
// generateFullDraft ngay → trả body cho ext show + copy.
//
// Flow ext side panel: scan thread → POST endpoint này → fill draft trong panel.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    habitatId?: number;
    projectId?: string;
    briefId?: number | null;
    contentType?: 'comment' | 'reply';
    parentUrl?: string;
    parentTitle?: string;
    parentBody?: string;
    parentAuthor?: string;
    modelId?: string;
    customPrompt?: string;
  };

  const habitatId = Number(body.habitatId ?? 0);
  const projectId = String(body.projectId ?? '');
  const contentType = (body.contentType === 'reply' ? 'reply' : 'comment');
  if (!habitatId || !projectId) {
    return NextResponse.json({ ok: false, error: 'habitatId + projectId required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // Resolve briefId: nếu ext không pass → pick latest brief của habitat
  let briefId = body.briefId ?? null;
  if (!briefId) {
    const rows = await db.execute(sql`
      SELECT id FROM community_briefs
      WHERE habitat_id = ${habitatId} AND project_id = ${projectId}
      ORDER BY updated_at DESC LIMIT 1
    `);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    briefId = r ? Number(r.id) : null;
  }
  if (!briefId) {
    return NextResponse.json({ ok: false, error: 'Habitat chưa có brief nào trong project. Vào MOS2 tạo brief trước.' }, { status: 400 });
  }

  // Default phase: lấy currentPhase từ brief (fallback 'warm-up').
  const briefRows = await db.execute(sql`
    SELECT current_phase FROM community_briefs WHERE id = ${briefId} LIMIT 1
  `);
  const phase = (briefRows as unknown as Array<Record<string, unknown>>)[0]?.current_phase as Phase | undefined;
  const useFallbackPhase: Phase = (phase ?? 'warm-up') as Phase;

  // 1. Tạo card với content_type comment/reply
  const create = await createPostForBriefPhase(projectId, briefId, useFallbackPhase, contentType);
  if (!create.ok || !create.id) {
    return NextResponse.json({ ok: false, error: create.error ?? 'createPost failed' }, { status: 500 });
  }
  const cardId = create.id;

  // 2. Fill parent_* fields
  await updatePost(projectId, cardId, {
    parentUrl: body.parentUrl ?? null,
    parentTitle: body.parentTitle ?? null,
    parentBody: body.parentBody ?? null,
    parentAuthor: body.parentAuthor ?? null,
  });

  // 3. AI gen draft — user chọn model qua side panel popover.
  // Default gpt-4.1-mini (cân bằng giá/chất); customPrompt nhúng vào prompt.
  const draft = await generateFullDraft(cardId, {
    modelId: body.modelId || 'gpt-4.1-mini',
    customInstruction: body.customPrompt,
  });

  // 4. Read final card
  const finalRows = await db.execute(sql`
    SELECT body_target, body_review, title, target_lang FROM cards WHERE id = ${cardId}
  `);
  const f = (finalRows as unknown as Array<Record<string, unknown>>)[0] ?? {};

  return NextResponse.json({
    ok: true,
    cardId,
    cardRef: create.cardRef,
    bodyTarget: f.body_target ?? draft.bodyTarget ?? '',
    bodyReview: f.body_review ?? draft.bodyReview ?? '',
    title: f.title ?? draft.title ?? '',
    targetLang: f.target_lang ?? 'en',
    draftOk: draft.ok,
    draftError: draft.error,
  });
}
