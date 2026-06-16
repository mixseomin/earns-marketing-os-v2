import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platformAccounts, platforms, projects, projectAccounts, habitats, contentPieces, contentPillars } from '@mos2/db';
import { and, eq, ilike } from 'drizzle-orm';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { getProjectPost } from '@/lib/ai/project-post-facts';
import { estimateCostUsd } from '@/lib/ai/cost';
import { errorResponse } from '@/lib/ext-route';
import { FORMAT_PRESETS_BY_KEY } from '@/lib/format-presets';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Platform-format spec for AI structured output.
// `bodyHardLimit` = enforced by platform (e.g. Twitter 280). Set only when
// platform actually rejects longer text. Other platforms use soft suggestion
// in `notes` only — user's targetLength wins when supplied.
type PostFormat = {
  hasTitle: boolean;
  titleMaxLen?: number;
  bodyHardLimit?: number;
  notes: string;
};
const FORMAT_BY_HOSTNAME: Array<[RegExp, PostFormat]> = [
  [/reddit\.com$/, { hasTitle: true, titleMaxLen: 300, notes: 'Reddit text post: catchy title + markdown body. No external links unless allowed by sub.' }],
  [/(twitter|x)\.com$/, { hasTitle: false, bodyHardLimit: 280, notes: 'Single tweet ≤280 chars HARD. Hook in first line. 0-2 hashtags max.' }],
  [/linkedin\.com$/, { hasTitle: false, bodyHardLimit: 3000, notes: 'LinkedIn long-form post (≤3000 chars). Hook + structured sections + soft CTA.' }],
  [/threads\.net$/, { hasTitle: false, bodyHardLimit: 500, notes: 'Threads post ≤500 chars HARD. Conversational, plain text.' }],
  [/substack\.com$/, { hasTitle: true, titleMaxLen: 100, notes: 'Substack headline + article body (markdown). Long-form OK.' }],
  [/news\.ycombinator\.com$/, { hasTitle: true, titleMaxLen: 80, notes: 'HN: factual title (no editorializing) + optional text body. Body can be long.' }],
  [/producthunt\.com$/, { hasTitle: false, notes: 'PH discussion thread / Show post — body length flexible (often 200-800 words for substantive posts).' }],
];
function pickFormat(host: string): PostFormat {
  for (const [re, f] of FORMAT_BY_HOSTNAME) if (re.test(host)) return f;
  return { hasTitle: false, notes: 'Generic platform post — length flexible.' };
}

