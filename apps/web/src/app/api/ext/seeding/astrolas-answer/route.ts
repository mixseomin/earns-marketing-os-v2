import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { checkAuth } from '../../_auth';
import { createPostForBriefPhase, updatePost } from '@/lib/actions/brief-posts';
import { resolveForumChannelId } from '@/lib/actions/forum-channel';
import type { Phase } from '@/lib/phase-plan';
import { clampDraftLength, injectTypos, applyHumanErrors, stripAITells } from '@/lib/ai/humanizer';
import { normalizeParentUrl } from '@/lib/parent-url';
import { resolveFormatDirective, applyLengthPriority } from '@/lib/format-presets';

// NER-lite: rút tên người (public-figure candidate) từ text — chuỗi 2-3 từ
// Title-Case liền nhau. KHÔNG LLM. Engine Astrolas tự resolve (Profile DB tag=
// celebrity → Wikidata P569) + REJECT khi DOB precision<day / không có → over-
// capture vô hại, engine là gatekeeper (resolved=false ⇒ no sign claim). Không
// thấy tên ⇒ bỏ angle ⇒ answer chiêm tinh thường.
const NAME_STOP = new Set(['The', 'This', 'That', 'These', 'Those', 'A', 'An', 'I', 'We', 'You', 'He', 'She', 'It', 'They', 'But', 'And', 'So', 'Or', 'My', 'Our', 'Your', 'His', 'Her', 'Its', 'Their', 'In', 'On', 'At', 'Of', 'For', 'To', 'With', 'As', 'If', 'When', 'While', 'Why', 'How', 'What', 'Who', 'Whom', 'Where', 'Which', 'Then', 'Now', 'Here', 'There', 'Yes', 'No', 'Not', 'Just', 'Also', 'Only', 'Even', 'Some', 'Many', 'Most', 'Each', 'Every', 'More', 'Less', 'Both', 'All', 'Any', 'Such', 'New', 'Old', 'Edit', 'Reddit', 'OP']);
// Thuật ngữ chiêm tinh / cấu trúc chart — loại candidate chứa bất kỳ từ nào trong đây
// (mô tả ảnh natal chart toàn cụm Title-Case: "Sun Conjunct Mercury", "House System",
// "Chart Layout", "General Information"…). Bên Astrolas báo entities rác 2026-06-11.
const ASTRO_TERMS = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Node', 'Chiron', 'Lilith', 'Ascendant', 'Descendant', 'Midheaven', 'Rising', 'Conjunct', 'Conjunction', 'Trine', 'Square', 'Opposition', 'Opposite', 'Sextile', 'Quincunx', 'Aspect', 'Aspects', 'House', 'Houses', 'Chart', 'Natal', 'Birth', 'Zodiac', 'Placidus', 'Cusp', 'Degree', 'Retrograde', 'North', 'South', 'General', 'Information', 'Layout', 'Section', 'Wheel', 'System', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces', 'Horoscope', 'Astrology', 'Transit', 'Transits', 'Synastry', 'Placement', 'Placements']);
function extractNameCandidates(title?: string, bodyText?: string): string[] {
  const text = `${title ?? ''}\n${bodyText ?? ''}`;
  const re = /\b([A-Z][a-z]+(?:['’.-][A-Za-z]+)?(?:\s+[A-Z][a-z]+(?:['’.-][A-Za-z]+)?){1,2})\b/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let words = (m[1] ?? '').split(/\s+/);
    for (let f = words[0]; f && NAME_STOP.has(f); f = words[0]) words = words.slice(1);
    for (let l = words[words.length - 1]; l && NAME_STOP.has(l); l = words[words.length - 1]) words = words.slice(0, -1);
    if (words.length < 2) continue;            // cần ≥2 từ → giảm false positive
    if (words.some((w) => ASTRO_TERMS.has(w))) continue;   // bỏ cụm thuật ngữ chart
    const name = words.join(' ');
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 8) break;
  }
  return out;
}

