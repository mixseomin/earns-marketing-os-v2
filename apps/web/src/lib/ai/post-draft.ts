'use server';

// AI actions cho post drafting bilingual:
// - generateFullDraft: dùng reasoning model (o3-mini) viết bản đầy đủ
//   cho cả 2 ngôn ngữ (review VN + target lang) từ full brief context.
// - critiquePost: review bản nháp - flag risks vs community rules,
//   propose fix. Reasoning model.
// - translateBetween: 1-chiều translate VN↔target khi user sửa 1 bên.
//   Dùng cheap model (gpt-4o-mini).

import { eq, sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL, REASONING_MODEL, aiEnabled } from './openai';
import { isValidTextModel } from './model-options';
import { PHASE_LABEL, type Phase } from '@/lib/phase-plan';
import { buildHumanizerBlock, clampDraftLength, injectTypos, maxSentencesFor, type HumanizerOpts } from './humanizer';
import {
  resolveVoiceProfile, voicePromptBlock, voiceLengthHint, fewShotPromptBlock,
  type FewShotExample, type VoiceProfile,
} from './voice-profile';

function ensureClient() {
  if (!aiEnabled()) throw new Error('OPENAI_API_KEY not configured');
  const c = getOpenAI();
  if (!c) throw new Error('OpenAI client unavailable');
  return c;
}

// ── Context loader ─────────────────────────────────────────────────

interface PostContext {
  cardId: number;
  projectId: string;
  targetLang: string;
  isBilingual: boolean;          // target_lang !== 'vi'
  habitatId: number;
  habitatName: string;
  habitatKind: string;
  habitatLanguage: string;
  habitatPostingRules: string;
  habitatForbiddenTopics: string[];
  habitatDominantTopics: string[];
  habitatModStrictness: string;
  habitatMinAccountAgeDays: number;
  habitatMinKarma: number;
  habitatLinksAllowedAfter: string;
  // Voice/style — habitat-level (channel có thể override)
  habitatVoiceProfile: string;
  habitatVoiceNotes: string;
  habitatFewShot: FewShotExample[] | null;
  habitatVisualStyle: string | null;        // for image gen
  habitatAiDetection: boolean;              // habitat dùng AI-content detector → human voice mạnh hơn
  habitatAiDetectionNote: string;           // optional thêm rule cụ thể từ user
  // Channel (sub-channel của Discord/Slack/Telegram). NULL = habitat-level post.
  channelId: number | null;
  channelName: string | null;
  channelDescription: string;
  channelRules: string;
  channelVoiceOverride: string | null;
  channelFewShot: FewShotExample[] | null;
  // Tribe lexicon/avoid aggregated từ tất cả habitat_tribes của habitat này.
  // lexicon = "use these phrases" (native vocabulary).
  // avoid   = "outsider tells" (red-flag phrases).
  tribeLexicon: string[];
  tribeAvoid: string[];
  tribePsychographic: string[];
  // Content Pillar — macro positioning. Resolution: card.pillar > brief.primary_pillar.
  // NULL pillar → cards cũ (legacy) hoặc chưa setup CPS → bỏ qua block.
  pillarId: number | null;
  pillarName: string;
  pillarTagline: string;
  pillarPositioningMd: string;
  pillarKeyMessages: string[];
  pillarForbiddenMsgs: string[];
  pillarLanguages: string[];           // ['en','vi'] — warn nếu target_lang không trong list
  pillarVoiceProfile: string;
  pillarVoiceNotes: string;
  pillarExemplars: Array<{ title?: string; body: string; whyItWorks?: string }> | null;
  accountHandle: string | null;
  platformLabel: string;
  personaVoiceSummary: string;
  personaNarrativeStyle: string;
  personaBackstory: string;
  personaName: string;
  personaGender: string;
  personaLocation: string;
  personaInterests: string[];
  briefApproachMd: string;
  briefNarrativeMd: string;
  briefTone: string;
  briefDoMd: string;
  briefDontMd: string;
  phase: Phase | null;
  phaseGoal: string;
  phaseTone: string;
  phaseDoMd: string;
  phaseDontMd: string;
  phaseHooks: string[];
  phaseCadence: string;
  cardTitle: string;
  cardBodyReview: string;
  cardBodyTarget: string;
  // Interaction context (comment/reply): content_type + parent_url + nội dung
  // thread/post gốc để AI gen reply CÓ context thay vì reply chung chung.
  contentType: string;
  parentUrl: string | null;
  parentTitle: string | null;
  parentBody: string | null;
  parentAuthor: string | null;
  parentSnippets: Array<{ author?: string; text: string }>;
  // RESOLVED voice profile (channel override ?? habitat ?? 'regular')
  effectiveVoiceProfile: VoiceProfile;
}

