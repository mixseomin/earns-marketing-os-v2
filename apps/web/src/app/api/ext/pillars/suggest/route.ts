import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, projects } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { createContentPillar, listContentPillars } from '@/lib/actions/content-pillars';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// AI sinh content pillars (nhóm chủ đề) cho project từ brand + website. save=true → tạo
// thật vào content_pillars (bổ sung khi project chưa có pillar). Trả pillars hiện có.
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const body = (await req.json()) as { projectId?: string; save?: boolean };
  const projectId = (body.projectId ?? '').trim();
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId required' }, { status: 400 });

  const [p] = await db
    .select({ name: projects.name, oneLiner: projects.oneLiner, bio: projects.bio, persona: projects.persona, website: projects.website, contentStrategy: projects.contentStrategy })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return NextResponse.json({ ok: false, error: 'project not found' }, { status: 404 });

  let siteText = '';
  if (p.website) {
    try {
      const res = await fetch(p.website, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Pillars/1.0)' }, signal: AbortSignal.timeout(6000) });
      const html = await res.text();
      siteText = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3500);
    } catch { siteText = ''; }
  }

  const sysPrompt = `You are a content strategist. Define 4-6 CONTENT PILLARS (recurring topic groups) for this project's organic social presence. Output STRICT JSON:
{ "pillars": [ { "name": "...", "tagline": "...", "keyMessages": ["...","..."] }, ... ] }
- name: short pillar label (2-4 words), the topic group.
- tagline: one line on what this pillar covers / why it matters.
- keyMessages: 2-4 concrete angles/sub-topics under this pillar (each a short phrase a writer could turn into a post).
Cover distinct angles (educational, social-proof, behind-the-scenes, news/timely, community), grounded in what the project actually offers. ENGLISH. No em-dashes.`;

  const userPrompt = `# Project
Name: ${p.name}
One-liner: ${p.oneLiner || '(none)'}
Voice: ${p.persona || '(none)'}
Strategy: ${p.contentStrategy || '(none)'}
Website: ${p.website || '(none)'}

# Website content
${siteText || '(infer from name + one-liner)'}

# Task
Output STRICT JSON with 4-6 pillars.`;

  let suggested: Array<{ name: string; tagline: string; keyMessages: string[] }> = [];
  try {
    const ai = getOpenAI();
    if (!ai) return NextResponse.json({ ok: false, error: 'AI client unavailable' }, { status: 503 });
    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.7, max_tokens: 1100,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(raw) as { pillars?: unknown };
    const arr = Array.isArray(parsed.pillars) ? parsed.pillars : [];
    suggested = arr.map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const km = Array.isArray(o.keyMessages) ? o.keyMessages.map((m) => String(m ?? '').trim()).filter(Boolean)
        : (typeof o.keyMessages === 'string' ? [String(o.keyMessages)] : []);
      return { name: String(o.name ?? '').trim(), tagline: String(o.tagline ?? '').trim(), keyMessages: km };
    }).filter((x) => x.name);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `AI error: ${(e as Error).message}` }, { status: 500 });
  }

  let created = 0;
  if (body.save && suggested.length) {
    for (const s of suggested) {
      try { const r = await createContentPillar(projectId, { name: s.name, tagline: s.tagline, keyMessages: s.keyMessages, positioningMd: '' }); if (r.ok) created++; } catch { /* skip dup */ }
    }
  }

  const pillars = (await listContentPillars(projectId) || [])
    .filter((p2) => (p2 as { status?: string }).status !== 'archived')
    .map((p2) => ({ id: p2.id, name: p2.name, tagline: p2.tagline, keyMessages: p2.keyMessages, slug: p2.slug }));
  return NextResponse.json({ ok: true, suggested, created, pillars });
}
