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
  const authErr = checkAuth(req);
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

  const questionBodyEnriched = [
    `[STRICT OUTPUT LANGUAGE: ${langName} (${habitatLang}) — MUST reply ENTIRELY in ${langName}. Brief context below may be in Vietnamese (operator notes) but YOUR ANSWER must be ${langName}. DO NOT mix languages.]`,
    '',
    questionContent,
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
    // ❌ KHÔNG inject anti-AI block + 🧬 humanizer rules (typo guide / "60 từ" / kết "?!")
    // vào question_body cho Astrolas: đó là writer-mechanics → engine reasoning hiểu nhầm
    // phải viết NGẮN kiểu Reddit reply thay vì grounded reading (Astrolas báo 2026-06-11).
    // Humanize chạy Ở OUTPUT (stripAITells/injectTypos/applyHumanErrors post-process) — input sạch.
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
    // llm_config gắn per-call ở callAstrolas (model escalation) — KHÔNG để ở base.
    // Celebrity-astrology angle: chỉ khi có tên public-figure (engine resolve theo tên).
    ...(celebNames.length ? { angle: 'celebrity_astrology' } : {}),
    // entities = querent self-chart (dob/coords từ ảnh) + celeb names. Engine dựng chart
    // từ dob (self) hoặc resolve tên (celeb); reject fake ⇒ không bịa cung.
    ...(entities.length ? { entities } : {}),
  };

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
  const astrolasEndpoint = `${apiUrl.replace(/\/+$/, '')}/api/v1/qa/answer`;
  const astrolasAuth = `Bearer ${apiKey}`;
  async function callAstrolas(depth: string): Promise<{ ok: true; data: AstrolasData } | { ok: false; error: string }> {
    // depth = tier (model + reasoning layers tự điều chỉnh). llm_config (nếu ext gửi) override model của tier.
    const payload = { ...astrolasPayload, depth, ...(body.llmConfig ? { llm_config: body.llmConfig } : {}) };
    const t0 = Date.now();
    console.log(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} → CALL Astrolas (${astrolasEndpoint})`);
    let res: Response;
    try {
      res = await fetch(astrolasEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': astrolasAuth },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(240000),  // 240s — deep/max (Sonnet/Opus) có thể >120s; nginx đã nâng 300s
      });
    } catch (e) {
      console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} TIMEOUT/NET sau ${Date.now() - t0}ms: ${(e as Error).message}`);
      return { ok: false, error: `Astrolas API timeout/network (${Math.round((Date.now() - t0) / 1000)}s): ${(e as Error).message}` };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} HTTP ${res.status} sau ${Date.now() - t0}ms`);
      return { ok: false, error: `Astrolas API ${res.status}: ${errText.slice(0, 300)}` };
    }
    console.log(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depth} OK sau ${Date.now() - t0}ms`);
    return { ok: true, data: await res.json() as AstrolasData };
  }
  const lowQuality = (d: AstrolasData) => [...(d.voice_signals?.warnings ?? []), ...(d.voice_signals?.quality_flags ?? [])]
    .some((f) => f === 'shallow_reasoning' || f === 'system_message_leak');
  // Depth tier: hard case (self-chart/celeb = chart reading, hay hỏi "khi nào") → 'deep'
  // (Sonnet + timing + patterns + dignities). Casual → 'economy' (mini, rẻ). Override: body.depth.
  const DEPTH_ORDER = ['economy', 'standard', 'deep', 'max'];
  const hardCase = !!selfChart || celebNames.length > 0 || hasChartVision;
  const initialDepth = (body.depth && DEPTH_ORDER.includes(body.depth)) ? body.depth : (hardCase ? 'deep' : 'economy');

  const markFailed = async (errMsg: string) => {
    // Đánh dấu card để recovery-poll (F5) DỪNG SỚM thay vì chờ tới cap. genWarnings = chỗ rẻ (ko migration).
    try { await db.update(cards).set({ genWarnings: ['gen_failed', errMsg.slice(0, 200)], updatedAt: new Date() }).where(eq(cards.id, cardId)); } catch { /* best-effort */ }
  };

  const first = await callAstrolas(initialDepth);
  if (!first.ok) { await markFailed(first.error); return NextResponse.json({ ok: false, cardId, error: first.error }, { status: 200 }); }
  let data = first.data;
  let depthUsed = initialDepth;
  const isEmpty = (d: AstrolasData) => !d.ok || !d.answer_md;
  // Escalate-on-flag: quality thấp → nâng ÍT NHẤT 'deep'/'max'. 1 lần.
  if (data.ok && data.answer_md && depthUsed !== 'max' && lowQuality(data)) {
    const target = DEPTH_ORDER.indexOf(depthUsed) < DEPTH_ORDER.indexOf('deep') ? 'deep' : 'max';
    const retry = await callAstrolas(target);
    if (retry.ok && retry.data.ok && retry.data.answer_md) { data = retry.data; depthUsed = target; }
  }
  // Empty answer (engine trả OK nhưng answer_md rỗng — lỗi engine hay gặp ở tier thấp) →
  // tự nâng 1 tier (tới max) 1 LẦN để cứu (đỡ phí 70s vừa chạy). Log full để báo engine team.
  if (isEmpty(data)) {
    console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${depthUsed} EMPTY → escalate. resp keys=${Object.keys(data).join(',')} error=${JSON.stringify(data.error ?? null)} warnings=${JSON.stringify(data.voice_signals?.warnings ?? [])}`);
    if (depthUsed !== 'max') {
      const idx = DEPTH_ORDER.indexOf(depthUsed);
      const target = DEPTH_ORDER[Math.min(idx + 1, DEPTH_ORDER.length - 1)];
      const retry = await callAstrolas(target);
      if (retry.ok && !isEmpty(retry.data)) { data = retry.data; depthUsed = target; }
      else if (retry.ok) console.warn(`[astrolas-answer extv=${extVer}] card=${cardId} depth=${target} VẪN EMPTY error=${JSON.stringify(retry.data.error ?? null)}`);
    }
  }

  if (isEmpty(data)) {
    const err = data.error ?? 'Astrolas trả empty answer (engine OK nhưng answer_md rỗng)';
    await markFailed(err);
    return NextResponse.json({ ok: false, cardId, error: err, depthUsed }, { status: 200 });
  }

  // 5. Save answer + sources + meta vào card. Cắt cứng độ dài nếu bật chip 1-câu/2-3-câu.
  const _hzOpts = body.humanizer && Array.isArray(body.humanizer.knobs) && body.humanizer.knobs.length
    ? { knobs: body.humanizer.knobs, intensity: body.humanizer.intensity } : undefined;
  // Astrolas default_chat hay leak 2 thứ vào answer_md (đều ko nên đăng):
  //  (a) appendix "🔮 Astrolog* basis (verify)" — citation operator-verify (dạng <details> HOẶC plain header)
  //  (b) thinking-preamble ở đầu: "STEP 1… running Steps 2-5 in parallel… batch lookup…"
  // → bóc cả 2. (Đã báo Astrolas: answer_md nên CHỈ là reply.)
  let answerClean = data.answer_md
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .replace(/\n+\s*\S*\s*Astrolog\w*\s+basis\b[\s\S]*$/i, '')   // appendix basis tới hết
    .replace(/<\/?(?:details|summary)>/gi, '')
    .replace(/\s*\[conf:\s*[\d.]+\]/gi, '')                       // per-claim conf tag (max tier) → đã ở claim_confidence[]
    .trim();
  // Thinking-preamble: cắt từ đầu tới hết câu chứa marker thinking CUỐI CÙNG (trong ~500 ký tự đầu).
  const head = answerClean.slice(0, 500);
  const mk = [...head.matchAll(/\b(?:STEP\s*\d|Step\s*\d|running steps?|in parallel|batch[-\s]?lookup|building (?:the|your) (?:full )?chart|create_seeding|analyze_house|get_natal|I['’]?ll build)\b/gi)];
  const last = mk.length ? mk[mk.length - 1] : null;
  if (last) {
    const dot = answerClean.indexOf('.', (last.index ?? 0) + last[0].length);
    if (dot > -1 && dot < 600) answerClean = answerClean.slice(dot + 1).trim();
  }
  // stripAITells TRƯỚC: Astrolas trả answer_md = markdown (## > * - — ❌) → lộ AI. Phẳng hoá thành prose.
  const answerClamped = applyHumanErrors(injectTypos(clampDraftLength(stripAITells(answerClean), _hzOpts), _hzOpts), _hzOpts);
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
    genWarnings: [...(data.voice_signals?.warnings ?? []), ...(data.voice_signals?.quality_flags ?? [])],
    genLogId: data.log_id ?? null,
    updatedAt: new Date(),
  }).where(eq(cards.id, cardId));

  return NextResponse.json({
    ok: true,
    cardId,
    cardRef: create.cardRef,
    bodyTarget: answerClamped,
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
