import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { logAiUsage } from '@/lib/ai/usage';
import { firstRow, errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/approaches/generate { title, category?, platformKey?, projectId? }
// AI sinh "angle" (góc tiếp cận seeding tái dùng) + gợi ý category/tags từ title. KHÔNG lưu — ext fill vào form, user review.
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  if (!aiEnabled()) return errorResponse('AI chưa cấu hình (OPENAI_API_KEY)', 503);
  const b = (await req.json().catch(() => ({}))) as { title?: string; category?: string; platformKey?: string; projectId?: string };
  const title = String(b.title ?? '').trim();
  if (!title) return errorResponse('title required', 400);
  const platformKey = String(b.platformKey ?? '').trim();
  const projectId = String(b.projectId ?? '').trim();

  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  let proj: Record<string, unknown> = {};
  if (projectId) {
    const rows = await db.execute(sql`SELECT name, bio, one_liner FROM projects WHERE id = ${projectId} LIMIT 1`);
    proj = firstRow(rows) || {};
  }

  const ai = getOpenAI();
  if (!ai) return errorResponse('AI chưa cấu hình', 503);
  const sys = 'You write reusable community-seeding "angles" (playbook entries) for organic marketing. An angle = a concrete, non-salesy way to add value in a community thread that naturally surfaces a product/brand. Output English, no hard selling.';
  const user = `Title of the angle: ${title}${b.category ? `\nCategory: ${b.category}` : ''}${platformKey ? `\nPlatform: ${platformKey}` : ''}${proj.name ? `\nProject: ${proj.name} — ${proj.one_liner ?? proj.bio ?? ''}` : ''}
Write the angle. JSON shape EXACTLY:
{
  "angle": "<2-4 sentences: the concrete approach — what to post/comment, how it adds value, how the brand surfaces naturally. English, no hard sell.>",
  "category": "<1-3 word lowercase category slug>",
  "tags": ["<tag>", "<tag>", "<tag>"]
}`;
  try {
    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });
    logAiUsage('approach-gen', DEFAULT_MODEL, completion.usage, projectId || null);
    let out: Record<string, unknown> = {};
    try { out = JSON.parse(completion.choices[0]?.message?.content || '{}'); } catch { /* ignore */ }
    return NextResponse.json({
      ok: true,
      angle: String(out.angle ?? ''),
      category: String(out.category ?? ''),
      tags: Array.isArray(out.tags) ? (out.tags as unknown[]).map((t) => String(t)).filter(Boolean).slice(0, 20) : [],
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'AI gen fail', 500);
  }
}
