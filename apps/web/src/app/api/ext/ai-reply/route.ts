import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platformAccounts, platforms, projects, contentPieces } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/ext/ai-reply
// Body: { accountId, sourceText, intent? }
// AI generates a reply that matches project voice + persona, suitable for
// the platform context. Used in the extension's warming panel — user pastes
// a post/comment to reply to and gets a context-aware draft.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const body = await req.json() as {
    accountId: number;
    sourceText: string;
    sourceUrl?: string;     // page URL where user is replying — for later tracking
    intent?: string;
    maxLen?: number;
  };

  if (!body.accountId || !body.sourceText?.trim()) {
    return errorResponse('Missing params', 400);
  }

  const [row] = await db
    .select({ account: platformAccounts, platform: platforms, project: projects })
    .from(platformAccounts)
    .leftJoin(platforms, eq(platformAccounts.platformKey, platforms.key))
    .leftJoin(projects, eq(platformAccounts.projectId, projects.id))
    .where(eq(platformAccounts.id, body.accountId))
    .limit(1);

  if (!row || !row.platform) return errorResponse('Account not found', 404);

  const project = row.project;
  const acc = row.account;
  const platform = row.platform;

  // Use account.persona[bio] override if user edited; else project.bio
  const personaJson = (acc.persona as Record<string, string>) ?? {};
  const effectiveBio = personaJson['bio'] || project?.bio || '';

  const contextLines = [
    `Platform: ${platform.label}`,
    `My handle on this platform: ${acc.handle ?? '(unset)'}`,
    project ? `Project: ${project.name}` : null,
    project?.oneLiner ? `My one-liner: ${project.oneLiner}` : null,
    effectiveBio ? `My bio: ${effectiveBio}` : null,
    project?.persona ? `My voice/tone: ${project.persona}` : null,
    project?.website ? `My website: ${project.website}` : null,
    project?.hashtags ? `My common hashtags: ${project.hashtags}` : null,
  ].filter(Boolean).join('\n');

  const sysPrompt = `You write a SHORT, AUTHENTIC reply on a social platform as the persona below.
Goal: warm up the account by genuinely engaging with the source post — never spam, never sales-y.

STRICT RULES:
- Output ONLY the reply text. No quotes, labels, or commentary.
- Sound like a real person, not a brand. Match the persona's voice.
- 1-3 sentences max unless intent says otherwise. Keep it punchy.
- Add value: agree+extend, share related experience, ask a thoughtful question. NOT generic praise.
- Do NOT plug the website/product unless the source explicitly asks. Soft mentions only when natural.
- Match the platform's culture (Reddit = casual, conversational; LinkedIn = professional; Twitter = concise).
- Match the source language.`;

  const userPrompt = `# My profile context
${contextLines}

# Source post/comment to reply to
${body.sourceText}

# Intent / approach
${body.intent || '(none — just engage authentically)'}

# Task
Write the reply. Output ONLY the reply text.`;

  try {
    const ai = getOpenAI();
    if (!ai) return errorResponse('AI client unavailable', 503);

    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.8,
      max_tokens: 350,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let text = completion.choices[0]?.message?.content?.trim() ?? '';
    text = text.replace(/^["'`]|["'`]$/g, '').trim();

    if (!text) return errorResponse('Empty AI response', 502);

    // Save to content_pieces as a draft reply for later tracking + metrics.
    let contentPieceId: number | null = null;
    if (project) {
      try {
        const slug = `reply-${Date.now()}-${acc.id}`;
        const titleSnip = body.sourceText.slice(0, 60).replace(/\s+/g, ' ').trim();
        const [inserted] = await db.insert(contentPieces).values({
          projectId: project.id,
          slug,
          title: `Reply: ${titleSnip}${body.sourceText.length > 60 ? '…' : ''}`,
          channel: 'reply',
          persona: acc.handle ?? '',
          subject: body.sourceUrl ?? '',
          bodyMd: text,
          status: 'draft',
          aiNotes: [{
            ts: new Date().toISOString(),
            kind: 'ext-reply-gen',
            accountId: acc.id,
            platform: platform.label,
            sourceUrl: body.sourceUrl ?? null,
            sourceText: body.sourceText,
            intent: body.intent ?? null,
            model: DEFAULT_MODEL,
          }],
          tags: ['warmup', 'reply', 'ext', `account:${acc.id}`, `platform:${platform.key}`],
        }).returning({ id: contentPieces.id });
        contentPieceId = inserted?.id ?? null;
      } catch (e) {
        console.warn('[ai-reply] content_pieces insert failed:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      text,
      contentPieceId,
      meta: { model: DEFAULT_MODEL, length: text.length },
    });
  } catch (e) {
    return errorResponse((e as Error).message, 500);
  }
}
