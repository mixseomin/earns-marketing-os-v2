import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, projects } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// AI gợi ý brand/context fields cho bài GỐC — sinh từ tên/oneLiner/website project
// (+ nội dung site để grounding). Trả suggestion, KHÔNG tự lưu (user review rồi Lưu).
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);

  const body = (await req.json()) as { projectId?: string };
  const projectId = (body.projectId ?? '').trim();
  if (!projectId) return errorResponse('projectId required', 400);

  const [p] = await db
    .select({ id: projects.id, name: projects.name, oneLiner: projects.oneLiner, bio: projects.bio, persona: projects.persona, hashtags: projects.hashtags, website: projects.website, contentStrategy: projects.contentStrategy })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return errorResponse('project not found', 404);

  // Grounding: fetch trang chủ (4KB text, non-fatal) → AI bám thực tế thay vì bịa.
  let siteText = '';
  if (p.website) {
    try {
      const res = await fetch(p.website, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Brand/1.0)' }, signal: AbortSignal.timeout(6000) });
      const html = await res.text();
      siteText = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3500);
    } catch { siteText = ''; }
  }

  const sysPrompt = `You are a brand voice strategist for organic social media. Generate concise BRAND FIELDS that an AI will use to write ORIGINAL posts for this project. Output STRICT JSON:
{ "persona": "...", "bio": "...", "oneLiner": "...", "hashtags": "...", "contentStrategy": "..." }
- persona: the writing VOICE in 1-2 sentences (tone, attitude, vocabulary). Concrete + human, NOT corporate. This is the single most important field.
- bio: a short first-person profile line (≤160 chars) the account could use.
- oneLiner: a punchy one-line description of the project.
- hashtags: 3-6 relevant hashtags, space-separated, WITH # prefix.
- contentStrategy: 3-5 short bullet rules (use "- " lines) for original posts — the angle, what to ALWAYS do, what to NEVER do, and the CTA. Be specific to THIS project. Ground in real facts from the site; never promise unverified numbers/claims.
Write in ENGLISH. No em-dashes. No AI-tell phrases. Keep each field tight and usable.`;

  const userPrompt = `# Project
Name: ${p.name}
One-liner: ${p.oneLiner || '(none)'}
Website: ${p.website || '(none)'}
${p.persona ? `Existing voice (refine, keep what's good): ${p.persona}\n` : ''}${p.contentStrategy ? `Existing strategy (refine): ${p.contentStrategy}\n` : ''}
# Website content (for grounding — extract what the project actually offers)
${siteText || '(could not fetch — infer from name + one-liner)'}

# Task
Generate the brand fields. Output STRICT JSON only.`;

  try {
    const ai = getOpenAI();
    if (!ai) return errorResponse('AI client unavailable', 503);
    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.7,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const s = JSON.parse(raw) as Record<string, unknown>;
    // LLM có thể trả contentStrategy/hashtags dạng ARRAY (vì prompt nói "bullets") → join.
    const str = (v: unknown): string => {
      if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : String(x ?? ''))).filter(Boolean).map((x) => (x.startsWith('- ') ? x : '- ' + x)).join('\n');
      return typeof v === 'string' ? v.trim() : '';
    };
    const strFlat = (v: unknown): string => (Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean).join(' ') : (typeof v === 'string' ? v.trim() : ''));
    return NextResponse.json({
      ok: true,
      grounded: !!siteText,
      suggestion: {
        persona: strFlat(s.persona), bio: strFlat(s.bio), oneLiner: strFlat(s.oneLiner),
        hashtags: strFlat(s.hashtags), contentStrategy: str(s.contentStrategy),
      },
    });
  } catch (e) {
    return errorResponse(`AI error: ${(e as Error).message}`, 500);
  }
}
