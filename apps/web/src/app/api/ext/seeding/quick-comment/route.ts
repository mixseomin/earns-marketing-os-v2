import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { createPostForBriefPhase, updatePost } from '@/lib/actions/brief-posts';
import { generateFullDraft } from '@/lib/ai/post-draft';
import { normalizeParentUrl } from '@/lib/parent-url';
import { resolveForumChannelId } from '@/lib/actions/forum-channel';
import { firstRow, errorResponse } from '@/lib/ext-route';
import { resolveFormatDirective } from '@/lib/format-presets';
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
    contentType?: 'comment' | 'reply' | 'post' | 'thread' | 'text';
    parentUrl?: string;
    parentTitle?: string;
    parentBody?: string;
    parentAuthor?: string;
    modelId?: string;
    lang?: string;   // 'auto' | 'community' | code ('en','zh','vi'…)
    customPrompt?: string;
    briefOverride?: {
      approach_md?: string;
      tone?: string;
      do_md?: string;
      dont_md?: string;
      narrative_md?: string;
    };
    humanizer?: { knobs?: string[]; intensity?: 'light' | 'medium' | 'heavy' };
    channelUrl?: string;    // URL sub-forum (từ breadcrumb thread) → gắn channel_id
    channelName?: string;
    formatKey?: string;     // preset loại nội dung (lib/format-presets) — ghép vào customInstruction
    targetWords?: number;   // fallback nếu ext cũ ko gửi formatKey
  };

  const habitatId = Number(body.habitatId ?? 0);
  const projectId = String(body.projectId ?? '');
  // contentType: comment/reply = interaction (cần parentUrl); post/thread/text =
  // standalone (parentUrl=null). createPostForBriefPhase auto-normalize qua
  // formatMeta() nên giá trị lạ rơi về 'text' an toàn.
  const ALLOWED_CT = ['comment', 'reply', 'post', 'thread', 'text'] as const;
  const contentType = (ALLOWED_CT as readonly string[]).includes(body.contentType ?? '')
    ? (body.contentType as string) : 'comment';
  if (!habitatId || !projectId) {
    return errorResponse('habitatId + projectId required', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // Resolve briefId: nếu ext không pass → pick latest brief của habitat
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

  // Default phase: lấy currentPhase từ brief (fallback 'warm-up').
  const briefRows = await db.execute(sql`
    SELECT current_phase FROM community_briefs WHERE id = ${briefId} LIMIT 1
  `);
  const phase = firstRow(briefRows)?.current_phase as Phase | undefined;
  const useFallbackPhase: Phase = (phase ?? 'warm-up') as Phase;

  // 1. Tạo card với content_type comment/reply (+ gắn channel_id sub-forum nếu có).
  const channelDbId = await resolveForumChannelId(db, habitatId, body.channelUrl, body.channelName);
  const create = await createPostForBriefPhase(projectId, briefId, useFallbackPhase, contentType, undefined, channelDbId);
  if (!create.ok || !create.id) {
    return errorResponse(create.error ?? 'createPost failed', 500);
  }
  const cardId = create.id;

  // 2. Fill parent_* fields
  await updatePost(projectId, cardId, {
    parentUrl: normalizeParentUrl(body.parentUrl),   // strip query (?screen_view_count…)/slash → match khi mở lại

    parentTitle: body.parentTitle ?? null,
    parentBody: body.parentBody ?? null,
    parentAuthor: body.parentAuthor ?? null,
  });

  // 3. AI gen draft — user chọn model qua side panel popover.
  // Default gpt-4.1-mini (cân bằng giá/chất); customPrompt + format preset nhúng vào prompt (HIGH PRIORITY).
  const fmt = resolveFormatDirective(body.formatKey, body.targetWords);
  const customInstruction = [body.customPrompt, fmt.directive && `[FORMAT & ĐỘ DÀI bắt buộc] ${fmt.directive}`]
    .filter(Boolean).join('\n');
  const genStart = Date.now();
  const draft = await generateFullDraft(cardId, {
    modelId: body.modelId || 'gpt-4.1-mini',
    customInstruction: customInstruction || undefined,
    lang: body.lang,
    briefOverride: body.briefOverride,
    humanizer: body.humanizer && Array.isArray(body.humanizer.knobs) && body.humanizer.knobs.length > 0
      ? { knobs: body.humanizer.knobs, intensity: body.humanizer.intensity }
      : undefined,
  });
  const genDurationMs = Date.now() - genStart;

  // Save meta cho draft AI generic — cost ƯỚC LƯỢNG từ token usage (estimateCostUsd).
  const draftCost = (draft && typeof (draft as { costUsd?: number }).costUsd === 'number') ? (draft as { costUsd?: number }).costUsd : null;
  await db.update(cards).set({
    answerSource: 'ai',
    genModelUsed: (draft as { modelUsed?: string }).modelUsed || body.modelId || 'gpt-4.1-mini',
    genDurationMs,
    genCostUsd: draftCost != null ? String(draftCost) : null,
    updatedAt: new Date(),
  }).where(eq(cards.id, cardId));

  // 4. Read final card + context AI đã dùng (transparency cho user side panel)
  const finalRows = await db.execute(sql`
    SELECT
      c.body_target, c.body_review, c.title, c.target_lang,
      b.tone AS brief_tone, b.current_phase,
      h.voice_profile AS habitat_voice, h.language AS habitat_lang,
      pa.handle AS account_handle, pa.persona
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE c.id = ${cardId}
    LIMIT 1
  `);
  const f = firstRow(finalRows) ?? {};
  const persona = (f.persona as Record<string, unknown> | null) ?? {};

  return NextResponse.json({
    ok: true,
    cardId,
    cardRef: create.cardRef,
    bodyTarget: f.body_target ?? draft.bodyTarget ?? '',
    bodyReview: f.body_review ?? draft.bodyReview ?? '',
    title: f.title ?? draft.title ?? '',
    targetLang: f.target_lang ?? 'en',
    // Context summary — ext side panel hiển thị "AI đã dùng:" chip
    contextUsed: {
      accountHandle: f.account_handle ? String(f.account_handle) : null,
      personaName: persona.name_first
        ? String(persona.name_first) + (persona.name_last ? ' ' + String(persona.name_last) : '')
        : null,
      personaVoiceSummary: persona.voice_summary ? String(persona.voice_summary) : null,
      personaNarrativeStyle: persona.narrative_style ? String(persona.narrative_style) : null,
      habitatVoice: String(f.habitat_voice ?? 'regular'),
      habitatLanguage: String(f.habitat_lang ?? ''),
      currentPhase: String(f.current_phase ?? ''),
      briefTone: String(f.brief_tone ?? ''),
    },
    draftOk: draft.ok,
    draftError: draft.error,
  });
}