async function loadPostContext(cardId: number): Promise<PostContext | { error: string }> {
  const db = getDb();
  if (!db) return { error: 'DATABASE_URL not configured' };

  const rows = await db.execute(sql`
    SELECT
      c.id AS card_id, c.project_id, c.title, c.body_review, c.body_target,
      c.target_lang, c.brief_id, c.brief_phase, c.channel_id,
      c.content_type, c.parent_url, c.parent_title, c.parent_body, c.parent_author, c.parent_snippets,
      c.pillar_id AS card_pillar_id,
      b.approach_md, b.narrative_md, b.tone, b.do_md, b.dont_md, b.phase_plan,
      b.primary_pillar_id AS brief_primary_pillar_id,
      h.id   AS habitat_id,
      h.name AS habitat_name, h.kind AS habitat_kind, h.language AS habitat_lang,
      h.ai_content_detection AS habitat_ai_detection, h.ai_detection_note AS habitat_ai_detection_note,
      h.posting_rules, h.forbidden_topics, h.dominant_topics,
      h.mod_strictness, h.min_account_age_days, h.min_karma, h.links_allowed_after,
      h.voice_profile, h.voice_notes, h.few_shot_examples, h.visual_style_descriptor,
      hc.name AS channel_name, hc.description AS channel_description,
      hc.rules AS channel_rules,
      hc.voice_profile_override AS channel_voice_override,
      hc.few_shot_examples AS channel_few_shot,
      -- Pillar resolved (COALESCE card override → brief default).
      cp.id AS pillar_id_resolved, cp.name AS pillar_name, cp.tagline AS pillar_tagline,
      cp.positioning_md AS pillar_positioning_md,
      cp.key_messages AS pillar_key_messages,
      cp.forbidden_msgs AS pillar_forbidden_msgs,
      cp.languages AS pillar_languages,
      cp.voice_profile AS pillar_voice_profile,
      cp.voice_notes AS pillar_voice_notes,
      cp.exemplars AS pillar_exemplars,
      pa.handle AS account_handle, pa.persona,
      p.label AS platform_label
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN habitat_channels hc ON hc.id = c.channel_id
    LEFT JOIN content_pillars cp ON cp.id = COALESCE(c.pillar_id, b.primary_pillar_id)
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    LEFT JOIN platforms p ON p.key = pa.platform_key
    WHERE c.id = ${cardId}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { error: 'card not found' };

  const persona = (r.persona as Record<string, unknown> | null) ?? {};
  const phase = r.brief_phase ? (String(r.brief_phase) as Phase) : null;
  const plan = (r.phase_plan as Array<Record<string, unknown>> | null) ?? [];
  const phaseEntry = plan.find((p) => p.phase === phase) as
    | { goal?: string; tone?: string; doMd?: string; dontMd?: string; hooks?: string[]; cadence?: string }
    | undefined;
  const targetLang = String(r.target_lang ?? 'en');
  const habitatId = Number(r.habitat_id ?? 0);

  // Aggregate tribe lexicon/avoid/psychographic từ ALL habitat_tribes của habitat.
  // (M2M: 1 habitat có thể assigned cho nhiều tribe — gộp lại để có vocab đầy đủ.)
  let tribeLexicon: string[] = [];
  let tribeAvoid: string[] = [];
  let tribePsychographic: string[] = [];
  if (habitatId > 0) {
    const tribeRows = await db.execute(sql`
      SELECT t.lexicon, t.avoid, t.psychographic
        FROM habitat_tribes ht
        JOIN tribes t ON t.id = ht.tribe_id
       WHERE ht.habitat_id = ${habitatId}
    `);
    for (const tr of tribeRows as unknown as Array<Record<string, unknown>>) {
      if (Array.isArray(tr.lexicon)) tribeLexicon.push(...(tr.lexicon as string[]));
      if (Array.isArray(tr.avoid)) tribeAvoid.push(...(tr.avoid as string[]));
      if (tr.psychographic) tribePsychographic.push(String(tr.psychographic));
    }
    // Dedupe (case-insensitive) + cap để prompt khỏi dài
    const seen = new Set<string>();
    tribeLexicon = tribeLexicon
      .filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 40);
    const seenA = new Set<string>();
    tribeAvoid = tribeAvoid
      .filter((s) => { const k = s.toLowerCase(); if (seenA.has(k)) return false; seenA.add(k); return true; })
      .slice(0, 30);
  }

  const habitatVoiceProfile = String(r.voice_profile ?? 'regular');
  const channelVoiceOverride = r.channel_voice_override ? String(r.channel_voice_override) : null;
  const pillarVoiceProfile = r.pillar_voice_profile ? String(r.pillar_voice_profile) : '';
  // Resolution order: channel override > pillar > habitat > 'regular'.
  // Pillar đứng giữa vì là project-level positioning, override habitat-default
  // (vd habitat=regular nhưng pillar='Educational depth'=expert → bài dùng expert).
  const effectiveVoiceProfile = resolveVoiceProfile(
    pillarVoiceProfile || habitatVoiceProfile,
    channelVoiceOverride,
  );

  return {
    cardId: Number(r.card_id),
    projectId: String(r.project_id),
    targetLang,
    isBilingual: targetLang !== 'vi',
    habitatId,
    habitatName: String(r.habitat_name ?? ''),
    habitatKind: String(r.habitat_kind ?? ''),
    habitatLanguage: String(r.habitat_lang ?? targetLang),
    habitatPostingRules: String(r.posting_rules ?? ''),
    habitatForbiddenTopics: (r.forbidden_topics as string[]) ?? [],
    habitatDominantTopics: (r.dominant_topics as string[]) ?? [],
    habitatModStrictness: String(r.mod_strictness ?? ''),
    habitatMinAccountAgeDays: Number(r.min_account_age_days ?? 0),
    habitatMinKarma: Number(r.min_karma ?? 0),
    habitatLinksAllowedAfter: String(r.links_allowed_after ?? ''),
    habitatVoiceProfile,
    habitatVoiceNotes: String(r.voice_notes ?? ''),
    habitatFewShot: Array.isArray(r.few_shot_examples) ? (r.few_shot_examples as FewShotExample[]) : null,
    habitatVisualStyle: r.visual_style_descriptor ? String(r.visual_style_descriptor) : null,
    habitatAiDetection: !!r.habitat_ai_detection,
    habitatAiDetectionNote: String(r.habitat_ai_detection_note ?? ''),
    channelId: r.channel_id ? Number(r.channel_id) : null,
    channelName: r.channel_name ? String(r.channel_name) : null,
    channelDescription: String(r.channel_description ?? ''),
    channelRules: String(r.channel_rules ?? ''),
    channelVoiceOverride,
    channelFewShot: Array.isArray(r.channel_few_shot) ? (r.channel_few_shot as FewShotExample[]) : null,
    tribeLexicon,
    tribeAvoid,
    tribePsychographic,
    pillarId: r.pillar_id_resolved ? Number(r.pillar_id_resolved) : null,
    pillarName: String(r.pillar_name ?? ''),
    pillarTagline: String(r.pillar_tagline ?? ''),
    pillarPositioningMd: String(r.pillar_positioning_md ?? ''),
    pillarKeyMessages: Array.isArray(r.pillar_key_messages) ? (r.pillar_key_messages as string[]) : [],
    pillarForbiddenMsgs: Array.isArray(r.pillar_forbidden_msgs) ? (r.pillar_forbidden_msgs as string[]) : [],
    pillarLanguages: Array.isArray(r.pillar_languages) ? (r.pillar_languages as string[]) : [],
    pillarVoiceProfile,
    pillarVoiceNotes: String(r.pillar_voice_notes ?? ''),
    pillarExemplars: (() => {
      const ex = r.pillar_exemplars;
      if (!Array.isArray(ex)) return null;
      // Map pillar exemplars (PillarExemplar shape) sang FewShotExample.
      return (ex as Array<{ title?: string; whyItWorks?: string }>)
        .filter((e) => e.whyItWorks || e.title)
        .map((e) => ({ title: e.title, body: e.whyItWorks ?? '', whyItWorks: e.whyItWorks }));
    })(),
    accountHandle: r.account_handle ? String(r.account_handle) : null,
    platformLabel: String(r.platform_label ?? ''),
    personaVoiceSummary: typeof persona.voice_summary === 'string' ? persona.voice_summary : '',
    personaNarrativeStyle: typeof persona.narrative_style === 'string' ? persona.narrative_style : '',
    personaBackstory: typeof persona.backstory === 'string' ? persona.backstory : '',
    personaName: [persona.name_first, persona.name_last].filter((x) => typeof x === 'string' && x).join(' '),
    personaGender: typeof persona.gender === 'string' ? persona.gender : '',
    personaLocation: [persona.city, persona.country].filter((x) => typeof x === 'string' && x).join(', '),
    personaInterests: Array.isArray(persona.interests) ? (persona.interests as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    briefApproachMd: String(r.approach_md ?? ''),
    briefNarrativeMd: String(r.narrative_md ?? ''),
    briefTone: String(r.tone ?? ''),
    briefDoMd: String(r.do_md ?? ''),
    briefDontMd: String(r.dont_md ?? ''),
    phase,
    phaseGoal: String(phaseEntry?.goal ?? ''),
    phaseTone: String(phaseEntry?.tone ?? ''),
    phaseDoMd: String(phaseEntry?.doMd ?? ''),
    phaseDontMd: String(phaseEntry?.dontMd ?? ''),
    phaseHooks: phaseEntry?.hooks ?? [],
    phaseCadence: String(phaseEntry?.cadence ?? ''),
    cardTitle: String(r.title ?? ''),
    cardBodyReview: String(r.body_review ?? ''),
    cardBodyTarget: String(r.body_target ?? ''),
    contentType: String(r.content_type ?? 'text'),
    parentUrl: r.parent_url ? String(r.parent_url) : null,
    parentTitle: r.parent_title ? String(r.parent_title) : null,
    parentBody: r.parent_body ? String(r.parent_body) : null,
    parentAuthor: r.parent_author ? String(r.parent_author) : null,
    parentSnippets: Array.isArray(r.parent_snippets)
      ? (r.parent_snippets as Array<{ author?: string; text: string }>)
      : [],
    effectiveVoiceProfile,
  };
}

// Nhận diện ngôn ngữ thô từ script (để reply BẰNG ngôn ngữ parent). Trả ISO code hoặc null.
function detectScriptLang(text: string): string | null {
  const s = text || '';
  if (/[一-鿿]/.test(s)) return 'zh';
  if (/[぀-ヿ]/.test(s)) return 'ja';
  if (/[가-힯]/.test(s)) return 'ko';
  if (/[Ѐ-ӿ]/.test(s)) return 'ru';
  if (/[؀-ۿ]/.test(s)) return 'ar';
  if (/[฀-๿]/.test(s)) return 'th';
  if (/[֐-׿]/.test(s)) return 'he';
  if (/[ăâđêôơưĂÂĐÊÔƠƯàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗùúụủũừứựửữỳýỵỷỹ]/.test(s)) return 'vi';
  return null;   // Latin/English/unknown → KHÔNG override
}

function buildDraftPrompt(ctx: PostContext, hookChoice: string | null, customInstruction?: string, humanizer?: HumanizerOpts, langPref?: string): string {
  // Ngôn ngữ bodyTarget — override targetLang TỪ GỐC (output-format bên dưới ép theo
  // targetLang). Ưu tiên: (1) explicit code (zh/en/vi…) · (2) 'community' = giữ ngôn ngữ
  // habitat · (3) 'auto'/trống = detect ngôn ngữ COMMENT đang reply → fallback habitat.
  const isReplyType = ctx.contentType === 'comment' || ctx.contentType === 'reply';
  const pref = (langPref || 'auto').toLowerCase();
  let effLang = ctx.targetLang;
  if (pref && pref !== 'auto' && pref !== 'community') {
    effLang = pref;
  } else if (pref !== 'community') {   // auto
    const parentLang = isReplyType && ctx.parentBody ? detectScriptLang(ctx.parentBody) : null;
    if (parentLang) effLang = parentLang;
  }
  if (effLang !== ctx.targetLang) ctx = { ...ctx, targetLang: effLang, isBilingual: effLang !== 'vi' };
  const humanizerBlock = buildHumanizerBlock(humanizer, ctx.targetLang);
  // Chip 1-câu/2-3-câu = giới hạn câu cứng → tắt các hint độ dài mâu thuẫn bên dưới
  // (reply rule "1-4 câu", voice/platform length) để model tuân thủ trong 1 call.
  const hardLen = maxSentencesFor(humanizer);
  const hardLenText = hardLen === 1 ? 'ĐÚNG 1 câu, ≤ 30 từ (rule CỨNG, không hơn)'
    : hardLen === 3 ? 'tối đa 3 câu ngắn, ≤ 60 từ (rule CỨNG)' : '';
  // Voice block (per-profile prompt với length/emoji/hook/forbidden rules).
  // Resolution: channel override > pillar > habitat > 'regular'. Notes gộp
  // habitat + pillar nếu cả 2 có để AI nhận đủ context.
  const voiceNotesCombined = [
    ctx.pillarVoiceNotes && `[Pillar voice]: ${ctx.pillarVoiceNotes}`,
    ctx.habitatVoiceNotes && `[Habitat voice]: ${ctx.habitatVoiceNotes}`,
  ].filter(Boolean).join('\n');
  const voiceBlock = voicePromptBlock(ctx.effectiveVoiceProfile, voiceNotesCombined);
  const lengthHint = voiceLengthHint(ctx.effectiveVoiceProfile);
  // Few-shot priority: channel > habitat > pillar. Pillar exemplars = chiến
  // lược (cross-community), habitat = specific (community), channel = sub-specific.
  const fewShotBlock = fewShotPromptBlock(
    ctx.habitatFewShot ?? ctx.pillarExemplars,
    ctx.channelFewShot,
  );

  // Language mismatch warning — inject vào prompt để AI tự ý thức
  const langWarning = ctx.pillarLanguages.length > 0
    && !ctx.pillarLanguages.includes(ctx.targetLang)
    ? `\n⚠ LANGUAGE MISMATCH: Pillar "${ctx.pillarName}" chỉ hỗ trợ [${ctx.pillarLanguages.join(', ')}] nhưng bài đang target ${ctx.targetLang}. Cân nhắc rewrite cho audience phù hợp thay vì dịch máy.\n`
    : '';

  return [
    `BỐI CẢNH POST:`,
    `  Platform: ${ctx.platformLabel}`,
    `  Community: ${ctx.habitatName} (${ctx.habitatKind}, ngôn ngữ chính: ${ctx.habitatLanguage})`,
    ctx.channelName ? `  Channel: #${ctx.channelName}${ctx.channelDescription ? ` — ${ctx.channelDescription}` : ''}` : null,
    `  Account/Persona: @${ctx.accountHandle ?? '?'}` + (ctx.personaName ? ` (${ctx.personaName}${ctx.personaGender ? ', ' + ctx.personaGender : ''}${ctx.personaLocation ? ', ' + ctx.personaLocation : ''})` : ''),
    `  Content type: ${ctx.contentType}`,
    ctx.personaVoiceSummary ? `  Persona voice (GIỌNG/TONE — viết ĐÚNG giọng này): ${ctx.personaVoiceSummary}` : null,
    ctx.personaNarrativeStyle ? `  Narrative style: ${ctx.personaNarrativeStyle}` : null,
    ctx.personaInterests.length ? `  Quan tâm/chuyên môn (bám góc nhìn này): ${ctx.personaInterests.join(', ')}` : null,
    ctx.personaBackstory ? `  Backstory: ${ctx.personaBackstory}` : null,
    '',
    // INTERACTION CONTEXT — khi content_type là comment/reply, bài này không
    // phải standalone post mà là reply vào 1 thread/post HIỆN CÓ. Prompt
    // phải nói rõ để AI gen reply phù hợp (không mở bài lại từ đầu, không
    // tự giới thiệu, bám vào câu hỏi/discussion gốc).
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') ? '' : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply')
      ? `# INTERACTION MODE — ${ctx.contentType === 'comment' ? 'COMMENT REPLY' : 'POST REPLY'}`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply')
      ? `Bài này KHÔNG phải standalone post — là REPLY vào thread/post HIỆN CÓ.`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') && ctx.parentUrl
      ? `Parent URL (thread/post gốc): ${ctx.parentUrl}`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') && ctx.parentAuthor
      ? `Parent author (người user reply tới): ${ctx.parentAuthor}`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') && ctx.parentTitle
      ? `Parent title:\n  "${ctx.parentTitle}"`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') && ctx.parentBody
      ? `Parent body (đọc kỹ để biết câu hỏi/topic gốc, REPLY của bạn PHẢI bám vào đây):\n${ctx.parentBody.slice(0, 3000).split('\n').map((l) => `  > ${l}`).join('\n')}`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') && ctx.parentSnippets.length > 0
      ? `Top comments / quotes (context discussion):\n${ctx.parentSnippets.slice(0, 3).map((s) => `  • ${s.author ? `[${s.author}] ` : ''}${s.text.slice(0, 300)}`).join('\n')}`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') && !ctx.parentBody
      ? `⚠ Parent body chưa được set — gen reply chung chung dựa vào hint từ title (nếu có) + brief. KHÔNG bám sâu được vì không có nội dung gốc.`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply')
      ? `Quy tắc reply:
  - 🈯 NGÔN NGỮ (ƯU TIÊN CAO NHẤT): nếu CÓ parent body → viết bodyTarget BẰNG CHÍNH NGÔN NGỮ của parent (reply ai thì dùng ngôn ngữ của họ). Parent tiếng Trung → reply tiếng Trung; tiếng Anh → tiếng Anh; tiếng Việt → tiếng Việt. TUYỆT ĐỐI KHÔNG dịch sang ngôn ngữ khác / trộn ngôn ngữ. (bodyReview vẫn tiếng Việt cho operator.) Parent trống → dùng ngôn ngữ chính của community.
  - 🎯 Bám SÁT luận điểm/câu hỏi chính của parent — phản hồi trực tiếp ý đó, KHÔNG generic / lạc đề.
  - KHÔNG mở bài lại bằng greeting / "Hello" / "Tôi là..." — nhảy thẳng vào câu trả lời
  - Bám vào nội dung thread/post gốc (giả định reader đã đọc parent)
  - ${hardLenText ? `ĐỘ DÀI: ${hardLenText}` : 'Ngắn gọn (1-4 câu cho comment, 3-8 câu cho reply Q&A)'}
  - Nếu là reply câu hỏi: trả lời trực tiếp + 1 insight có giá trị + (optional) câu hỏi mở rộng
  - Nếu là comment trong thread discussion: đóng góp 1 góc nhìn / kinh nghiệm / nuance
  - KHÔNG link / pitch / self-promo trừ khi phase=Seed/Direct VÀ rules cho phép`
      : null,
    (ctx.contentType === 'comment' || ctx.contentType === 'reply') ? '' : null,
    // CONTENT PILLAR section — macro positioning. Đặt SAU bối cảnh nhưng TRƯỚC
    // voice profile để AI hiểu "tại sao bài này tồn tại trong toàn project"
    // trước khi áp dụng voice mechanics.
    ctx.pillarId != null ? `# CONTENT PILLAR: ${ctx.pillarName}` : null,
    ctx.pillarTagline ? `Tagline: "${ctx.pillarTagline}"` : null,
    ctx.pillarPositioningMd ? `\nPositioning:\n${ctx.pillarPositioningMd.slice(0, 600)}` : null,
    ctx.pillarKeyMessages.length > 0 ? `\nKEY MESSAGES (PHẢI phản ánh ít nhất 1 trong số này trong bài):
${ctx.pillarKeyMessages.map((m) => `  • ${m}`).join('\n')}` : null,
    ctx.pillarForbiddenMsgs.length > 0 ? `\n🚫 POSITIONING GUARDRAILS (TUYỆT ĐỐI KHÔNG nói/ngụ ý những điều này — phá vỡ brand positioning):
${ctx.pillarForbiddenMsgs.map((m) => `  ✗ ${m}`).join('\n')}` : null,
    langWarning || null,
    ctx.pillarId != null ? '' : null,
    voiceBlock,                          // VOICE PROFILE block (full prompt with rules)
    '',
    `PHASE: ${ctx.phase ? PHASE_LABEL[ctx.phase] : '(unknown)'}`,
    ctx.phaseGoal ? `  Mục tiêu phase: ${ctx.phaseGoal}` : null,
    ctx.phaseTone ? `  Giọng phase: ${ctx.phaseTone || ctx.briefTone}` : null,
    ctx.phaseCadence ? `  Tần suất phase: ${ctx.phaseCadence}` : null,
    lengthHint ? `  Length (voice profile override): ${lengthHint}` : null,
    '',
    `BRIEF NARRATIVE (cách kể chuyện cho combo này):`,
    ctx.briefNarrativeMd || '(chưa có)',
    '',
    `BRIEF APPROACH (chiến thuật engagement):`,
    ctx.briefApproachMd || '(chưa có)',
    '',
    `NÊN (do):`,
    ctx.phaseDoMd || ctx.briefDoMd || '(chưa có)',
    '',
    `KHÔNG (dont):`,
    ctx.phaseDontMd || ctx.briefDontMd || '(chưa có)',
    '',
    // TRIBE LEXICON — native vocabulary + outsider tells. Aggregate từ all
    // habitat_tribes của habitat. ⚠ SCOPE: chỉ apply cho bodyTarget (ngôn
    // ngữ thực tế cộng đồng) — bodyReview là VN cho operator review nên
    // KHÔNG dùng English lexicon (tránh code-switching nhìn chối).
    ctx.tribeLexicon.length > 0 ? `# TRIBE LEXICON — NATIVE VOCABULARY (PREFER these phrases trong bodyTarget; KHÔNG dùng trong bodyReview)` : null,
    ctx.tribeLexicon.length > 0 ? ctx.tribeLexicon.map((w) => `  - ${w}`).join('\n') : null,
    ctx.tribeAvoid.length > 0 ? `\n# TRIBE AVOID — OUTSIDER TELLS (NEVER use ở cả bodyReview lẫn bodyTarget):` : null,
    ctx.tribeAvoid.length > 0 ? ctx.tribeAvoid.map((w) => `  - ${w}`).join('\n') : null,
    ctx.tribePsychographic.length > 0 ? `\nTribe psychographic context: ${ctx.tribePsychographic.join(' | ')}` : null,
    '',
    ctx.phaseHooks.length > 0 ? `HOOK PATTERNS có sẵn (chọn 1 hoặc adapt):` : null,
    ...ctx.phaseHooks.map((h) => `  - ${h}`),
    hookChoice ? `HOOK ƯU TIÊN: ${hookChoice}` : null,
    '',
    `# COMMUNITY RULES (HABITAT BASE)`,
    ctx.habitatPostingRules ? `  Posting rules: ${ctx.habitatPostingRules.slice(0, 500)}` : null,
    ctx.habitatModStrictness ? `  Mod strictness: ${ctx.habitatModStrictness}` : null,
    ctx.habitatMinAccountAgeDays > 0 ? `  Min account age: ${ctx.habitatMinAccountAgeDays} ngày` : null,
    ctx.habitatMinKarma > 0 ? `  Min karma: ${ctx.habitatMinKarma}` : null,
    ctx.habitatLinksAllowedAfter ? `  Links allowed: ${ctx.habitatLinksAllowedAfter}` : null,
    ctx.habitatDominantTopics.length > 0 ? `  Topic chính: ${ctx.habitatDominantTopics.join(', ')}` : null,
    ctx.habitatForbiddenTopics.length > 0 ? `  TUYỆT ĐỐI TRÁNH: ${ctx.habitatForbiddenTopics.join(', ')}` : null,
    '',
    // CHANNEL OVERRIDE — đặt sau habitat, marked PRIORITY để model ưu tiên khi conflict.
    ctx.channelName ? `# CHANNEL OVERRIDE — #${ctx.channelName} (PRIORITY: cao hơn habitat khi conflict)` : null,
    ctx.channelDescription ? `  Channel intent: ${ctx.channelDescription}` : null,
    ctx.channelRules ? `  Channel rules:\n${ctx.channelRules.slice(0, 800).split('\n').map((l) => `    ${l}`).join('\n')}` : null,
    '',
    fewShotBlock || null,                // FEW-SHOT EXAMPLES block (optional)
    fewShotBlock ? '' : null,
    // Custom instruction từ operator (vd ext side panel input "🎙 Custom prompt").
    // Priority cao — override default tone/length/style cho lần generate này.
    customInstruction?.trim()
      ? `\n═══════════════════════════════════════════════════════════\n🎙 OPERATOR CUSTOM INSTRUCTION (HIGH PRIORITY — apply on top of everything above):\n  ${customInstruction.trim()}\n═══════════════════════════════════════════════════════════\n`
      : null,
    // 🧬 Human authenticity layer (chip ext) — giả-người cho bodyTarget. HIGH PRIORITY.
    humanizerBlock || null,
    // 🚨 Habitat AI-detection flag — community có mod tool / auto-mod rule
    // detect AI content (vd r/Astrology_Vedic). Phải né strict các pattern AI:
    ctx.habitatAiDetection
      ? `\n═══════════════════════════════════════════════════════════
🚨 ANTI-AI-DETECTION (CRITICAL — habitat này có cơ chế tự detect AI content):

PHẢI:
- Viết như 1 human thật, có quirk: rare typo, em hesitation ("hmm", "honestly", "tbh"), incomplete thought ok
- Câu ngắn xen dài tự nhiên, không uniform length
- Dùng contraction (don't / it's / I've) thay vì "do not / it is / I have"
- Concrete personal anecdote > generic advice (vd "khi tôi sinh con đầu lòng năm 2019..." > "as a parent...")
- Câu kết tự nhiên, không "Hope this helps!" / "Let me know if..."

NÉ TUYỆT ĐỐI:
- Em dash '—' (replace bằng '-' hoặc '...')
- Markdown bullet/header/bold ('**', '#', '- '): community thường flat text
- Phrase mở đầu AI: "As an AI", "I understand", "Great question!", "Certainly!"
- 3+ short sentences đồng độ dài (AI thường sinh "A is B. B is C. C is D.")
- Em dash + "while" + "however" cùng câu
- Sentence kết bằng "Hope this helps!" / "Best of luck!"
${ctx.habitatAiDetectionNote ? `\nADMIN NOTE: ${ctx.habitatAiDetectionNote}` : ''}
═══════════════════════════════════════════════════════════\n`
      : null,
    `TASK: Viết 1 post hoàn chỉnh cho cộng đồng này.`,
    `Ngôn ngữ target (đăng thật): ${ctx.targetLang}`,
    ctx.isBilingual
      ? `⚠⚠⚠ BILINGUAL OUTPUT REQUIRED — ĐỌC KỸ ⚠⚠⚠

JSON output PHẢI có 2 versions với 2 NGÔN NGỮ KHÁC NHAU:

═══════════════════════════════════════════════════════════
"bodyReview" + "titleReview" → **VIETNAMESE** (tiếng Việt có dấu)
"bodyTarget" + "titleTarget" → **${ctx.targetLang.toUpperCase()}** (native ${ctx.targetLang})
═══════════════════════════════════════════════════════════

VÍ DỤ MINH HOẠ (target=${ctx.targetLang}):
${ctx.targetLang === 'es' ? `{
  "titleReview": "Bí mật của cung Bọ Cạp ban đêm",
  "titleTarget": "El secreto de Escorpio bajo la luna",
  "bodyReview": "Bài viết VN: Nhiều người nghĩ cung Bọ Cạp khó hiểu...",
  "bodyTarget": "Mucha gente piensa que Escorpio es difícil de entender..."
}` : ctx.targetLang === 'fr' ? `{
  "titleReview": "Le secret du Scorpion la nuit",
  "titleTarget": "Le secret du Scorpion sous la lune",
  "bodyReview": "Bài viết VN: ...",
  "bodyTarget": "Beaucoup de gens pensent que le Scorpion..."
}` : `{
  "titleReview": "Tiêu đề tiếng Việt",
  "titleTarget": "Title in ${ctx.targetLang}",
  "bodyReview": "Body tiếng Việt...",
  "bodyTarget": "Body in ${ctx.targetLang}..."
}`}

QUAN TRỌNG:
- "bodyReview" và "titleReview" PHẢI là tiếng Việt — operator người Việt review.
  KHÔNG code-switching English ("Its giving X", "be like", "big X energy", "vibes")
  — dịch về tiếng Việt tự nhiên.
- "bodyTarget" và "titleTarget" PHẢI là ${ctx.targetLang.toUpperCase()} native — sẽ paste
  lên ${ctx.habitatName} cho community ${ctx.targetLang}-speaker đọc.
  KHÔNG được trả tiếng Việt trong slot target — community sẽ KHÔNG hiểu.
- Tên riêng (handle, brand, sub name) giữ nguyên cả 2 phía.
- Cả 2 versions tải CÙNG arc / CÙNG hook / CÙNG CTA — chỉ khác ngôn ngữ.

═══════════════════════════════════════════════════════════
PARAGRAPH STRUCTURE (CRITICAL — UI hiển thị 2 cột song hành):

"bodyReview" và "bodyTarget" PHẢI có CÙNG SỐ paragraph, CÙNG THỨ TỰ.
Tách paragraph bằng blank line (\\n\\n) hoặc bullet ("- "/"* "/"1. ").

Vd: nếu bodyTarget có 5 đoạn:
  Đoạn 1 → idea A
  Đoạn 2 → idea B
  Đoạn 3 → idea C
  Đoạn 4 → idea D
  Đoạn 5 → CTA

→ bodyReview PHẢI có ĐÚNG 5 đoạn, đoạn i = bản dịch tiếng Việt của đoạn i target.
KHÔNG được gộp 2 đoạn target thành 1 đoạn review hoặc tách 1 đoạn target thành 2 đoạn review.

Bullet list: số bullet PHẢI bằng nhau (vd target có 3 bullet → review cũng 3 bullet).
═══════════════════════════════════════════════════════════

NẾU MODEL THẤY MÌNH SẮP TRẢ tiếng Việt vào "bodyTarget" → STOP, dịch sang ${ctx.targetLang} trước.
NẾU MODEL THẤY MÌNH SẮP TRẢ ${ctx.targetLang} vào "bodyReview" → STOP, dịch sang tiếng Việt trước.`
      : `Target community nói tiếng Việt → 1 phiên bản tiếng Việt thuần:
  - bodyReview + titleReview: tiếng Việt 100% có dấu, KHÔNG code-switching English
  - bodyTarget + titleTarget: COPY chính xác từ bodyReview / titleReview`,
    '',
    `Output STRICT JSON (4 fields language MUST be different):`,
    `{`,
    ctx.isBilingual
      ? `  "titleReview":  "...",  // 🇻🇳 TIẾNG VIỆT - tiêu đề cho operator review`
      : `  "titleReview":  "...",  // tiêu đề tiếng Việt`,
    ctx.isBilingual
      ? `  "titleTarget":  "...",  // 🌐 ${ctx.targetLang.toUpperCase()} - tiêu đề native ${ctx.targetLang}, sẵn sàng paste`
      : `  "titleTarget":  "...",  // copy = titleReview`,
    ctx.isBilingual
      ? `  "bodyReview":   "...",  // 🇻🇳 TIẾNG VIỆT - body markdown để review`
      : `  "bodyReview":   "...",  // body markdown tiếng Việt`,
    ctx.isBilingual
      ? `  "bodyTarget":   "...",  // 🌐 ${ctx.targetLang.toUpperCase()} - body native, đăng thật${hardLenText ? ` — BẮT BUỘC ${hardLenText}` : ''}`
      : `  "bodyTarget":   "...",  // copy = bodyReview${hardLenText ? ` — BẮT BUỘC ${hardLenText}` : ''}`,
    `  "hookUsed":     "...",  // hook nào đã chọn (1 dòng)`,
    `  "rationale":    "..."   // 2-3 câu giải thích vì sao approach này fit phase + community`,
    `}`,
    '',
    `YÊU CẦU CHẤT LƯỢNG (BẮT BUỘC):`,
    ``,
    `OPENING - TUYỆT ĐỐI CẤM:`,
    `- KHÔNG được mở bài bằng greeting kiểu "Hello everyone", "Hi fellow X", "Hey r/astrology", "Xin chào mọi người"`,
    `- KHÔNG được tự giới thiệu kiểu "I'm Lithervard", "I'm @<handle>", "Tôi là <name>"`,
    `- KHÔNG được mở bài bằng "Today I want to share...", "Recently I've been...", "Let's dive into..."`,
    `- AI checker xem những opening này = LOẠI BỎ ngay, không pass review.`,
    ``,
    // Standard 6-style chỉ áp dụng cho 'regular' và 'expert' (voice cần có hook). Các
    // voice còn lại (shitposter/edgelord/lurker/hype) có opening rules riêng đã ghi
    // trong VOICE PROFILE block ở trên — không apply 6-style chuẩn.
    (ctx.effectiveVoiceProfile === 'regular' || ctx.effectiveVoiceProfile === 'expert')
      ? `OPENING - PHẢI DÙNG (chọn 1 style, mỗi bài 1 style khác nhau):
  1. In-medias-res: nhảy thẳng vào 1 quan sát/sự kiện cụ thể
  2. Provocative question: câu hỏi gây tranh cãi
  3. Contrarian claim: phản đề có data backing
  4. Specific observation: 1 chi tiết kỹ thuật bất ngờ
  5. Concrete scene: mở bằng 1 cảnh (3am, metro, café…)
  6. Stat/finding hook: số liệu cụ thể`
      : `OPENING: Tuân theo rules trong VOICE PROFILE block ở trên — KHÔNG dùng 6-style chuẩn (sẽ phá vibe).`,
    ``,
    `KHÁC:`,
    `- Tự nhiên, không có dấu hiệu AI ("vibes", "based on my analysis", em dash "—", "let's dive into" v.v.)`,
    `- Respect TẤT CẢ community rules ở trên (channel override > habitat khi conflict)`,
    `- Nếu phase là Warm-up/Value: TUYỆT ĐỐI không link, không pitch, không "I built X"`,
    `- Nếu phase là Bridge: chỉ chart watermark, không link sống`,
    `- Nếu phase là Seed/Direct: 1 link contextual nếu rules cho phép`,
    `- Tone match VOICE PROFILE + persona voice + phase tone (priority: voice > persona > phase)`,
    hardLen
      ? `- ĐỘ DÀI (ƯU TIÊN TỐI THƯỢNG, đè voice/platform): bodyTarget = ${hardLenText}.`
      : lengthHint
      ? `- Length: ${lengthHint} (VOICE PROFILE overrides platform default)`
      : `- Length phù hợp platform (Reddit: 200-800w; Forum: 500-1500w; FB: 100-300w; Discord: 50-200w)`,
    `- KHÔNG được tự ký tên cuối bài. Reddit không cần signature.`,
  ].filter(Boolean).join('\n');
}