// Querent self-chart: parse birth-data từ text mô tả ảnh natal chart (Astro-Seek:
// "Date and Time: 23 February 1992, 11:08 am", "Coordinates: 1°17'N, 103°51'E").
// → {dob, birth_time?, birth_coords?} gửi entities cho engine dựng transient chart.
// ⚠ KHÔNG kèm birth_place text: engine geocode place bị loop tới safety-valve dù đã có
// coords (probe 2026-06-12) → CHỈ gửi coords; engine suy tz từ coords.
const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
interface SelfChart { dob: string; birth_time?: string; birth_coords?: { lat: number; lon: number } }
function parseSelfChart(visionText?: string): SelfChart | null {
  const text = visionText ?? ''; if (!text.trim()) return null;
  let dob = '';
  let m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);              // 23 February 1992
  if (m && MONTHS[(m[2] ?? '').toLowerCase()]) dob = `${m[3]}-${String(MONTHS[(m[2] ?? '').toLowerCase()]).padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`;
  if (!dob) { m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/); if (m && MONTHS[(m[1] ?? '').toLowerCase()]) dob = `${m[3]}-${String(MONTHS[(m[1] ?? '').toLowerCase()]).padStart(2, '0')}-${(m[2] ?? '').padStart(2, '0')}`; }   // February 23, 1992
  if (!dob) { m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (m) dob = `${m[1]}-${m[2]}-${m[3]}`; }
  if (!dob || isNaN(new Date(`${dob}T00:00:00Z`).getTime())) return null;
  const out: SelfChart = { dob };
  const tap = text.match(/\b(\d{1,2}):(\d{2})\s*([ap]m)\b/i);
  if (tap) { let h = parseInt(tap[1] ?? '0', 10); const ap = (tap[3] ?? '').toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; out.birth_time = `${String(h).padStart(2, '0')}:${tap[2]}`; }
  else { const t24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/); if (t24) out.birth_time = `${(t24[1] ?? '').padStart(2, '0')}:${t24[2]}`; }
  const c = text.match(/(\d{1,3})°\s*(\d{1,2})?['′]?\s*([NS])[,\s]+(\d{1,3})°\s*(\d{1,2})?['′]?\s*([EW])/i);
  if (c) {
    const lat = (parseInt(c[1] ?? '0', 10) + parseInt(c[2] ?? '0', 10) / 60) * ((c[3] ?? '').toUpperCase() === 'S' ? -1 : 1);
    const lon = (parseInt(c[4] ?? '0', 10) + parseInt(c[5] ?? '0', 10) / 60) * ((c[6] ?? '').toUpperCase() === 'W' ? -1 : 1);
    out.birth_coords = { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 };
  }
  return out;
}

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

export const dynamic = 'force-dynamic';
export const maxDuration = 300;   // Astrolas deep/max (Sonnet/Opus) + retry: cần > 60s mặc định