// POST /api/ext/ai-post
// Body: { accountId, topic, referenceUrl?, style?, hostHostname }
// Generates a NEW post (not reply) using project voice + habitat rules.
// Saves draft to content_pieces. Returns ID for later mark-posted flow.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const body = await req.json() as {
    accountId: number;
    projectId?: string;   // gen-target project (chọn ở composer) — voice/facts theo project NÀY
    pillarId?: number;    // content pillar (nhóm chủ đề) — bám khung nội dung
    topic: string;
    referenceUrl?: string;
    style?: string;
    hostHostname: string;
    formatKey?: string;   // preset loại nội dung (lib/format-presets); words→targetWords, hintEn→structure note
    targetWords?: number;
    model?: string;
  };

  // OpenAI-only allowlist for now (only OpenAI client is wired).
  // To allow Anthropic/Google/xAI: add their clients in @/lib/ai/* + dispatch here.
  const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini'];
  const useModel = body.model && ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;

  if (!body.accountId || !body.topic?.trim()) {
    return errorResponse('Missing accountId or topic', 400);
  }

  const [row] = await db
    .select({ account: platformAccounts, platform: platforms, project: projects })
    .from(platformAccounts)
    .leftJoin(platforms, eq(platformAccounts.platformKey, platforms.key))
    .leftJoin(projects, eq(platformAccounts.projectId, projects.id))
    .where(eq(platformAccounts.id, body.accountId))
    .limit(1);

  if (!row || !row.platform) return errorResponse('Account not found', 404);

  // Project gen-target: ưu tiên projectId truyền vào (composer chọn) — validate account
  // THAM GIA project đó (junction) → dùng voice/facts/persona của project NÀY, không leak primary.
  let project = row.project;
  if (body.projectId && body.projectId !== project?.id) {
    const [chk] = await db.select({ pid: projectAccounts.projectId })
      .from(projectAccounts)
      .where(and(eq(projectAccounts.accountId, body.accountId), eq(projectAccounts.projectId, body.projectId)))
      .limit(1);
    if (chk?.pid) {
      const [pj] = await db.select().from(projects).where(eq(projects.id, body.projectId)).limit(1);
      if (pj) project = pj;
    }
  }
  const acc = row.account;
  const platform = row.platform;
  const personaJson = (acc.persona as Record<string, string>) ?? {};
  const effectiveBio = personaJson['bio'] || project?.bio || '';

  // Match habitat by hostname (project-scoped) for community rules
  let habitat: typeof habitats.$inferSelect | null = null;
  if (project && body.hostHostname) {
    const [h] = await db.select().from(habitats)
      .where(ilike(habitats.url, `%${body.hostHostname}%`))
      .limit(1);
    if (h && h.projectId === project.id) habitat = h;
  }

  const format = pickFormat(body.hostHostname || '');

  // Project-specific REAL DATA + FIX (data-backed): HyperJournal → ví thật + ép link /w/<addr>;
  // project khác → provider riêng (single source ở lib/ai/project-post-facts). Rỗng = generic LLM.
  const projectPost = project ? await getProjectPost(project.id) : { facts: '' };
  const projectFacts = projectPost.facts;

  // Content pillar (nhóm chủ đề) — bài bám khung nội dung của pillar được chọn.
  let pillarBlock = '';
  if (body.pillarId && project) {
    const [pl] = await db.select({ name: contentPillars.name, tagline: contentPillars.tagline, positioningMd: contentPillars.positioningMd, keyMessages: contentPillars.keyMessages, voiceNotes: contentPillars.voiceNotes })
      .from(contentPillars).where(and(eq(contentPillars.id, body.pillarId), eq(contentPillars.projectId, project.id))).limit(1);
    if (pl) {
      const km = Array.isArray(pl.keyMessages) ? (pl.keyMessages as string[]) : [];
      pillarBlock = `\nCONTENT PILLAR (bài thuộc nhóm chủ đề này — BÁM khung):\n- Pillar: ${pl.name}${pl.tagline ? ' — ' + pl.tagline : ''}`
        + (km.length ? `\n- Angles: ${km.join('; ')}` : '')
        + (pl.positioningMd ? `\n- Positioning: ${String(pl.positioningMd).slice(0, 400)}` : '')
        + (pl.voiceNotes ? `\n- Voice notes: ${pl.voiceNotes}` : '');
    }
  }

  // Reference URL — fetch first 4KB of text content
  let referenceSummary = '';
  if (body.referenceUrl?.trim()) {
    try {
      const res = await fetch(body.referenceUrl.trim(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Composer/1.0)' },
        signal: AbortSignal.timeout(6000),
      });
      const html = await res.text();
      // Strip HTML tags crudely
      referenceSummary = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
                              .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
    } catch { referenceSummary = ''; }
  }

  // Auto-grounding: bài gốc thường KHÔNG có referenceUrl → fetch trang project để có
  // chất liệu THẬT (brand/deal/tên cụ thể) → gpt viết concrete thay vì chung chung.
  let projectSiteText = '';
  if (!referenceSummary && project?.website) {
    try {
      const res = await fetch(project.website, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Post/1.0)' }, signal: AbortSignal.timeout(6000) });
      const html = await res.text();
      projectSiteText = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    } catch { projectSiteText = ''; }
  }

  const habitatRules: string[] = [];
  if (habitat) {
    if (habitat.postingRules) habitatRules.push(`Posting rules: ${habitat.postingRules}`);
    if ((habitat.forbiddenTopics as string[])?.length) habitatRules.push(`Forbidden topics: ${(habitat.forbiddenTopics as string[]).join(', ')}`);
    if ((habitat.dominantTopics as string[])?.length) habitatRules.push(`Community focus: ${(habitat.dominantTopics as string[]).join(', ')}`);
    if (habitat.linksAllowedAfter) habitatRules.push(`Links allowed after: ${habitat.linksAllowedAfter}`);
    if (habitat.modStrictness) habitatRules.push(`Mod strictness: ${habitat.modStrictness}`);
  }

  // Resolve target length: formatKey preset (authority) → words; fallback body.targetWords. HARD limit always wins.
  // Default ~120 words for short platforms (Twitter/Threads), else flexible.
  const fmtPreset = body.formatKey ? FORMAT_PRESETS_BY_KEY[body.formatKey] : undefined;
  const presetWords = fmtPreset?.words ?? (typeof body.targetWords === 'number' ? body.targetWords : 0);
  const userTargetWords = presetWords > 0 ? Math.min(2000, presetWords) : null;
  const targetWords = userTargetWords ?? null;
  const approxChars = targetWords ? targetWords * 6 : null;  // ~6 chars/word incl. space

  const lengthDirective = (() => {
    if (format.bodyHardLimit) {
      const lim = format.bodyHardLimit;
      // targetWords muốn dài hơn limit → LẤP ĐẦY space (đừng cụt), pack specifics.
      if (targetWords && approxChars && approxChars >= lim) {
        return `Write a FULL, rich post that USES MOST of the ${lim} chars (aim ${lim - 30}-${lim} chars). HARD max ${lim}. Pack 2-3 concrete specifics; do NOT stop early or leave it abrupt.`;
      }
      if (targetWords && approxChars) {
        return `Aim ~${targetWords} words (~${approxChars} chars, target ${Math.max(0, approxChars - 25)}-${Math.min(lim, approxChars + 25)}). HARD max ${lim}.`;
      }
      return `Aim ${Math.round(lim * 0.75)}-${lim} chars (use the space, pack specifics). HARD max ${lim}.`;
    }
    return targetWords
      ? `Aim ~${targetWords} words. Hit close to this length WITH substance (real specifics), don't pad fluff.`
      : 'Body length flexible — match topic depth.';
  })();

  const sysPrompt = `You write an ORIGINAL post (not a reply) on a social platform.
Output STRICT JSON: { "title": "...", "body": "...", "hashtags": ["..."] }
- "title": ${format.hasTitle ? `required string ≤${format.titleMaxLen ?? 300} chars` : 'omit (use empty string "")'}
- "body": required, PLAIN TEXT only (NO markdown — no [text](url), no **bold**, no #). Links as bare URLs. ${lengthDirective}${fmtPreset?.hintEn ? ` FORMAT: ${fmtPreset.hintEn}` : ''}
- "hashtags": array of strings without # prefix; 0-3 items; omit on platforms where hashtags aren't customary

PLATFORM FORMAT NOTES:
${format.notes}

VOICE: persona "${project?.persona || 'a real person who genuinely uses/runs this, casual and specific'}". Write in FIRST PERSON, like a human typing fast. Sound human, not corporate, not a brand account.
DO: open with a SPECIFIC concrete detail (a named brand/product, a real number, a specific situation) from the context below — never a generic announcement. One clear idea. Invite a real reply.
${projectFacts ? 'DATA-BACKED (BẮT BUỘC): phần "# REAL ... DATA" bên dưới là số liệu THẬT — bài PHẢI dẫn các thực thể thật trong đó (tên/địa chỉ + chỉ số + LINK), chọn cái post-worthy nhất cho chủ đề. TUYỆT ĐỐI không bịa tên/số/ví ngoài danh sách.\n' : ''}DON'T (these make it boring/AI-sounding — AVOID): generic openers ("Attention", "Calling all", "Did you know", "Looking to..."), "let's ... together", "save smart", vague praise, hashtag-stuffing, emoji at the start, "More info:" + link dumps, em-dashes (—), markdown, sales-pitch tone.
${project?.contentStrategy ? `\nCONTENT STRATEGY / RULES (project — BÁM SÁT khi viết bài gốc):\n${project.contentStrategy}` : ''}${pillarBlock}
${habitatRules.length > 0 ? '\nCOMMUNITY HARD RULES (violation = post deleted):\n' + habitatRules.map((r) => `- ${r}`).join('\n') : ''}
Soft self-promo (link to website) ONLY if community rules allow. Otherwise pure value content.`;

  const contextLines = [
    `Platform: ${platform.label}`,
    `My handle: ${acc.handle ?? '(unset)'}`,
    project ? `Project: ${project.name}` : null,
    project?.oneLiner ? `One-liner: ${project.oneLiner}` : null,
    effectiveBio ? `Bio: ${effectiveBio}` : null,
    project?.website ? `Website: ${project.website}` : null,
    project?.hashtags ? `Common hashtags: ${project.hashtags}` : null,
    habitat ? `Posting in: ${habitat.name} (${habitat.url ?? body.hostHostname})` : `Page: ${body.hostHostname}`,
  ].filter(Boolean).join('\n');

  const userPrompt = `# My profile context
${contextLines}

# Topic / what I want to share
${body.topic}

${referenceSummary ? `# Reference material (extracted from URL)\n${referenceSummary.slice(0, 2500)}\n\n` : ''}${projectSiteText ? `# REAL CONTEXT — what this project actually offers (mine for SPECIFICS: real brand/product names, categories, numbers. Mention concrete ones, do NOT invent.)\n${projectSiteText}\n\n` : ''}${projectFacts ? projectFacts + '\n\n' : ''}# Style / approach
${body.style || '(natural, specific, first-person)'}