// ── generateFullDraft (reasoning) ──────────────────────────────────

export async function generateFullDraft(
  cardId: number, opts?: {
    hookChoice?: string;
    modelId?: string;
    customInstruction?: string;
    humanizer?: HumanizerOpts;
    lang?: string;   // 'auto'(default) | 'community' | code ('en','zh','vi'…)
    briefOverride?: {
      approach_md?: string;
      tone?: string;
      do_md?: string;
      dont_md?: string;
      narrative_md?: string;
    };
  },
): Promise<{
  ok: boolean; saved?: boolean; rationale?: string; error?: string;
  // Trả nguyên data đã lưu — client setState local thay vì revalidate page.
  title?: string; titleReview?: string; bodyReview?: string; bodyTarget?: string;
}> {
  try {
    const client = ensureClient();
    const ctxOrErr = await loadPostContext(cardId);
    if ('error' in ctxOrErr) return { ok: false, error: ctxOrErr.error };
    const ctxBase = ctxOrErr;
    // Apply briefOverride field-by-field (chỉ thay field user explicit gửi).
    // User chỉnh tại side panel = experiment "tại thực địa" không lưu DB.
    const ov = opts?.briefOverride ?? {};
    const ctx: typeof ctxBase = {
      ...ctxBase,
      ...(typeof ov.approach_md === 'string' ? { briefApproachMd: ov.approach_md } : {}),
      ...(typeof ov.tone === 'string' ? { briefTone: ov.tone } : {}),
      ...(typeof ov.do_md === 'string' ? { briefDoMd: ov.do_md } : {}),
      ...(typeof ov.dont_md === 'string' ? { briefDontMd: ov.dont_md } : {}),
      ...(typeof ov.narrative_md === 'string' ? { briefNarrativeMd: ov.narrative_md } : {}),
    };

    const userPrompt = buildDraftPrompt(ctx, opts?.hookChoice ?? null, opts?.customInstruction, opts?.humanizer, opts?.lang);

    // Model resolution: user override (whitelist) > REASONING_MODEL default.
    const chosenModel = opts?.modelId && isValidTextModel(opts.modelId)
      ? opts.modelId
      : REASONING_MODEL;

    const completion = await client.chat.completions.create({
      model: chosenModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'user', content: `Bạn là community-marketing copywriter senior. ${userPrompt}` },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as {
      titleReview?: string;
      titleTarget?: string;
      bodyReview?: string;
      bodyTarget?: string;
      hookUsed?: string;
      rationale?: string;
    };

    const db = getDb();
    if (!db) return { ok: false, error: 'DATABASE_URL not configured' };
    const newTitleTarget = String(parsed.titleTarget ?? parsed.titleReview ?? ctx.cardTitle);
    const newTitleReview = String(parsed.titleReview ?? parsed.titleTarget ?? ctx.cardTitle);
    const newBodyReview = String(parsed.bodyReview ?? '');
    // Độ dài (chip 1-câu/2-3-câu) ép trong prompt (schema bodyTarget + tắt hint mâu
    // thuẫn). clamp = lưới an toàn 0-cost, gần như không kích hoạt. bodyReview giữ nguyên.
    const newBodyTarget = injectTypos(clampDraftLength(String(parsed.bodyTarget ?? parsed.bodyReview ?? ''), opts?.humanizer), opts?.humanizer);
    await db.update(cards).set({
      title: newTitleTarget,
      titleReview: newTitleReview,
      bodyReview: newBodyReview,
      bodyTarget: newBodyTarget,
      updatedAt: new Date(),
    }).where(eq(cards.id, cardId));
    // KHÔNG revalidatePath — đây là edit 1 card, client tự setState bằng
    // values trả về. Cả page re-render = lãng phí + UX giật.
    return {
      ok: true, saved: true, rationale: parsed.rationale,
      title: newTitleTarget, titleReview: newTitleReview,
      bodyReview: newBodyReview, bodyTarget: newBodyTarget,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── generateBatchForPhase (reasoning, batch-N) ─────────────────────
// 1 inference sinh đồng thời N posts cho cùng (brief × phase). Model
// thấy cả N posts trong cùng prompt → tự enforce diversity về hook,
// concept, opening style. Rẻ hơn + nhanh hơn N single calls.

export interface BatchResult {
  rationale?: string;
  results: Array<{
    cardId: number;
    cardRef: string;
    hookUsed: string;
    concept: string;
    titleTarget: string;
  }>;
}

function buildBatchPrompt(
  ctx: PostContext,
  hooks: string[],
  count: number,
): string {
  const voiceNotesCombined = [
    ctx.pillarVoiceNotes && `[Pillar voice]: ${ctx.pillarVoiceNotes}`,
    ctx.habitatVoiceNotes && `[Habitat voice]: ${ctx.habitatVoiceNotes}`,
  ].filter(Boolean).join('\n');
  const voiceBlock = voicePromptBlock(ctx.effectiveVoiceProfile, voiceNotesCombined);
  const lengthHint = voiceLengthHint(ctx.effectiveVoiceProfile);
  const fewShotBlock = fewShotPromptBlock(
    ctx.habitatFewShot ?? ctx.pillarExemplars,
    ctx.channelFewShot,
  );
  return [
    `BỐI CẢNH (chung cho cả ${count} posts):`,
    `  Platform: ${ctx.platformLabel || ''}`,
    `  Community: ${ctx.habitatName} (${ctx.habitatKind}, lang: ${ctx.habitatLanguage || ctx.targetLang})`,
    ctx.channelName ? `  Channel: #${ctx.channelName}${ctx.channelDescription ? ` — ${ctx.channelDescription}` : ''}` : null,
    `  Account: @${ctx.accountHandle || '?'}`,
    ctx.personaVoiceSummary ? `  Persona voice: ${ctx.personaVoiceSummary}` : null,
    ctx.personaNarrativeStyle ? `  Narrative style: ${ctx.personaNarrativeStyle}` : null,
    '',
    ctx.pillarId != null ? `# CONTENT PILLAR: ${ctx.pillarName}` : null,
    ctx.pillarTagline ? `Tagline: "${ctx.pillarTagline}"` : null,
    ctx.pillarKeyMessages.length > 0 ? `KEY MESSAGES (mỗi post phản ánh 1+ ý):
${ctx.pillarKeyMessages.map((m) => `  • ${m}`).join('\n')}` : null,
    ctx.pillarForbiddenMsgs.length > 0 ? `🚫 GUARDRAILS (TUYỆT ĐỐI KHÔNG):
${ctx.pillarForbiddenMsgs.map((m) => `  ✗ ${m}`).join('\n')}` : null,
    ctx.pillarId != null ? '' : null,
    voiceBlock,
    '',
    `PHASE: ${ctx.phase ? PHASE_LABEL[ctx.phase] : '(unknown)'}`,
    ctx.phaseGoal ? `  Mục tiêu: ${ctx.phaseGoal}` : null,
    ctx.phaseTone ? `  Giọng phase: ${ctx.phaseTone}` : null,
    ctx.phaseCadence ? `  Tần suất: ${ctx.phaseCadence}` : null,
    lengthHint ? `  Length (voice profile override): ${lengthHint}` : null,
    '',
    `BRIEF NARRATIVE:`,
    ctx.briefNarrativeMd || '(chưa có)',
    '',
    `BRIEF APPROACH:`,
    ctx.briefApproachMd || '(chưa có)',
    '',
    `NÊN: ${ctx.phaseDoMd || ctx.briefDoMd || '(chưa có)'}`,
    '',
    `KHÔNG: ${ctx.phaseDontMd || ctx.briefDontMd || '(chưa có)'}`,
    '',
    ctx.tribeLexicon.length > 0 ? `# TRIBE LEXICON — PREFER:\n${ctx.tribeLexicon.map((w) => `  - ${w}`).join('\n')}` : null,
    ctx.tribeAvoid.length > 0 ? `# TRIBE AVOID — outsider tells:\n${ctx.tribeAvoid.map((w) => `  - ${w}`).join('\n')}` : null,
    '',
    `# COMMUNITY RULES (HABITAT BASE):`,
    ctx.habitatPostingRules ? `  Posting rules: ${ctx.habitatPostingRules.slice(0, 500)}` : null,
    ctx.habitatModStrictness ? `  Mod strictness: ${ctx.habitatModStrictness}` : null,
    ctx.habitatForbiddenTopics.length > 0 ? `  CẤM: ${ctx.habitatForbiddenTopics.join(', ')}` : null,
    '',
    ctx.channelName ? `# CHANNEL OVERRIDE — #${ctx.channelName} (PRIORITY):` : null,
    ctx.channelDescription ? `  Intent: ${ctx.channelDescription}` : null,
    ctx.channelRules ? `  Rules:\n${ctx.channelRules.slice(0, 800).split('\n').map((l) => `    ${l}`).join('\n')}` : null,
    '',
    fewShotBlock || null,
    fewShotBlock ? '' : null,
    hooks.length > 0 ? `=== HOOK PATTERNS CÓ SẴN (PHẢI dùng ${count} hook KHÁC nhau từ list này, mỗi post 1 hook):` : null,
    ...hooks.map((h, i) => `  [${i + 1}] ${h}`),
    hooks.length > 0 ? `Nếu cần thêm hook, tự chế nhưng KHÁC HOÀN TOÀN với ${count} hook đã chọn.` : `Không có hook list - tự chế ${count} hook hoàn toàn khác nhau.`,
    '',
    `=== TASK ===`,
    `Sinh ĐỒNG THỜI ${count} posts khác nhau cho phase này. Output JSON:`,
    `{`,
    `  "posts": [`,
    ...Array.from({ length: count }, (_, i) =>
      `    { "titleReview": "...", "titleTarget": "...", "bodyReview": "...", "bodyTarget": "...", "hookUsed": "...", "concept": "..." }${i < count - 1 ? ',' : ''}`,
    ),
    `  ],`,
    `  "rationale": "1-2 câu giải thích vì sao ${count} posts này cover nhiều angle khác nhau"`,
    `}`,
    '',
    ctx.isBilingual
      ? `bodyReview = tiếng Việt (review). bodyTarget = ${ctx.targetLang} (đăng thật). Cùng nội dung, khác ngôn ngữ.`
      : `target_lang = vi nên bodyReview = bodyTarget (cùng tiếng Việt).`,
    '',
    `=== YÊU CẦU CHẤT LƯỢNG (BẮT BUỘC):`,
    ``,
    `DIVERSITY across ${count} posts (ENFORCED):`,
    `- ${count} posts PHẢI dùng ${count} hook KHÁC NHAU rõ rệt`,
    `- ${count} concepts khác nhau (transit / aspect / house / sign / point / technique - KHÔNG được trùng)`,
    `- ${count} opening styles khác nhau (chọn ${count}/6 styles trong list dưới)`,
    `- ${count} closing CTA khác nhau (open question / share story / disagree / poll / silent)`,
    ``,
    `OPENING - TUYỆT ĐỐI CẤM (mọi posts):`,
    `- KHÔNG mở "Hello everyone", "Hi fellow X", "Hey r/astrology"`,
    `- KHÔNG tự giới thiệu "I'm <handle>", "Tôi là <name>"`,
    `- KHÔNG mở "Today I want to share", "Recently I've been", "Let's dive into"`,
    `- KHÔNG ký tên cuối bài`,
    ``,
    (ctx.effectiveVoiceProfile === 'regular' || ctx.effectiveVoiceProfile === 'expert')
      ? `OPENING - PHẢI chọn 1 trong 6 styles (mỗi post 1 style khác):
  1. In-medias-res: nhảy vào scene cụ thể
  2. Provocative question: câu hỏi gây tranh cãi
  3. Contrarian claim: phản đề có data backing
  4. Specific technical observation: chi tiết kỹ thuật bất ngờ
  5. Concrete scene: 1 cảnh (3am / metro / cafe / etc.)
  6. Stat/finding hook: số liệu cụ thể`
      : `OPENING: Tuân theo rules trong VOICE PROFILE block ở trên — KHÔNG dùng 6-style chuẩn.`,
    ``,
    `OTHER:`,
    `- Tự nhiên, KHÔNG dấu hiệu AI ("vibes", "based on my analysis", em dash, "let's dive into")`,
    `- Warm-up/Value: TUYỆT ĐỐI không link, không pitch, không "I built X"`,
    `- Bridge: chỉ chart screenshot, không link sống`,
    `- Seed/Direct: 1 link contextual nếu rules cho phép`,
    lengthHint
      ? `- Length: ${lengthHint} (VOICE PROFILE overrides platform default)`
      : `- Length: Reddit 200-800w; Forum 500-1500w; FB 100-300w; Discord 50-200w`,
  ].filter(Boolean).join('\n');
}

export async function generateBatchForPhase(
  projectId: string, briefId: number, phase: Phase,
): Promise<{ ok: boolean; batch?: BatchResult; error?: string }> {
  try {
    const client = ensureClient();
    const db = getDb();
    if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

    // Get cards for this brief × phase (sorted by id for stable mapping)
    const cardRows = await db.execute(sql`
      SELECT id, card_ref FROM cards
      WHERE project_id = ${projectId} AND brief_id = ${briefId} AND brief_phase = ${phase}
      ORDER BY id ASC
    `);
    const cards_ = (cardRows as unknown as Array<{ id: number; card_ref: string }>);
    if (cards_.length === 0) return { ok: false, error: 'không có card nào cho phase này' };

    // Load context from first card (all share same brief/phase)
    const ctxOrErr = await loadPostContext(cards_[0]!.id);
    if ('error' in ctxOrErr) return { ok: false, error: ctxOrErr.error };
    const ctx = ctxOrErr;

    const hooks: string[] = [];
    // Pull hooks from phase_plan entry. loadPostContext exposes phaseHooks.
    if (ctx.phaseHooks && ctx.phaseHooks.length > 0) hooks.push(...ctx.phaseHooks);

    const count = cards_.length;
    const userPrompt = buildBatchPrompt(ctx, hooks, count);

    const completion = await client.chat.completions.create({
      model: REASONING_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'user', content: `Bạn là community-marketing copywriter senior. ${userPrompt}` },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as {
      posts?: Array<{
        titleReview?: string; titleTarget?: string;
        bodyReview?: string; bodyTarget?: string;
        hookUsed?: string; concept?: string;
      }>;
      rationale?: string;
    };
    const posts = parsed.posts ?? [];

    // Update each card by index. If AI returns fewer posts than expected,
    // remaining cards keep their old content.
    const results: BatchResult['results'] = [];
    for (let i = 0; i < Math.min(cards_.length, posts.length); i++) {
      const card = cards_[i]!;
      const p = posts[i]!;
      await db.update(cards).set({
        title: String(p.titleTarget ?? p.titleReview ?? `Untitled #${i + 1}`),
        bodyReview: String(p.bodyReview ?? ''),
        bodyTarget: String(p.bodyTarget ?? p.bodyReview ?? ''),
        updatedAt: new Date(),
      }).where(eq(cards.id, card.id));
      results.push({
        cardId: card.id,
        cardRef: card.card_ref,
        hookUsed: String(p.hookUsed ?? ''),
        concept: String(p.concept ?? ''),
        titleTarget: String(p.titleTarget ?? ''),
      });
    }

    // KHÔNG revalidatePath — client gọi onChange (bumpKey) để re-fetch list
    // PostsForPhase tại chỗ; tránh full page RSC re-render.
    return { ok: true, batch: { rationale: parsed.rationale, results } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── critiquePost (reasoning) ───────────────────────────────────────

export interface PostCritique {
  riskLevel: 'low' | 'medium' | 'high';
  willModRemove: boolean;
  risks: Array<{ severity: 'low' | 'medium' | 'high'; issue: string; fix: string }>;
  suggestions: string[];
  rationale: string;
}

export async function critiquePost(
  cardId: number,
): Promise<{ ok: boolean; critique?: PostCritique; error?: string }> {
  try {
    const client = ensureClient();
    const ctxOrErr = await loadPostContext(cardId);
    if ('error' in ctxOrErr) return { ok: false, error: ctxOrErr.error };
    const ctx = ctxOrErr;

    const userPrompt = [
      `BỐI CẢNH:`,
      `  Community: ${ctx.habitatName} (${ctx.habitatKind})`,
      `  Phase: ${ctx.phase ? PHASE_LABEL[ctx.phase] : '?'}`,
      `  Account: @${ctx.accountHandle ?? '?'} - ${ctx.personaVoiceSummary || 'no persona voice set'}`,
      '',
      `COMMUNITY RULES:`,
      ctx.habitatPostingRules ? ctx.habitatPostingRules.slice(0, 800) : '(none recorded)',
      `Mod strictness: ${ctx.habitatModStrictness || '?'}`,
      ctx.habitatForbiddenTopics.length > 0 ? `Forbidden topics: ${ctx.habitatForbiddenTopics.join(', ')}` : null,
      ctx.habitatMinAccountAgeDays > 0 ? `Posting gate: account age ≥ ${ctx.habitatMinAccountAgeDays} ngày` : null,
      ctx.habitatMinKarma > 0 ? `Posting gate: karma ≥ ${ctx.habitatMinKarma}` : null,
      ctx.habitatLinksAllowedAfter ? `Links allowed: ${ctx.habitatLinksAllowedAfter}` : null,
      '',
      `PHASE RULES:`,
      `NÊN: ${ctx.phaseDoMd || ctx.briefDoMd || '(chưa có)'}`,
      `KHÔNG: ${ctx.phaseDontMd || ctx.briefDontMd || '(chưa có)'}`,
      '',
      `BẢN NHÁP TARGET (${ctx.targetLang}):`,
      ctx.cardBodyTarget || '(empty)',
      '',
      ctx.isBilingual ? `BẢN VN (review):` : null,
      ctx.isBilingual ? (ctx.cardBodyReview || '(empty)') : null,
      '',
      `TASK: Review bản nháp này như 1 mod cộng đồng + 1 senior community marketer. Tìm risks.`,
      `Output STRICT JSON:`,
      `{`,
      `  "riskLevel": "low" | "medium" | "high",`,
      `  "willModRemove": true | false,                                  // dự đoán mod có remove post này không`,
      `  "risks": [`,
      `    { "severity": "low|medium|high", "issue": "vấn đề cụ thể", "fix": "đề xuất sửa" }`,
      `  ],`,
      `  "suggestions": ["polish suggestion 1", "polish suggestion 2"],   // 3-5 mục cải thiện không phải risk`,
      `  "rationale": "1-2 câu giải thích overall verdict"`,
      `}`,
      ``,
      `Chú ý: nếu phase là Warm-up/Value thì link/promo = high risk. Nếu Bridge thì raw link = medium risk. Nếu Seed/Direct thì check 1 link đúng context.`,
    ].filter(Boolean).join('\n');

    const completion = await client.chat.completions.create({
      model: REASONING_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'user', content: `Bạn là mod cộng đồng nghiêm khắc + senior community marketer. ${userPrompt}` },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as PostCritique;
    return { ok: true, critique: parsed };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── translateBetween (cheap) ───────────────────────────────────────

export async function translateBetween(
  cardId: number, direction: 'review-to-target' | 'target-to-review',
): Promise<{ ok: boolean; saved?: boolean; translated?: string; direction?: 'review-to-target' | 'target-to-review'; error?: string }> {
  try {
    const client = ensureClient();
    const ctxOrErr = await loadPostContext(cardId);
    if ('error' in ctxOrErr) return { ok: false, error: ctxOrErr.error };
    const ctx = ctxOrErr;

    if (!ctx.isBilingual) return { ok: true, saved: false }; // no-op cho target_lang=vi

    const source = direction === 'review-to-target' ? ctx.cardBodyReview : ctx.cardBodyTarget;
    const sourceLang = direction === 'review-to-target' ? 'vi' : ctx.targetLang;
    const destLang = direction === 'review-to-target' ? ctx.targetLang : 'vi';
    if (!source.trim()) return { ok: false, error: 'source rỗng' };

    const userPrompt = [
      `Translate post markdown từ ${sourceLang} sang ${destLang}.`,
      `Đây là post cho community ${ctx.habitatName} (${ctx.habitatKind}).`,
      `Persona: @${ctx.accountHandle ?? '?'} - ${ctx.personaVoiceSummary || ''}`,
      `Phase: ${ctx.phase ? PHASE_LABEL[ctx.phase] : '?'}; Tone: ${ctx.phaseTone || ctx.briefTone}`,
      '',
      `RULES:`,
      `- Giữ nguyên markdown structure (heading, list, blockquote)`,
      `- Dịch natural idioms - KHÔNG word-for-word`,
      `- Giữ technical terms (chart, transit, natal, synastry, horary, profections, Saturn return, etc.) không dịch`,
      `- Giữ proper names (Skyscript, Reddit, Astrolas, etc.)`,
      `- Output JSON: { "translated": "..." }`,
      '',
      `SOURCE (${sourceLang}):`,
      source,
    ].join('\n');

    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Bạn là translator chuyên nghiệp cho marketing content. Dịch tự nhiên, giữ tone, giữ markdown.' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as { translated?: string };
    if (!parsed.translated) return { ok: false, error: 'translation rỗng' };

    const db = getDb();
    if (!db) return { ok: false, error: 'DATABASE_URL not configured' };
    if (direction === 'review-to-target') {
      await db.update(cards).set({ bodyTarget: parsed.translated, updatedAt: new Date() }).where(eq(cards.id, cardId));
    } else {
      await db.update(cards).set({ bodyReview: parsed.translated, updatedAt: new Date() }).where(eq(cards.id, cardId));
    }
    // KHÔNG revalidatePath — chỉ ô textarea thay đổi, client tự setState bằng
    // `translated` trả về. Cả page re-render = lãng phí + UX giật.
    return { ok: true, saved: true, translated: parsed.translated, direction };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

