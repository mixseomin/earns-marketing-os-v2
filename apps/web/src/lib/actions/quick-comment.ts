'use server';

// Soạn 1 comment/reply CÓ BỐI CẢNH: tạo card gắn parent_* → gọi AI sinh nháp → trả về cho ext.
//
// Dùng chung cho HAI lối vào, vì bản chất là một việc:
//   · /api/ext/seeding/quick-comment — người mở một thread rồi bấm soạn (lối cũ)
//   · /api/ext/plan/run              — chạy kế hoạch đã lên lịch: máy tự đọc nhóm, tự chọn thread
// Trước đây chỉ có lối 1 và toàn bộ logic nằm trong route; lối 2 mà chép lại là hai bản trôi khác
// nhau ngay lần sửa prompt đầu tiên.

import { eq, sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { createPostForBriefPhase, updatePost } from './brief-posts';
import { generateFullDraft } from '@/lib/ai/post-draft';
import { normalizeParentUrl } from '@/lib/parent-url';
import { resolveForumChannelId } from './forum-channel';
import { firstRow } from '@/lib/ext-route';
import { resolveFormatDirective, applyLengthPriority } from '@/lib/format-presets';
import type { Phase } from '@/lib/phase-plan';

export interface ComposeCommentInput {
  habitatId?: number;
  projectId?: string;
  briefId?: number | null;
  contentType?: 'comment' | 'reply' | 'post' | 'thread' | 'text';
  parentUrl?: string;
  parentTitle?: string;
  parentBody?: string;
  parentAuthor?: string;
  modelId?: string;
  lang?: string;
  customPrompt?: string;
  briefOverride?: { approach_md?: string; tone?: string; do_md?: string; dont_md?: string; narrative_md?: string };
  humanizer?: { knobs?: string[]; intensity?: 'light' | 'medium' | 'heavy' };
  channelUrl?: string;
  channelName?: string;
  formatKey?: string;
  targetWords?: number;
  maxChars?: number;
}

export type ComposeCommentResult =
  | { ok: false; error: string; status: number }
  | { ok: true; cardId: number; cardRef?: string; bodyTarget: string; bodyReview: string; title: string;
      targetLang: string; contextUsed: Record<string, unknown>; draftOk: boolean; draftError?: string };

const err = (error: string, status = 400): ComposeCommentResult => ({ ok: false, error, status });

export async function composeCommentCard(body: ComposeCommentInput): Promise<ComposeCommentResult> {
  const habitatId = Number(body.habitatId ?? 0);
  const projectId = String(body.projectId ?? '');
  // contentType: comment/reply = interaction (cần parentUrl); post/thread/text =
  // standalone (parentUrl=null). createPostForBriefPhase auto-normalize qua
  // formatMeta() nên giá trị lạ rơi về 'text' an toàn.
  const ALLOWED_CT = ['comment', 'reply', 'post', 'thread', 'text'] as const;
  const contentType = (ALLOWED_CT as readonly string[]).includes(body.contentType ?? '')
    ? (body.contentType as string) : 'comment';
  if (!habitatId || !projectId) {
    return err('habitatId + projectId required', 400);
  }

  const db = getDb();
  if (!db) return err('DATABASE_URL not configured', 503);

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
    return err('Habitat chưa có brief nào trong project. Vào MOS2 tạo brief trước.', 400);
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
    return err(create.error ?? 'createPost failed', 500);
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
  // 'account' format → lấy persona.replyStyle của account (qua brief.account_id) làm chỉ thị độ dài/style.
  let acctStyle = '';
  if (body.formatKey === 'account' && briefId) {
    const sr = firstRow(await db.execute(sql`
      SELECT pa.persona->>'replyStyle' AS s FROM community_briefs b
      JOIN platform_accounts pa ON pa.id = b.account_id WHERE b.id = ${briefId} LIMIT 1`));
    acctStyle = sr?.s ? String(sr.s) : '';
  }
  const fmt = resolveFormatDirective(body.formatKey, body.targetWords, acctStyle);
  // HARD char-cap nền tảng: nếu page giới hạn ký tự (X 280, forum free-tier…) → ÉP AI ≤ maxChars,
  // đè cả format preset (preset = mục tiêu, cap = ràng buộc cứng platform sẽ cắt nếu vượt).
  const maxChars = Number.isFinite(body.maxChars) && (body.maxChars as number) > 0 ? Math.floor(body.maxChars as number) : 0;
  const capDirective = maxChars
    ? `[GIỚI HẠN KÝ TỰ CỨNG] Bài đăng PHẢI ≤ ${maxChars} ký tự (kể cả dấu cách, emoji, link). Nền tảng sẽ CẮT nếu vượt. Viết gọn trong hạn này; nếu cần, ưu tiên ý chính, bỏ ý phụ. Tuyệt đối KHÔNG vượt ${maxChars} ký tự.`
    : '';
  const customInstruction = [body.customPrompt, fmt.directive && `[FORMAT & ĐỘ DÀI bắt buộc] ${fmt.directive}`, capDirective]
    .filter(Boolean).join('\n');
  const genStart = Date.now();
  // NGUYÊN TẮC ƯU TIÊN: format preset (lớp BÀI) đè length-knob humanizer (lớp style) — applyLengthPriority
  // loại one-sentence/two-three khi có preset, kẻo prompt humanizer ép "≤3 câu" chọi với độ dài đã chọn.
  const hzKnobs = applyLengthPriority(body.humanizer?.knobs, body.formatKey, body.targetWords);
  const draft = await generateFullDraft(cardId, {
    modelId: body.modelId || 'gpt-4.1-mini',
    customInstruction: customInstruction || undefined,
    lang: body.lang,
    briefOverride: body.briefOverride,
    humanizer: hzKnobs.length ? { knobs: hzKnobs, intensity: body.humanizer?.intensity } : undefined,
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

  return {
    ok: true as const,
    cardId,
    cardRef: create.cardRef,
    bodyTarget: String(f.body_target ?? draft.bodyTarget ?? ''),
    bodyReview: String(f.body_review ?? draft.bodyReview ?? ''),
    title: String(f.title ?? draft.title ?? ''),
    targetLang: String(f.target_lang ?? 'en'),
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
  };
}