export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const extVer = req.headers.get('x-ext-version') || '?';

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
    formatKey?: string;     // preset loại nội dung (quote/chat/reply/comment/long/blog) — xem lib/format-presets.
    targetWords?: number;   // fallback nếu ext cũ ko gửi formatKey. Map → length directive.
    topicsHint?: string[];
    llmConfig?: string;  // 'deep_reading' | 'default_chat' | 'intent_router' | 'openai_*' — override model của tier
    depth?: string;      // 'economy'|'standard'|'deep'|'max' — Astrolas depth tier (tự điều chỉnh model + reasoning layers)
    customPrompt?: string;  // Operator instruction kèm theo brief context
    briefOverride?: {       // User edit brief tại side panel — override field-by-field
      approach_md?: string;
      tone?: string;
      do_md?: string;
      dont_md?: string;
      narrative_md?: string;
    };
    humanizer?: { knobs?: string[]; intensity?: 'light' | 'medium' | 'heavy' };
    channelUrl?: string;
    channelName?: string;
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
      h.ai_content_detection, h.ai_detection_note,
      pa.handle AS account_handle, pa.persona, pa.project_id AS account_project_id
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
  // Off-primary: account dùng project khác làm chính → bỏ giọng persona (brand primary),
  // bám giọng cộng đồng. project_id mirror primary (migration 0091).
  const _accProj = ctxRaw.account_project_id ? String(ctxRaw.account_project_id) : '';
  const offPrimary = !!(_accProj && projectId && _accProj !== String(projectId));
  const phase = (ctx.current_phase ?? 'warm-up') as Phase;
  const habitatLang = String(ctx.habitat_lang ?? 'en');
  const voiceProfile = String(ctx.habitat_voice ?? 'regular');
  const dominantTopics = Array.isArray(ctx.dominant_topics) ? (ctx.dominant_topics as string[]) : [];
  const forbiddenTopics = Array.isArray(ctx.forbidden_topics) ? (ctx.forbidden_topics as string[]) : [];

  // 2. Tạo card + fill parent_* (+ gắn channel_id sub-forum nếu ext gửi breadcrumb).
  const channelDbId = await resolveForumChannelId(db, habitatId, body.channelUrl, body.channelName);
  const create = await createPostForBriefPhase(projectId, briefId, phase, contentType, undefined, channelDbId);
  if (!create.ok || !create.id) {
    return NextResponse.json({ ok: false, error: create.error ?? 'createPost failed' }, { status: 500 });
  }
  const cardId = create.id;

  await updatePost(projectId, cardId, {
    parentUrl: normalizeParentUrl(body.parentUrl),   // canonical (như quick-comment) → list-drafts/version khớp
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

  // Celebrity-astrology: detect tên public-figure CHỈ trên text thảo luận thật — cắt block
  // ảnh ([IMAGES EXTRACTED]) vì mô tả natal chart toàn cụm Title-Case (Sun Conjunct Mercury,
  // House System…) làm NER đẻ entities rác (Astrolas báo).
  const parts = (body.parentBody || '').split(/\[IMAGES?\s+EXTRACTED/i);
  const discussionText = parts[0] ?? '';
  const visionBlock = parts.slice(1).join('\n');
  const celebNames = extractNameCandidates(body.parentTitle, discussionText);
  // Querent self-chart: birth-data parse từ block ảnh (coords-only, KHÔNG place → tránh
  // geocode loop). Có dob → engine dựng transient chart, không cần public name.
  const selfChart = parseSelfChart(visionBlock);
  const entities: Array<{ name: string; dob?: string; birth_time?: string; birth_coords?: { lat: number; lon: number } }> = [
    ...(selfChart ? [{ name: 'querent', ...selfChart }] : []),
    ...celebNames.map((name) => ({ name })),
  ];
  // Chart-reading detect: ảnh CÓ placements (Sun/Mars…: độ Sign House, Ascendant, House System)
  // DÙ không parse được DOB (vd "Date of Birth: Not specified, year 2006") → vẫn là đọc lá số →
  // ép tier deep (Sonnet) + giữ placements cho engine đọc. Tránh tụt về economy/mini → sơ sài.
  const hasChartVision = /\b(?:ascendant|midheaven|house system|\d(?:st|nd|rd|th)\s+house|(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)\s*:\s*\d)\b/i.test(visionBlock);
  // Vision sạch để đưa vào question_body khi KHÔNG có entities: bỏ dòng Location/Coordinates
  // (geocode bait → loop) nhưng GIỮ planet/house/aspect.
  const sanitizedVision = visionBlock
    ? visionBlock.split('\n').filter((l) => !/\b(?:location|coordinate)\b|°\s*\d+['′]?\s*[NSEW]/i.test(l)).join('\n').trim()
    : '';
  // question_body:
  //  - có entities (dob/coords) → engine TỰ dựng chart → bỏ vision (tránh geocode loop + trùng).
  //  - không entities nhưng có placements → GIỮ placements (đã bỏ Location/Coordinates).
  //  - còn lại → giữ nguyên parentBody.
  const questionContent = selfChart
    ? (discussionText.trim() || body.parentBody)
    : (hasChartVision ? `${discussionText.trim()}\n\n[CHART DATA — đọc trực tiếp các placements dưới đây]\n${sanitizedVision}` : body.parentBody);

  // FORMAT + ĐỘ DÀI — preset hoá ở lib/format-presets (formatKey authority, targetWords fallback ext cũ).
  // Gói (kiểu bài + độ dài) → 1 chỉ thị: vd 'long' = chia phần có tiêu đề + tối thiểu ~380 từ.
  const fmt = resolveFormatDirective(body.formatKey, body.targetWords);
  const lenDirective = fmt.directive;

  const questionBodyEnriched = [
    `[STRICT OUTPUT LANGUAGE: ${langName} (${habitatLang}) — MUST reply ENTIRELY in ${langName}. Brief context below may be in Vietnamese (operator notes) but YOUR ANSWER must be ${langName}. DO NOT mix languages.]`,
    '',
    questionContent,
    '',
    '---',
    '[OPERATOR CONTEXT — KHÔNG phải nội dung user hỏi, chỉ là instruction cho engine. Reply language vẫn phải là ' + langName + ']',
    (!offPrimary && persona.voice_summary) ? `Persona voice: ${persona.voice_summary}` : null,
    (!offPrimary && persona.narrative_style) ? `Persona narrative: ${persona.narrative_style}` : null,
    offPrimary ? `⚠ Account dùng project khác làm chính — KHÔNG dùng giọng brand project chính, bám giọng cộng đồng (habitat voice + brief tone).` : null,
    persona.backstory ? `Persona backstory: ${String(persona.backstory).slice(0, 300)}` : null,
    ctx.approach_md ? `Brief approach (${phase}):\n${String(ctx.approach_md).slice(0, 800)}` : null,
    tonePart ? `Brief tone: ${tonePart}` : null,
    ctx.do_md ? `DO:\n${String(ctx.do_md).slice(0, 500)}` : null,
    ctx.dont_md ? `DON'T:\n${String(ctx.dont_md).slice(0, 500)}` : null,
    forbiddenTopics.length > 0 ? `FORBIDDEN TOPICS: ${forbiddenTopics.join(', ')}` : null,
    customPromptClean ? `\n[OPERATOR INSTRUCTION — ưu tiên cao, áp dụng cho answer này]\n${customPromptClean}` : null,
    // ❌ KHÔNG inject anti-AI block + 🧬 humanizer rules (typo guide / "60 từ" / kết "?!")
    // vào question_body cho Astrolas: đó là writer-mechanics → engine reasoning hiểu nhầm
    // phải viết NGẮN kiểu Reddit reply thay vì grounded reading (Astrolas báo 2026-06-11).
    // Humanize chạy Ở OUTPUT (stripAITells/injectTypos/applyHumanErrors post-process) — input sạch.
    lenDirective ? `[OUTPUT FORMAT & ĐỘ DÀI — bắt buộc: ${lenDirective}]` : null,
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
    // target_words = đòn bẩy độ dài THẬT (Astrolas Team thêm 2026-06-16). Engine ép gen bám ~target,
    // ko dừng sớm khi chart mỏng. max_length giữ làm hard cap an toàn. Xem astrolas-qa-length-control-request.
    ...(fmt.words > 0 ? { target_words: fmt.words } : {}),
    max_length: body.maxLength ?? fmt.maxLength,
    topics_hint: topics,
    request_id: `mos2-card-${cardId}`,
    // llm_config gắn per-call ở callAstrolas (model escalation) — KHÔNG để ở base.
    // Celebrity-astrology angle: chỉ khi có tên public-figure (engine resolve theo tên).
    ...(celebNames.length ? { angle: 'celebrity_astrology' } : {}),
    // entities = querent self-chart (dob/coords từ ảnh) + celeb names. Engine dựng chart
    // từ dob (self) hoặc resolve tên (celeb); reject fake ⇒ không bịa cung.
    ...(entities.length ? { entities } : {}),
  };

  // 🔎 DEBUG LOG (user yêu cầu 2026-06-16): ghi MỌI param độ dài thực gửi engine → đọc journalctl -u mos2-web.
  console.log(`[astrolas-answer:SENT] card=${cardId} formatKey=${body.formatKey ?? '(none)'} bodyTargetWords=${body.targetWords ?? '(none)'} → resolvedWords=${fmt.words} target_words_to_engine=${astrolasPayload.target_words ?? '(NOT SENT)'} max_length=${astrolasPayload.max_length} depth=${body.depth ?? '(none)'}`);

  // 4. Call Astrolas — model escalation (Astrolas đề xuất 2026-06-12): small model nhanh cho
  // casual; default_chat (Sonnet) cho HARD case = self-chart / celeb (data-backed reasoning).
  // + retry escalate nếu engine báo quality thấp (shallow_reasoning / system_message_leak).
  type AstrolasData = {
    ok: boolean; answer_md?: string; answer_lang?: string;
    sources?: Array<{ title: string; url: string; snippet?: string; type?: string }>;
    voice_signals?: { confidence?: number; data_backed?: boolean; model_used?: string; tools_called?: string[]; warnings?: string[]; quality_flags?: string[]; depth?: string; depth_layers?: string[]; claim_confidence?: Array<{ claim?: string; confidence?: number }> };
    // Celebrity-astrology: chart engine THỰC SỰ dùng (resolved=false ⇒ skip, no claim).
    entities_used?: Array<{ name: string; sun_sign?: string | null; moon_sign?: string | null; rising?: string | null; dob?: string | null; birth_time?: string | null; birth_place?: string | null; source?: string | null; resolved?: boolean }>;
    cost_estimate_usd?: number; duration_ms?: number; log_id?: string; error?: string;
  };
  const apiBase = apiUrl.replace(/\/+$/, '');
  const astrolasEndpoint = `${apiBase}/api/v1/qa/answer`;
  const astrolasAuth = `Bearer ${apiKey}`;
  // astrolas.com đứng sau Cloudflare → call Opus/Sonnet 70-115s đôi khi vượt giới hạn CF
  // proxy → CF trả 52x (524 timeout / 520 / 522). Là transient (probe lại thường 70s OK) →
  // RETRY tier đó tối đa 2 lần (tổng 3) với backoff ngắn. (Cũng retry network-timeout.)
  const CF_RETRYABLE = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
  async function callOnce(payload: unknown): Promise<{ kind: 'ok'; data: AstrolasData } | { kind: 'retry' | 'fail'; error: string }> {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(astrolasEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': astrolasAuth },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(240000),  // 240s — deep/max (Sonnet/Opus) >120s; nginx 300s
      });
    } catch (e) {
      console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} TIMEOUT/NET sau ${Date.now() - t0}ms: ${(e as Error).message}`);
      return { kind: 'retry', error: `timeout/network (${Math.round((Date.now() - t0) / 1000)}s): ${(e as Error).message}` };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const retry = CF_RETRYABLE.has(res.status);
      console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} HTTP ${res.status} sau ${Date.now() - t0}ms${retry ? ' (CF transient → retry)' : ''}`);
      return { kind: retry ? 'retry' : 'fail', error: `Astrolas API ${res.status}: ${errText.slice(0, 200)}` };
    }
    console.log(`[astrolas-answer extv=${extVer}] card=${cardId} OK sau ${Date.now() - t0}ms`);
    return { kind: 'ok', data: await res.json() as AstrolasData };
  }
  // ── ASYNC path (deep/max chậm >100s) — submit + poll. Né CF 524 vì mỗi poll là call NGẮN.
  // Contract: POST /qa/submit → 202 {job_id, poll_url}. GET poll_url → {status, ...}. Terminal
  // (status ∉ queued/processing/pending/running) → trả NGUYÊN payload (ok:true+answer_md HOẶC
  // ok:false+error). EMPTY/failed chảy vào isBad y như sync. (Async submit/poll: team built.)
  const submitEndpoint = `${apiBase}/api/v1/qa/submit`;
  const PENDING = new Set(['queued', 'processing', 'pending', 'running', 'started']);
  async function callOnceAsync(payload: unknown): Promise<{ kind: 'ok'; data: AstrolasData } | { kind: 'retry' | 'fail'; error: string }> {
    const t0 = Date.now();
    let sub: Response;
    try {
      sub = await fetch(submitEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': astrolasAuth }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
    } catch (e) { return { kind: 'retry', error: `submit timeout/net: ${(e as Error).message}` }; }
    if (!sub.ok) { const t = await sub.text().catch(() => ''); return { kind: CF_RETRYABLE.has(sub.status) ? 'retry' : 'fail', error: `submit ${sub.status}: ${t.slice(0, 160)}` }; }
    const subJson = await sub.json().catch(() => null) as { job_id?: string; poll_url?: string } | null;
    const jobId = subJson?.job_id;
    if (!jobId) return { kind: 'fail', error: 'submit: no job_id' };
    const pollUrl = subJson?.poll_url || `${apiBase}/api/v1/qa/result/${jobId}`;
    console.log(`[astrolas-answer extv=${extVer}] card=${cardId} async job=${jobId} → poll`);
    const deadline = Date.now() + 270000;   // poll 1 job gần hết maxDuration (300s) → bắt được terminal
    // status (kể cả engine failed=TIME_BUDGET) thay vì bỏ ở 240s rồi resubmit job orphan.
    let consecErr = 0;
    while (Date.now() < deadline) {
      await new Promise((ok) => setTimeout(ok, 5000));
      let pr: Response;
      try { pr = await fetch(pollUrl, { headers: { 'Accept': 'application/json', 'Authorization': astrolasAuth }, signal: AbortSignal.timeout(20000) }); }
      catch { if (++consecErr > 5) return { kind: 'retry', error: 'async poll net errors' }; continue; }
      if (!pr.ok) { if (++consecErr > 5) return { kind: CF_RETRYABLE.has(pr.status) ? 'retry' : 'fail', error: `async poll ${pr.status}` }; continue; }
      consecErr = 0;
      const j = await pr.json().catch(() => null) as (AstrolasData & { status?: string }) | null;
      if (!j) continue;
      if (j.status && PENDING.has(j.status)) continue;
      console.log(`[astrolas-answer extv=${extVer}] card=${cardId} async job=${jobId} terminal=${j.status ?? '?'} sau ${Date.now() - t0}ms`);
      return { kind: 'ok', data: j as AstrolasData };   // ok:true+answer HOẶC ok:false+error → isBad lo tiếp
    }
    return { kind: 'retry', error: `async poll timeout (${Math.round((Date.now() - t0) / 1000)}s) job=${jobId}` };
  }
  const ASYNC_DEPTHS = new Set(['deep', 'max']);   // chậm → async; economy/standard → sync /qa/answer
  async function callAstrolas(depth: string): Promise<{ ok: true; data: AstrolasData } | { ok: false; error: string }> {
    const payload = { ...astrolasPayload, depth, ...(body.llmConfig ? { llm_config: body.llmConfig } : {}) };
    const useAsync = ASYNC_DEPTHS.has(depth);
    console.log(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} mode=${useAsync ? 'async' : 'sync'} → CALL Astrolas`);
    let lastErr = 'unknown';
    const MAX_ATTEMPTS = 2;   // 1 retry transient
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const r = useAsync ? await callOnceAsync(payload) : await callOnce(payload);
      if (r.kind === 'ok') return { ok: true, data: r.data };
      lastErr = r.error;
      // Async submit rate-limit (429): KHÔNG fallback sync — max/deep BẮT BUỘC async (/qa/submit). Sync
      // /qa/answer cap 88s (CF cắt ~100s) → Opus ko bao giờ fit → timeout vô ích. Retry async backoff dài
      // hơn rồi fail sạch. (Rule Astrolas Team 2026-06-14.)
      if (useAsync && /\b429\b|rate.?limit/i.test(r.error)) {
        if (attempt < MAX_ATTEMPTS) { console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} async 429 → retry async ${attempt + 1}/${MAX_ATTEMPTS} (backoff)`); await new Promise((ok) => setTimeout(ok, 5000)); continue; }
        break;
      }
      if (r.kind === 'fail') break;                       // lỗi cứng (4xx) → ko retry
      // Async POLL-phase timeout/errors: job đã submit + đang chạy. Resubmit job mới = (a) ko kịp
      // trong maxDuration còn lại, (b) bỏ orphan job đang chạy (đốt compute Astrolas). → KHÔNG retry,
      // báo lỗi rõ luôn. Chỉ retry transient ở SUBMIT (nhanh) hoặc 429 (đã xử ở trên).
      if (useAsync && /async poll|poll timeout/i.test(r.error)) { console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} async poll hết budget — ko resubmit (tránh orphan): ${r.error}`); break; }
      if (attempt < MAX_ATTEMPTS) { console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} transient → retry ${attempt + 1}/${MAX_ATTEMPTS}`); await new Promise((ok) => setTimeout(ok, 1500)); }
    }
    return { ok: false, error: lastErr };
  }
  const lowQuality = (d: AstrolasData) => [...(d.voice_signals?.warnings ?? []), ...(d.voice_signals?.quality_flags ?? [])]
    .some((f) => f === 'shallow_reasoning' || f === 'system_message_leak');
  // Depth tier: hard case (self-chart/celeb = chart reading, hay hỏi "khi nào") → 'deep'
  // (Sonnet + timing + patterns + dignities). Casual → 'economy' (mini, rẻ). Override: body.depth.
  const DEPTH_ORDER = ['economy', 'standard', 'deep', 'max'];
  const hardCase = !!selfChart || celebNames.length > 0 || hasChartVision;
  const requestedDepth = (body.depth && DEPTH_ORDER.includes(body.depth)) ? body.depth : (hardCase ? 'deep' : 'economy');

  // ── Astrolas tier-health override ───────────────────────────────────────────
  // UPDATE 2026-06-13: team fix 'standard' + 'deep'. deep/max chậm (>100s) → đi ASYNC
  // (submit+poll, né CF 524) thay vì remap. economy/standard nhanh → sync. KHÔNG remap nữa.
  const BROKEN_DEPTHS: Record<string, string> = {};
  const initialDepth = BROKEN_DEPTHS[requestedDepth] ?? requestedDepth;
  if (initialDepth !== requestedDepth) {
    console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth REMAP ${requestedDepth}→${initialDepth} (engine EMPTY_ANSWER bug né trước)`);
  }

  const markFailed = async (errMsg: string) => {
    // Đánh dấu card để recovery-poll (F5) DỪNG SỚM thay vì chờ tới cap. genWarnings = chỗ rẻ (ko migration).
    try { await db.update(cards).set({ genWarnings: ['gen_failed', errMsg.slice(0, 200)], updatedAt: new Date() }).where(eq(cards.id, cardId)); } catch { /* best-effort */ }
  };

  // Lỗi raw → message thân thiện (rate-limit hay gặp): parse retry_in → phút.
  const friendlyErr = (e: string): string => {
    const m = e.match(/retry_in["\s:]*(\d+)/i);
    if (/\b429\b|rate.?limit/i.test(e)) return `Astrolas đang rate-limit (quota tạm hết)${m ? ` — thử lại sau ~${Math.ceil(Number(m[1]) / 60)} phút` : ' — thử lại sau ít phút'}.`;
    return e;
  };

  const first = await callAstrolas(initialDepth);
  if (!first.ok) { await markFailed(first.error); return NextResponse.json({ ok: false, cardId, error: friendlyErr(first.error), rateLimited: /\b429\b|rate.?limit/i.test(first.error) }, { status: 200 }); }
  let data = first.data;
  let depthUsed = initialDepth;
  // cleanAnswer: bóc <details>/basis/conf + LEADING process-preamble ("I'll work from… Let me
  // pull the interpretations.") → giữ phần trả lời thật. Card 957 = preamble + bài XỊN → strip
  // preamble là ra bài tốt. Dùng CHUNG cho cả isBad lẫn save → check trên bản ĐÃ SẠCH (ko retry thừa).
  const cleanAnswer = (raw?: string): string => {
    let s = (raw ?? '')
      .replace(/<details>[\s\S]*?<\/details>/gi, '')
      .replace(/<\/?(?:details|summary)>/gi, '')
      .replace(/\s*\[conf:\s*[\d.]+\]/gi, '')
      .trim();
    // Strip footer "Astrological basis: …" CHỈ khi nó nằm ở ĐUÔI (>60% bài). BUG 2026-06-16: regex cũ
    // [\s\S]*$ cắt tới hết chuỗi từ LẦN ĐẦU gặp "astrolog basis" → nếu cụm này ở giữa bài (vd heading/câu
    // về "astrological basis") thì xoá sạch phần sau (415 từ → 72 từ). Giờ chỉ cắt khi thực sự là footer cuối.
    const bm = s.match(/\n+\s*\S*\s*Astrolog\w*\s+basis\b/i);
    if (bm && (bm.index ?? 0) > s.length * 0.6) s = s.slice(0, bm.index).trim();
    const head = s.slice(0, 600);
    const mk = [...head.matchAll(/\b(?:STEP\s*\d|Step\s*\d|running steps?|in parallel|batch[-\s]?lookup|building (?:the|your) (?:full )?chart|create_seeding|analyze_house|get_natal|I['’]?ll (?:build|work|start|pull|gather)|working from|let me (?:pull|build|gather|check|start|look)|looking at (?:this|your) chart|before I (?:start|begin|dive)|pull the (?:library|interpretive|relevant))\b/gi)];
    const last = mk.length ? mk[mk.length - 1] : null;
    if (last) {
      const dot = s.indexOf('.', (last.index ?? 0) + last[0].length);
      if (dot > -1 && dot < 700) s = s.slice(dot + 1).trim();
    }
    return s;
  };
  // BAD = check trên bản ĐÃ SẠCH: rỗng sau strip (chỉ-preamble như 956), hoặc kết bằng lời hứa quy trình.
  const isEmpty = (d: AstrolasData) => !d.ok || !cleanAnswer(d.answer_md).trim();
  const looksIncomplete = (t: string): boolean => {
    const s = (t ?? '').trim();
    if (!s) return true;
    if (/\b(?:let me|i'?ll|i will|i'?m going to|let's|now i'?ll|next i'?ll)\s+(?:pull|check|look|build|gather|compute|calculate|run|grab|fetch|review|examine|consult|search|retrieve|construct|map|cross-reference)\b[\s\S]{0,80}[.?!]?\s*$/i.test(s)) return true;
    if (s.length < 250 && /^(?:i'?ll work|working from|let me (?:start|pull|gather|check|build)|first,? i|to answer this,? i)/i.test(s)) return true;
    return false;
  };
  const isBad = (d: AstrolasData) => isEmpty(d) || looksIncomplete(cleanAnswer(d.answer_md));
  const badReason = (d: AstrolasData) => isEmpty(d) ? `EMPTY(code=${(d as { code?: string }).code ?? '?'} log=${(d as { log_id?: string }).log_id ?? '?'})` : 'INCOMPLETE/preamble-leak';

  // Chế độ theo Ý NGƯỜI DÙNG chọn (requestedDepth, TRƯỚC remap):
  //  • 'deep'/'max' = QUALITY → cố lấy bản Opus ĐẦY ĐỦ (retry max, max bấp bênh nhưng khi chạy = xịn).
  //    KHÔNG tự tụt economy (giữ option chất lượng cho user — họ chủ động gen lại nếu muốn).
  //  • 'economy' = nhanh. · Auto (ko chọn) = BALANCED: cố max nhẹ, hỏng mới tụt economy cho "luôn có bản".
  const qualityMode = requestedDepth === 'deep' || requestedDepth === 'max';
  let downgraded = false;
  // TIME_BUDGET = engine nghĩ hết giờ chưa ra chữ (thinking dài + nhiều tool, raw_len 0). Retry 'max'
  // (nghĩ NHIỀU hơn) chỉ tệ hơn + đốt thêm 1 job dài → đừng retry; báo lỗi rõ để user hạ depth/Gen thường.
  const isTimeBudget = (d: AstrolasData) => /TIME_BUDGET|time budget/i.test(`${(d as { code?: string }).code ?? ''} ${d.error ?? ''}`);

  if (qualityMode) {
    // Bấm max = PHẢI ra max. retry max 1 lần (preamble intermittent). KHÔNG tự tụt economy
    // (user ghét bị hạ mini). Vẫn bad → trả lỗi retryable, user chủ động Gen lại (mỗi lần=version).
    let tries = 1;
    while (isBad(data) && tries < 2 && !isTimeBudget(data)) {
      tries++;
      console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} ${badReason(data)} → QUALITY retry max ${tries}/2`);
      const retry = await callAstrolas('max');
      if (retry.ok) { data = retry.data; depthUsed = 'max'; if (!isBad(retry.data)) break; }
    }
  } else {
    // Auto/balanced: shallow flag → thử max 1 lần; bad → economy 1 lần (đảm bảo có bản hoàn chỉnh).
    if (!isBad(data) && depthUsed !== 'max' && lowQuality(data)) {
      const retry = await callAstrolas('max');
      if (retry.ok && !isBad(retry.data)) { data = retry.data; depthUsed = 'max'; }
    }
    if (isBad(data) && depthUsed !== 'economy') {
      console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} ${badReason(data)} → fallback economy (balanced)`);
      const retry = await callAstrolas('economy');
      if (retry.ok && !isBad(retry.data)) { data = retry.data; depthUsed = 'economy'; downgraded = true; }
    }
  }

  if (isBad(data)) {
    const base = isEmpty(data) ? (data.error ?? 'Astrolas empty answer') : 'Astrolas trả nháp/incomplete (engine ko hoàn tất)';
    // Quality mode: engine max bấp bênh → để user CHỦ ĐỘNG gen lại (giữ option chất lượng), ko ép economy.
    const err = isTimeBudget(data)
      ? `⏱ Astrolas ${depthUsed} nghĩ quá lâu chưa ra câu trả lời (TIME_BUDGET) — câu hỏi chart phức tạp. Hạ depth 'eco'/'standard' hoặc dùng ✨ Gen reply thường.`
      : qualityMode ? `${base} · max engine bấp bênh — bấm Gen lại để thử bản chất lượng (mỗi lần = 1 version), hoặc chọn depth 'eco' cho bản nhanh.` : base;
    await markFailed(err);
    return NextResponse.json({ ok: false, cardId, error: err, depthUsed, retryable: qualityMode }, { status: 200 });
  }

  // 5. Save answer + sources + meta vào card.
  // NGUYÊN TẮC ƯU TIÊN CONFIG (proximity-to-gen): format preset (lớp BÀI) đè length-knob humanizer (lớp style)
  // → applyLengthPriority loại one-sentence/two-three khi có preset, kẻo clampDraftLength cắt bài dài engine
  // trả về (bug 2026-06-16: 415 từ → 70 từ). Giữ các knob khác (typo/casual). Xem lib/format-presets.
  const effKnobs = applyLengthPriority(body.humanizer?.knobs, body.formatKey, body.targetWords);
  const _hzOpts = effKnobs.length ? { knobs: effKnobs, intensity: body.humanizer?.intensity } : undefined;
  // TRACER (user yêu cầu 2026-06-16): KHÔNG đoán mò hàm nào cắt output. Mỗi bước hậu xử lý làm ngắn
  // ≥25% → log [TRANSFORM] + đẩy cảnh báo vào genWarnings (hiện ở side panel). engine→save minh bạch.
  const transformWarnings: string[] = [];
  const trace = (label: string, before: string, after: string): string => {
    const b = before.length, a = after.length;
    const drop = b > 0 ? Math.round((1 - a / b) * 100) : 0;
    if (drop >= 25) {
      const w = `⚠️ ${label} cắt ${drop}% (${b}→${a} ký tự)`;
      console.warn(`[astrolas-answer:TRANSFORM] card=${cardId} ${w}`);
      transformWarnings.push(w);
    }
    return after;
  };
  // Pipeline: cleanAnswer (bóc details/conf + preamble) → stripAITells (phẳng markdown) → clamp → typo → human-err.
  const raw = data.answer_md ?? '';
  const s1 = trace('cleanAnswer', raw, cleanAnswer(raw));
  const s2 = trace('stripAITells', s1, stripAITells(s1));
  const s3 = trace('clampDraftLength', s2, clampDraftLength(s2, _hzOpts));
  const s4 = trace('injectTypos', s3, injectTypos(s3, _hzOpts));
  const answerClamped = trace('applyHumanErrors', s4, applyHumanErrors(s4, _hzOpts));
  await db.update(cards).set({
    bodyTarget: answerClamped,
    bodyReview: '',         // Astrolas trả 1 language; nếu cần VN review, dịch sau
    answerSource: 'astrolas',
    answerSources: data.sources ?? [],
    genCostUsd: data.cost_estimate_usd != null ? String(data.cost_estimate_usd) : null,
    genDurationMs: data.duration_ms ?? null,
    genModelUsed: data.voice_signals?.model_used ?? 'astrolas',
    genConfidence: data.voice_signals?.confidence != null ? String(data.voice_signals.confidence) : null,
    genToolsCalled: data.voice_signals?.tools_called ?? [],
    genWarnings: [...(data.voice_signals?.warnings ?? []), ...(data.voice_signals?.quality_flags ?? []), ...transformWarnings],
    genLogId: data.log_id ?? null,
    updatedAt: new Date(),
  }).where(eq(cards.id, cardId));

  return NextResponse.json({
    ok: true,
    cardId,
    cardRef: create.cardRef,
    bodyTarget: answerClamped,
    bodyReview: '',
    downgraded,   // Auto/balanced phải tụt economy (max engine lỗi) → ext cảnh báo để user gen lại nếu cần chất lượng
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
      // Celebrity-astrology transparency: tên đã detect + chart engine grounded.
      celebNamesSent: celebNames.length ? celebNames : null,
      celebEntities: (data.entities_used && data.entities_used.length) ? data.entities_used : null,
      // Depth-tier transparency: mức depth đã dùng + reasoning layers engine chạy + #claim confidence.
      depthUsed,
      depthLayers: data.voice_signals?.depth_layers ?? null,
      claimConfidenceN: Array.isArray(data.voice_signals?.claim_confidence) ? data.voice_signals?.claim_confidence.length : 0,
      selfChartSent: selfChart ? { dob: selfChart.dob, birth_time: selfChart.birth_time ?? null, hasCoords: !!selfChart.birth_coords } : null,
    },
  });
}
