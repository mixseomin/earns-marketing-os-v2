import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { checkAuth } from '../../_auth';
import { createPostForBriefPhase, updatePost } from '@/lib/actions/brief-posts';
import type { Phase } from '@/lib/phase-plan';

// POST /api/ext/seeding/astrolas-answer
// Body giống /quick-comment nhưng dùng Astrolas API (data-backed) thay vì
// AI generic. Endpoint contract Astrolas:
//   POST https://astrolas.com/api/v1/qa/answer
//   Auth Bearer ASTROLAS_QA_KEY
//   Body: { question_title, question_body, question_lang, platform, subreddit?,
//           tone_target?, max_length?, topics_hint?, request_id? }
//
// Flow ext side panel:
//   1. Đã có parent context (title/body từ DOM scan)
//   2. Click ⭐ Astrolas Answer → endpoint này:
//      - Tạo card mới (giống quick-comment)
//      - Fill parent_*
//      - Call Astrolas API với context đầy đủ (lấy brief.tone + persona + voice)
//      - Save answer + sources → body_target + answer_source='astrolas'
//      - Return body + sources cho ext show

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
    maxLength?: number;
    topicsHint?: string[];
    llmConfig?: string;  // 'deep_reading' | 'default_chat' | 'intent_router' | 'openai_*' — Astrolas tự validate
    customPrompt?: string;  // Operator instruction kèm theo brief context
    briefOverride?: {       // User edit brief tại side panel — override field-by-field
      approach_md?: string;
      tone?: string;
      do_md?: string;
      dont_md?: string;
      narrative_md?: string;
    };
  };

  const habitatId = Number(body.habitatId ?? 0);
  const projectId = String(body.projectId ?? '');
  const contentType = (body.contentType === 'reply' ? 'reply' : 'comment');
  if (!habitatId || !projectId) {
    return NextResponse.json({ ok: false, error: 'habitatId + projectId required' }, { status: 400 });
  }
  if (!body.parentTitle?.trim() || !body.parentBody?.trim()) {
    return NextResponse.json({ ok: false, error: 'parentTitle + parentBody required (cần context thread/post gốc)' }, { status: 400 });
  }

  const apiUrl = process.env.ASTROLAS_API_URL;
  const apiKey = process.env.ASTROLAS_QA_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: 'Astrolas API chưa cấu hình (ASTROLAS_API_URL + ASTROLAS_QA_KEY)' }, { status: 503 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // 1. Resolve briefId + brief context (tone, voice, phase, persona)
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
    return NextResponse.json({ ok: false, error: 'Habitat chưa có brief nào. Tạo brief trong MOS2 trước.' }, { status: 400 });
  }

  // Load context — phase + brief + habitat + persona để build payload Astrolas đầy đủ.
  const ctxRows = await db.execute(sql`
    SELECT
      b.current_phase, b.tone AS brief_tone, b.do_md, b.dont_md, b.approach_md, b.narrative_md,
      h.language AS habitat_lang, h.voice_profile AS habitat_voice, h.voice_notes,
      h.dominant_topics, h.forbidden_topics,
      pa.handle AS account_handle, pa.persona
    FROM community_briefs b
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE b.id = ${briefId}
    LIMIT 1
  `);
  const ctxRaw = (ctxRows as unknown as Array<Record<string, unknown>>)[0] ?? {};
  // Apply briefOverride field-by-field (chỉ thay field user explicit truyền,
  // không clobber các field không gửi). User chỉnh tại side panel = "experiment
  // tại thực địa" mà không cần lưu vào DB brief gốc.
  const ov = body.briefOverride ?? {};
  const ctx: Record<string, unknown> = {
    ...ctxRaw,
    ...(typeof ov.approach_md === 'string' ? { approach_md: ov.approach_md } : {}),
    ...(typeof ov.tone === 'string' ? { brief_tone: ov.tone } : {}),
    ...(typeof ov.do_md === 'string' ? { do_md: ov.do_md } : {}),
    ...(typeof ov.dont_md === 'string' ? { dont_md: ov.dont_md } : {}),
    ...(typeof ov.narrative_md === 'string' ? { narrative_md: ov.narrative_md } : {}),
  };
  const briefOverridden = Object.values(ov).some((v) => typeof v === 'string');
  const persona = (ctx.persona as Record<string, unknown> | null) ?? {};
  const phase = (ctx.current_phase ?? 'warm-up') as Phase;
  const habitatLang = String(ctx.habitat_lang ?? 'en');
  const voiceProfile = String(ctx.habitat_voice ?? 'regular');
  const dominantTopics = Array.isArray(ctx.dominant_topics) ? (ctx.dominant_topics as string[]) : [];
  const forbiddenTopics = Array.isArray(ctx.forbidden_topics) ? (ctx.forbidden_topics as string[]) : [];

  // 2. Tạo card + fill parent_*
  const create = await createPostForBriefPhase(projectId, briefId, phase, contentType);
  if (!create.ok || !create.id) {
    return NextResponse.json({ ok: false, error: create.error ?? 'createPost failed' }, { status: 500 });
  }
  const cardId = create.id;

  await updatePost(projectId, cardId, {
    parentUrl: body.parentUrl ?? null,
    parentTitle: body.parentTitle ?? null,
    parentBody: body.parentBody ?? null,
    parentAuthor: body.parentAuthor ?? null,
  });

  // 3. Build Astrolas payload — gửi đầy đủ context (tone + voice + brief + persona)
  // Map MOS2 voice_profile → tone_target enum của Astrolas:
  //   'expert' / 'regular' / 'casual' / 'mystic' / 'shitposter' / 'edgelord' / 'lurker' / 'hype'
  // Hiện MOS2 voice profile khớp 1:1 → pass thẳng.
  const tonePart = String(ctx.brief_tone ?? '').trim();
  // Topics: prefer client hint > dominantTopics từ habitat
  const topics = (body.topicsHint && body.topicsHint.length > 0)
    ? body.topicsHint.slice(0, 10)
    : dominantTopics.slice(0, 5);

  // Note operator: append brief approach / persona hint vào question_body để
  // Astrolas Reasoning Engine có context đầy đủ. Tránh để Astrolas trả answer
  // generic mà không apply brief.
  // Format: language enforce block ĐẦU + original question + operator hint section.
  // BUG cũ: brief context (approach/do/dont/persona) viết tiếng Việt nên
  // Astrolas hay drift sang VN dù question_lang='en' — operator phải shout
  // language strictly trong question_body để engine obey.
  const LANG_NAMES: Record<string, string> = {
    en: 'English', vi: 'Vietnamese (Tiếng Việt)', es: 'Spanish', fr: 'French',
    de: 'German', pt: 'Portuguese', it: 'Italian', zh: 'Chinese', ja: 'Japanese',
    ko: 'Korean', ru: 'Russian', id: 'Indonesian', th: 'Thai',
  };
  const langName = LANG_NAMES[habitatLang] || habitatLang.toUpperCase();
  const customPromptClean = (body.customPrompt ?? '').trim().slice(0, 1500);
  const questionBodyEnriched = [
    `[STRICT OUTPUT LANGUAGE: ${langName} (${habitatLang}) — MUST reply ENTIRELY in ${langName}. Brief context below may be in Vietnamese (operator notes) but YOUR ANSWER must be ${langName}. DO NOT mix languages.]`,
    '',
    body.parentBody,
    '',
    '---',
    '[OPERATOR CONTEXT — KHÔNG phải nội dung user hỏi, chỉ là instruction cho engine. Reply language vẫn phải là ' + langName + ']',
    persona.voice_summary ? `Persona voice: ${persona.voice_summary}` : null,
    persona.narrative_style ? `Persona narrative: ${persona.narrative_style}` : null,
    persona.backstory ? `Persona backstory: ${String(persona.backstory).slice(0, 300)}` : null,
    ctx.approach_md ? `Brief approach (${phase}):\n${String(ctx.approach_md).slice(0, 800)}` : null,
    tonePart ? `Brief tone: ${tonePart}` : null,
    ctx.do_md ? `DO:\n${String(ctx.do_md).slice(0, 500)}` : null,
    ctx.dont_md ? `DON'T:\n${String(ctx.dont_md).slice(0, 500)}` : null,
    forbiddenTopics.length > 0 ? `FORBIDDEN TOPICS: ${forbiddenTopics.join(', ')}` : null,
    customPromptClean ? `\n[OPERATOR INSTRUCTION — ưu tiên cao, áp dụng cho answer này]\n${customPromptClean}` : null,
    '',
    `[FINAL REMINDER: Output must be in ${langName} only. Output language: ${habitatLang}.]`,
  ].filter(Boolean).join('\n');

  const astrolasPayload = {
    question_title: body.parentTitle.slice(0, 500),
    question_body: questionBodyEnriched.slice(0, 10000),
    question_lang: habitatLang || 'en',
    platform: 'reddit' as const,
    subreddit: undefined as string | undefined,
    tone_target: voiceProfile,
    max_length: body.maxLength ?? 2000,
    topics_hint: topics,
    request_id: `mos2-card-${cardId}`,
    // Optional Astrolas llm_config override (Claude Opus / Sonnet / Haiku /
    // OpenAI mini variants). null/missing → Astrolas skill default.
    ...(body.llmConfig ? { llm_config: body.llmConfig } : {}),
  };

  // 4. Call Astrolas
  let astrolasRes: Response;
  try {
    astrolasRes = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/v1/qa/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(astrolasPayload),
      signal: AbortSignal.timeout(120000),  // 120s — Astrolas reasoning có thể chạy 60-90s + buffer
    });
  } catch (e) {
    return NextResponse.json({
      ok: false, cardId,
      error: `Astrolas API timeout/network: ${(e as Error).message}`,
    }, { status: 200 });
  }

  if (!astrolasRes.ok) {
    const errText = await astrolasRes.text().catch(() => '');
    return NextResponse.json({
      ok: false, cardId,
      error: `Astrolas API ${astrolasRes.status}: ${errText.slice(0, 300)}`,
    }, { status: 200 });
  }

  const data = await astrolasRes.json() as {
    ok: boolean;
    answer_md?: string;
    answer_lang?: string;
    sources?: Array<{ title: string; url: string; snippet?: string; type?: string }>;
    voice_signals?: { confidence?: number; data_backed?: boolean; model_used?: string; tools_called?: string[]; warnings?: string[] };
    cost_estimate_usd?: number;
    duration_ms?: number;
    log_id?: string;
    error?: string;
  };

  if (!data.ok || !data.answer_md) {
    return NextResponse.json({
      ok: false, cardId,
      error: data.error ?? 'Astrolas trả empty answer',
    }, { status: 200 });
  }

  // 5. Save answer + sources + meta vào card
  await db.update(cards).set({
    bodyTarget: data.answer_md,
    bodyReview: '',         // Astrolas trả 1 language; nếu cần VN review, dịch sau
    answerSource: 'astrolas',
    answerSources: data.sources ?? [],
    genCostUsd: data.cost_estimate_usd != null ? String(data.cost_estimate_usd) : null,
    genDurationMs: data.duration_ms ?? null,
    genModelUsed: data.voice_signals?.model_used ?? 'astrolas',
    genConfidence: data.voice_signals?.confidence != null ? String(data.voice_signals.confidence) : null,
    genToolsCalled: data.voice_signals?.tools_called ?? [],
    genWarnings: data.voice_signals?.warnings ?? [],
    genLogId: data.log_id ?? null,
    updatedAt: new Date(),
  }).where(eq(cards.id, cardId));

  return NextResponse.json({
    ok: true,
    cardId,
    cardRef: create.cardRef,
    bodyTarget: data.answer_md,
    bodyReview: '',
    targetLang: data.answer_lang ?? habitatLang,
    sources: data.sources ?? [],
    voiceSignals: data.voice_signals ?? {},
    costUsd: data.cost_estimate_usd ?? 0,
    durationMs: data.duration_ms ?? 0,
    logId: data.log_id,
    contextUsed: {
      accountHandle: ctx.account_handle ? String(ctx.account_handle) : null,
      personaVoiceSummary: persona.voice_summary ? String(persona.voice_summary) : null,
      habitatVoice: voiceProfile,
      habitatLanguage: habitatLang,
      currentPhase: phase,
      briefTone: tonePart,
      topicsSent: topics,
      customPromptApplied: customPromptClean ? customPromptClean.slice(0, 200) : null,
      briefOverridden,
    },
  });
}
