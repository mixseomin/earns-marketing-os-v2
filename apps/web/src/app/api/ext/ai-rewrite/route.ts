import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platformAccounts, platforms, projects } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { getEffectiveSignupFields } from '@/lib/actions/technologies';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/ext/ai-rewrite
// Body: { accountId, fieldKey, currentText, issue }
// Returns: { ok, text } — AI-adjusted version of currentText that should
// solve the user's reported issue while preserving project voice + brand.
export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const body = await req.json() as {
    accountId: number;
    fieldKey: string;
    currentText: string;
    issue: string;
  };

  if (!body.accountId || !body.fieldKey) return errorResponse('Missing params', 400);

  const [row] = await db
    .select({ account: platformAccounts, platform: platforms, project: projects })
    .from(platformAccounts)
    .leftJoin(platforms, eq(platformAccounts.platformKey, platforms.key))
    .leftJoin(projects, eq(platformAccounts.projectId, projects.id))
    .where(eq(platformAccounts.id, body.accountId))
    .limit(1);

  if (!row || !row.platform) return errorResponse('Account not found', 404);

  // Find the field metadata so we know maxLen + label
  const fields = await getEffectiveSignupFields(row.platform.key);
  const field = fields.find((f) => f.key === body.fieldKey);

  const project = row.project;
  const acc = row.account;
  const platform = row.platform;

  const contextLines = [
    `Field: ${field?.label ?? body.fieldKey}`,
    field?.maxLen ? `Max length: ${field.maxLen} characters (HARD LIMIT)` : null,
    `Platform: ${platform.label}`,
    `Account handle: ${acc.handle ?? '(unset)'}`,
    project ? `Project: ${project.name}` : null,
    project?.oneLiner ? `One-liner: ${project.oneLiner}` : null,
    project?.bio ? `Bio: ${project.bio}` : null,
    project?.persona ? `Voice/persona: ${project.persona}` : null,
    project?.website ? `Website: ${project.website}` : null,
    project?.hashtags ? `Hashtags: ${project.hashtags}` : null,
  ].filter(Boolean).join('\n');

  const sysPrompt = `You are rewriting marketing content for a real product launch profile.
You will be given the current text, the platform's reported issue, and project context.
Your job: produce ONE improved version that fixes the issue while keeping voice + key info.

STRICT RULES:
- Output ONLY the rewritten text — no quotes, no commentary, no labels.
- If a max length is specified, the result MUST be ≤ that limit (count visible chars including spaces and punctuation).
- Preserve the brand handle (e.g. @oritapp), key URLs, and core value proposition.
- Match the project's voice/persona; do not invent features not in context.
- Keep the same language as the input (English unless input is in another language).`;

  const userPrompt = `# Context
${contextLines}

# Issue reported on the platform
${body.issue || '(no specific issue — just improve quality)'}

# Current text
${body.currentText}

# Task
Rewrite the current text to fix the issue. Output ONLY the new text.`;

  try {
    const ai = getOpenAI();
    if (!ai) return errorResponse('AI client unavailable', 503);

    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.6,
      max_tokens: 400,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let text = completion.choices[0]?.message?.content?.trim() ?? '';
    // Strip surrounding quotes if model added them despite instructions
    text = text.replace(/^["'`]|["'`]$/g, '').trim();

    if (!text) return errorResponse('Empty AI response', 502);

    return NextResponse.json({
      ok: true,
      text,
      meta: {
        model: DEFAULT_MODEL,
        length: text.length,
        maxLen: field?.maxLen ?? null,
        overLimit: field?.maxLen ? text.length > field.maxLen : false,
      },
    });
  } catch (e) {
    return errorResponse((e as Error).message, 500);
  }
}
