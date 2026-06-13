import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platformAccounts, platforms, projects, projectAccounts, habitats, contentPieces, contentPillars } from '@mos2/db';
import { and, eq, ilike } from 'drizzle-orm';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { getProjectPost } from '@/lib/ai/project-post-facts';

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

  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const body = await req.json() as {
    accountId: number;
    projectId?: string;   // gen-target project (chọn ở composer) — voice/facts theo project NÀY
    pillarId?: number;    // content pillar (nhóm chủ đề) — bám khung nội dung
    topic: string;
    referenceUrl?: string;
    style?: string;
    hostHostname: string;
    targetWords?: number;
    model?: string;
  };

  // OpenAI-only allowlist for now (only OpenAI client is wired).
  // To allow Anthropic/Google/xAI: add their clients in @/lib/ai/* + dispatch here.
  const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini'];
  const useModel = body.model && ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;

  if (!body.accountId || !body.topic?.trim()) {
    return NextResponse.json({ ok: false, error: 'Missing accountId or topic' }, { status: 400 });
  }

  const [row] = await db
    .select({ account: platformAccounts, platform: platforms, project: projects })
    .from(platformAccounts)
    .leftJoin(platforms, eq(platformAccounts.platformKey, platforms.key))
    .leftJoin(projects, eq(platformAccounts.projectId, projects.id))
    .where(eq(platformAccounts.id, body.accountId))
    .limit(1);

  if (!row || !row.platform) return NextResponse.json({ ok: false, error: 'Account not found' }, { status: 404 });

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

  const habitatRules: string[] = [];
  if (habitat) {
    if (habitat.postingRules) habitatRules.push(`Posting rules: ${habitat.postingRules}`);
    if ((habitat.forbiddenTopics as string[])?.length) habitatRules.push(`Forbidden topics: ${(habitat.forbiddenTopics as string[]).join(', ')}`);
    if ((habitat.dominantTopics as string[])?.length) habitatRules.push(`Community focus: ${(habitat.dominantTopics as string[]).join(', ')}`);
    if (habitat.linksAllowedAfter) habitatRules.push(`Links allowed after: ${habitat.linksAllowedAfter}`);
    if (habitat.modStrictness) habitatRules.push(`Mod strictness: ${habitat.modStrictness}`);
  }

  // Resolve target length: user input → soft target; HARD limit always wins.
  // Default ~120 words for short platforms (Twitter/Threads), else flexible.
  const userTargetWords = typeof body.targetWords === 'number' && body.targetWords > 0 ? Math.min(2000, body.targetWords) : null;
  const targetWords = userTargetWords ?? null;
  const approxChars = targetWords ? targetWords * 6 : null;  // ~6 chars/word incl. space

  const lengthDirective = (() => {
    if (format.bodyHardLimit) {
      if (targetWords && approxChars && approxChars > format.bodyHardLimit) {
        return `Target ${targetWords} words BUT platform HARD limit is ${format.bodyHardLimit} chars — fit within ${format.bodyHardLimit} chars (truncate scope to fit).`;
      }
      return targetWords
        ? `Target ~${targetWords} words (~${approxChars} chars), HARD max ${format.bodyHardLimit} chars.`
        : `Body ≤${format.bodyHardLimit} chars (HARD limit).`;
    }
    return targetWords
      ? `Target ~${targetWords} words. Hit close to this length, don't pad fluff.`
      : 'Body length flexible — match topic depth.';
  })();

  const sysPrompt = `You write an ORIGINAL post (not a reply) on a social platform.
Output STRICT JSON: { "title": "...", "body": "...", "hashtags": ["..."] }
- "title": ${format.hasTitle ? `required string ≤${format.titleMaxLen ?? 300} chars` : 'omit (use empty string "")'}
- "body": required, plain text or markdown. ${lengthDirective}
- "hashtags": array of strings without # prefix; 0-3 items; omit on platforms where hashtags aren't customary

PLATFORM FORMAT NOTES:
${format.notes}

VOICE: persona "${project?.persona || 'authentic indie maker'}". Match it. Sound human, not corporate.
DO: hook attention, share a concrete insight or experience, invite engagement.
${projectFacts ? 'DATA-BACKED (BẮT BUỘC): phần "# REAL ... DATA" bên dưới là số liệu THẬT — bài PHẢI dẫn các thực thể thật trong đó (tên/địa chỉ + chỉ số + LINK), chọn cái post-worthy nhất cho chủ đề. TUYỆT ĐỐI không bịa tên/số/ví ngoài danh sách.\n' : ''}DON'T: use AI tells ("Let's dive in", "It's important to note"), em-dashes (—), generic praise, sales pitches.
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

${referenceSummary ? `# Reference material (extracted from URL)\n${referenceSummary.slice(0, 2500)}\n\n` : ''}${projectFacts ? projectFacts + '\n\n' : ''}# Style / approach
${body.style || '(natural)'}

# Task
Write the post. Output STRICT JSON only.`;

  let parsed: { title?: string; body: string; hashtags?: string[] };
  try {
    const ai = getOpenAI();
    if (!ai) return NextResponse.json({ ok: false, error: 'AI client unavailable' }, { status: 503 });

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

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    parsed = JSON.parse(raw);
    if (!parsed.body) throw new Error('No body in AI response');
  } catch (e) {
    return NextResponse.json({ ok: false, error: `AI error: ${(e as Error).message}` }, { status: 500 });
  }

  // FIX deterministic per-project (vd HJ ép link /w/<addr> đúng ví được dẫn) — KHÔNG tin LLM tự đúng.
  if (projectPost.fix && parsed.body) {
    try { parsed.body = projectPost.fix(parsed.body); } catch { /* keep original */ }
  }

  // Save draft to content_pieces
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