# Task
Write the post — lead with a concrete specific, not a generic announcement. Output STRICT JSON only.`;

  let parsed: { title?: string; body: string; hashtags?: string[] };
  let promptTok = 0, complTok = 0;   // gom usage qua các lần gọi → ước tính cost lưu vào aiNotes
  try {
    const ai = getOpenAI();
    if (!ai) return errorResponse('AI client unavailable', 503);

    // Budget tokens to allow long-form when user asks for it.
    // Rough rule: 1 word ≈ 1.5 tokens; cap at 4000.
    const tokenBudget = Math.min(4000, Math.max(1200, (targetWords ?? 200) * 2));
    const completion = await ai.chat.completions.create({
      model: useModel,
      temperature: 0.75,
      max_tokens: tokenBudget,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    promptTok += completion.usage?.prompt_tokens ?? 0; complTok += completion.usage?.completion_tokens ?? 0;
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    parsed = JSON.parse(raw);
    if (!parsed.body) throw new Error('No body in AI response');
  } catch (e) {
    return errorResponse(`AI error: ${(e as Error).message}`, 500);
  }

  // FIX deterministic per-project (vd HJ ép link /w/<addr> đúng ví được dẫn) — KHÔNG tin LLM tự đúng.
  if (projectPost.fix && parsed.body) {
    try { parsed.body = projectPost.fix(parsed.body); } catch { /* keep original */ }
  }

  // Strip markdown ([text](url)→url, **bold**, #, `code`) + em-dash → '-' (human-voice, X plain).
  const cleanPost = (s: string) => s
    .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '$2')   // [label](url) → url (X ko render md link)
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '').replace(/\s*[—–]\s*/g, ' - ').replace(/[ \t]{2,}/g, ' ').trim();
  if (parsed.body) parsed.body = cleanPost(parsed.body);
  if (parsed.title) parsed.title = cleanPost(parsed.title);

  // ÉP HARD limit (vd X 280) — model hay overshoot. Shorten 1 lần (giữ hook+brand+CTA),
  // fallback truncate ở biên từ. KHÔNG để bài vượt quy định.
  if (format.bodyHardLimit && parsed.body && parsed.body.length > format.bodyHardLimit) {
    const lim = format.bodyHardLimit;
    try {
      const ai2 = getOpenAI();
      if (ai2) {
        const comp = await ai2.chat.completions.create({
          model: useModel, temperature: 0.4, max_tokens: 500, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `Rewrite the social post to fit ≤${lim} characters HARD (count chars, not words). Keep the hook, the real brand/entity mention, and the CTA/link. Cut filler, not substance. No em-dashes, no AI tells. Output STRICT JSON {"body":"..."}.` },
            { role: 'user', content: parsed.body },
          ],
        });
        promptTok += comp.usage?.prompt_tokens ?? 0; complTok += comp.usage?.completion_tokens ?? 0;
        const r2 = JSON.parse(comp.choices[0]?.message?.content?.trim() ?? '{}') as { body?: string };
        if (r2.body && r2.body.trim()) parsed.body = r2.body.trim();
      }
    } catch { /* fall through to truncate */ }
    if (parsed.body.length > lim) {
      let t = parsed.body.slice(0, lim);
      const cut = t.lastIndexOf(' ');
      if (cut > lim * 0.6) t = t.slice(0, cut);
      parsed.body = t.replace(/[\s,;:.!-]+$/, '').trim();
    }
  }

  // Save draft to content_pieces
  const costUsd = estimateCostUsd(useModel, { prompt_tokens: promptTok, completion_tokens: complTok });
  let contentPieceId: number | null = null;
  if (project) {
    try {
      const slug = `post-${Date.now()}-${acc.id}`;
      const titleSnip = (parsed.title || parsed.body).slice(0, 80).replace(/\s+/g, ' ').trim();
      const [inserted] = await db.insert(contentPieces).values({
        projectId: project.id,
        slug,
        title: parsed.title || `Post: ${titleSnip}`,
        channel: platform.key,
        persona: acc.handle ?? '',
        subject: body.referenceUrl ?? '',
        bodyMd: parsed.body,
        status: 'draft',
        aiNotes: [{
          ts: new Date().toISOString(),
          kind: 'ext-post-gen',
          accountId: acc.id,
          pillarId: body.pillarId ?? null,
          platform: platform.label,
          host: body.hostHostname,
          habitatId: habitat?.id ?? null,
          habitatName: habitat?.name ?? null,
          topic: body.topic,
          referenceUrl: body.referenceUrl ?? null,
          style: body.style ?? null,
          format,
          aiTitle: parsed.title ?? null,
          aiHashtags: parsed.hashtags ?? [],
          model: useModel,
          costUsd,
          tokens: { prompt: promptTok, completion: complTok },
        }],
        tags: [
          'post', 'ext',
          `account:${acc.id}`,
          `platform:${platform.key}`,
          ...(habitat ? [`habitat:${habitat.id}`] : []),
          ...(parsed.hashtags ?? []).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '')).filter(Boolean).slice(0, 5),
        ],
      }).returning({ id: contentPieces.id });
      contentPieceId = inserted?.id ?? null;
    } catch (e) {
      console.warn('[ai-post] content_pieces insert failed:', e);
    }
  }

  return NextResponse.json({
    ok: true,
    contentPieceId,
    title: parsed.title ?? '',
    body: parsed.body,
    hashtags: parsed.hashtags ?? [],
    model: useModel,
    cost: costUsd,
    // Compat shape for extension UI char counter
    format: {
      hasTitle: format.hasTitle,
      titleMaxLen: format.titleMaxLen ?? null,
      bodyMaxLen: format.bodyHardLimit ?? null,
      notes: format.notes,
    },
    targetWords,
    habitat: habitat ? { id: habitat.id, name: habitat.name, ruleCount: habitatRules.length } : null,
  });
}
