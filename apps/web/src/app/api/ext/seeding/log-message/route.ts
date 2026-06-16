import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { createPostForBriefPhase, updatePost } from '@/lib/actions/brief-posts';
import { firstRow, errorResponse } from '@/lib/ext-route';
import type { Phase } from '@/lib/phase-plan';

// POST /api/ext/seeding/log-message
// Body: { habitatId, projectId, briefId?, message, parentUrl?, parentTitle?,
//         contentType? ('text'), direction? ('out'|'in') }
//
// CHAT-LOG (KHÔNG AI gen): ghi 1 tin nhắn chat (DM / channel) thành card
// content_type='text', answer_source='log', body_target = message thật.
// Khác quick-comment: không gọi generateFullDraft — chỉ lưu nguyên văn.
// Group nhiều message cùng conversation qua parentUrl (vd 'dm:<conv_id>' hoặc
// URL channel) → side panel + engagements list theo parentUrl như transcript.
// "Promote to seed" = card này đã là card, chỉ cần AI rewrite sau nếu muốn.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    habitatId?: number;
    projectId?: string;
    briefId?: number | null;
    message?: string;
    parentUrl?: string;
    parentTitle?: string;
    contentType?: string;
    direction?: 'out' | 'in';
  };

  const habitatId = Number(body.habitatId ?? 0);
  const projectId = String(body.projectId ?? '');
  const message = String(body.message ?? '').trim();
  // Chat message luôn standalone text (không phải interaction cần parentUrl bắt buộc).
  const contentType = body.contentType === 'thread' ? 'thread' : 'text';
  const direction = body.direction === 'in' ? 'in' : 'out';

  if (!habitatId || !projectId) {
    return errorResponse('habitatId + projectId required', 400);
  }
  if (!message) {
    return errorResponse('message required', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // Resolve briefId: ext không pass → latest brief của habitat (giống quick-comment).
  let briefId = body.briefId ?? null;
  if (!briefId) {
    const rows = await db.execute(sql`
      SELECT id FROM community_briefs
      WHERE habitat_id = ${habitatId} AND project_id = ${projectId}
      ORDER BY updated_at DESC LIMIT 1
    `);
    const r = firstRow(rows);
    briefId = r ? Number(r.id) : null;
  }
  if (!briefId) {
    return errorResponse('Habitat chưa có brief nào trong project. Vào MOS2 tạo brief trước.', 400);
  }

  const briefRows = await db.execute(sql`
    SELECT current_phase FROM community_briefs WHERE id = ${briefId} LIMIT 1
  `);
  const phase = firstRow(briefRows)?.current_phase as Phase | undefined;
  const useFallbackPhase: Phase = (phase ?? 'warm-up') as Phase;

  // 1. Tạo card text + fill body_target = message NGUYÊN VĂN (không AI).
  const create = await createPostForBriefPhase(projectId, briefId, useFallbackPhase, contentType);
  if (!create.ok || !create.id) {
    return errorResponse(create.error ?? 'createPost failed', 500);
  }
  const cardId = create.id;

  await updatePost(projectId, cardId, {
    bodyTarget: message,
    parentUrl: body.parentUrl ?? null,
    parentTitle: body.parentTitle ?? null,
  });

  // 2. Mark answer_source='log' để phân biệt với seed (AI-gen). direction lưu
  // trong post_note để biết tin gửi (out) hay nhận (in) khi xem transcript.
  await db.update(cards).set({
    answerSource: 'log',
    postNote: `chat:${direction}`,
    updatedAt: new Date(),
  }).where(eq(cards.id, cardId));

  return NextResponse.json({
    ok: true,
    cardId,
    cardRef: create.cardRef,
    direction,
  });
}
