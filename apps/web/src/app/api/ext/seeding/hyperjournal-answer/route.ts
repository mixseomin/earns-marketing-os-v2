import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { createPostForBriefPhase, updatePost } from '@/lib/actions/brief-posts';
import { generateFullDraft } from '@/lib/ai/post-draft';
import { normalizeParentUrl } from '@/lib/parent-url';
import { resolveForumChannelId } from '@/lib/actions/forum-channel';
import type { Phase } from '@/lib/phase-plan';
import { extractWallet, fetchGrade, buildGradeInstruction, type GradeFacts } from '@/lib/ai/hyperjournal-facts';
import { firstRow, errorResponse } from '@/lib/ext-route';

// POST /api/ext/seeding/hyperjournal-answer
// Same body contract as /quick-comment. HyperJournal data-backed: detect the
// wallet the post is about, pull its behavior grade from hljournal.xyz, and
// ground the LLM on those facts + force the teardown link. answer_source='hyperjournal'.
// Returns { ok:false, noWallet:true } if no full 0x address is present.

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
    lang?: string;
    customPrompt?: string;
    briefOverride?: { approach_md?: string; tone?: string; do_md?: string; dont_md?: string; narrative_md?: string };
    humanizer?: { knobs?: string[]; intensity?: 'light' | 'medium' | 'heavy' };
    channelUrl?: string;
    channelName?: string;
  };

  const habitatId = Number(body.habitatId ?? 0);
  const projectId = String(body.projectId ?? '');
  const ALLOWED_CT = ['comment', 'reply', 'post', 'thread', 'text'] as const;
  const contentType = (ALLOWED_CT as readonly string[]).includes(body.contentType ?? '')
    ? (body.contentType as string) : 'reply';
  if (!habitatId || !projectId) {
    return errorResponse('habitatId + projectId required', 400);
  }

  // Gate: need a full wallet address in the post to ground the reply.
  const wallet = extractWallet(body.parentBody);
  if (!wallet) {
    return errorResponse('Không phát hiện ví (0x...) đầy đủ trong bài đang reply. Dùng ✨ Gen reply thường, hoặc mở bài có địa chỉ ví đầy đủ.', 200, { noWallet: true });
  }
  // Facts from HL (fallback to minimal ungraded if the service is unreachable).
  const facts: GradeFacts = (await fetchGrade(wallet)) ?? { graded: false, addr: wallet, url: `https://hljournal.xyz/w/${wallet}` };

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // Resolve briefId (latest brief of habitat if not passed)
  let briefId = body.briefId ?? null;
  if (!briefId) {
    const rows = await db.execute(sql`
      SELECT id FROM community_briefs WHERE habitat_id = ${habitatId} AND project_id = ${projectId}
      ORDER BY updated_at DESC LIMIT 1
    `);
    const r = firstRow(rows);
    briefId = r ? Number(r.id) : null;
  }
  if (!briefId) {
    return errorResponse('Habitat chưa có brief nào trong project. Vào MOS2 tạo brief trước.', 400);
  }

  const briefRows = await db.execute(sql`SELECT current_phase FROM community_briefs WHERE id = ${briefId} LIMIT 1`);
  const phase = firstRow(briefRows)?.current_phase as Phase | undefined;
  const useFallbackPhase: Phase = (phase ?? 'warm-up') as Phase;

  // 1. Create card
  const channelDbId = await resolveForumChannelId(db, habitatId, body.channelUrl, body.channelName);
  const create = await createPostForBriefPhase(projectId, briefId, useFallbackPhase, contentType, undefined, channelDbId);
  if (!create.ok || !create.id) {
    return errorResponse(create.error ?? 'createPost failed', 500);
  }
  const cardId = create.id;

  // 2. Fill parent_* fields
  await updatePost(projectId, cardId, {
    parentUrl: normalizeParentUrl(body.parentUrl),
    parentTitle: body.parentTitle ?? null,
    parentBody: body.parentBody ?? null,
    parentAuthor: body.parentAuthor ?? null,
  });

  // 3. AI gen draft grounded on the wallet facts (facts go in as customInstruction;
  //    the post still provides context via parent_body).
  const instruction = buildGradeInstruction(facts, body.customPrompt);
  const genStart = Date.now();
  const draft = await generateFullDraft(cardId, {
    modelId: body.modelId || 'gpt-4.1-mini',
    customInstruction: instruction,
    lang: body.lang,
    briefOverride: body.briefOverride,
    humanizer: body.humanizer && Array.isArray(body.humanizer.knobs) && body.humanizer.knobs.length > 0
      ? { knobs: body.humanizer.knobs, intensity: body.humanizer.intensity }
      : undefined,
  });
  const genDurationMs = Date.now() - genStart;

  // 4. Mark as data-backed (answer_source) + record the grade page as a source.
  const draftCost = (draft && typeof (draft as { costUsd?: number }).costUsd === 'number') ? (draft as { costUsd?: number }).costUsd : null;
  const model = (draft as { modelUsed?: string }).modelUsed || body.modelId || 'gpt-4.1-mini';
  const sources = [{ title: facts.graded ? `HyperJournal grade ${facts.grade}` : 'HyperJournal teardown', url: facts.url, type: 'grade' }];
  await db.execute(sql`
    UPDATE cards SET answer_source = 'hyperjournal', answer_sources = ${JSON.stringify(sources)}::jsonb,
      gen_model_used = ${model}, gen_duration_ms = ${genDurationMs},
      gen_cost_usd = ${draftCost != null ? String(draftCost) : null}, updated_at = now()
    WHERE id = ${cardId}
  `);

  // 5. Read final card
  const finalRows = await db.execute(sql`
    SELECT c.body_target, c.body_review, c.title, c.target_lang,
      b.tone AS brief_tone, b.current_phase, h.voice_profile AS habitat_voice, h.language AS habitat_lang,
      pa.handle AS account_handle, pa.persona
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE c.id = ${cardId} LIMIT 1
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
    answerSource: 'hyperjournal',
    wallet,
    walletGraded: !!facts.graded,
    grade: facts.graded ? facts.grade : null,
    url: facts.url,
    sources,
    contextUsed: {
      accountHandle: f.account_handle ? String(f.account_handle) : null,
      personaName: persona.name_first ? String(persona.name_first) + (persona.name_last ? ' ' + String(persona.name_last) : '') : null,
      habitatVoice: String(f.habitat_voice ?? 'regular'),
      currentPhase: String(f.current_phase ?? ''),
      briefTone: String(f.brief_tone ?? ''),
      walletGrade: facts.graded ? `${facts.grade} (${facts.score}/100)` : 'chưa graded',
    },
    draftOk: draft.ok,
    draftError: draft.error,
  });
}
