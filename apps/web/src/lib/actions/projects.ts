'use server';

// Server Actions for Project CRUD.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDb, projects, modes, squads, cards, alerts, feedEvents } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured — server actions require DB.');
  return db;
}

export interface ProjectInput {
  id?: string;
  name: string;
  emoji: string;
  modeId: string;
  agentsCore: number;
  agentsShared: number;
  budget: number;
  health: number;
  revenue: string;
  kpi: string;
  color: string;
  // Brand fields (snippet template variables)
  website?: string;
  oneLiner?: string;
  bio?: string;
  persona?: string;
  hashtags?: string;
  contentStrategy?: string;   // góc nhìn/rule/CTA cho bài gốc (ai-post)
  stack?: string;             // "Built with" / tech stack list (PH shoutouts, directory listings)
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

async function isModeValid(modeId: string): Promise<boolean> {
  const db = ensureDb();
  const rows = await db.select({ id: modes.id }).from(modes).where(eq(modes.id, modeId)).limit(1);
  return rows.length > 0;
}

export async function createProject(input: ProjectInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = ensureDb();

  if (!input.name.trim()) return { ok: false, error: 'Tên project không được rỗng' };
  if (!(await isModeValid(input.modeId))) return { ok: false, error: `Mode "${input.modeId}" không tồn tại` };

  // Auto-generate id from name; ensure uniqueness by appending -1, -2, ...
  const baseId = input.id?.trim() || slugify(input.name) || 'project';
  let id = baseId;
  for (let i = 1; i < 100; i++) {
    const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).limit(1);
    if (existing.length === 0) break;
    id = `${baseId}-${i}`;
  }

  await db.insert(projects).values({
    id,
    tenantId: TENANT,
    name: input.name.trim(),
    emoji: input.emoji || '📦',
    modeId: input.modeId,
    agentsCore: input.agentsCore | 0,
    agentsShared: input.agentsShared | 0,
    budget: input.budget | 0,
    health: Math.max(0, Math.min(100, input.health | 0)),
    revenue: input.revenue || '—',
    kpi: input.kpi || '',
    alerts: 0,
    color: input.color || '#00e5ff',
  });

  revalidatePath('/');
  revalidatePath(`/p/${id}`);
  return { ok: true, id };
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, TENANT), eq(projects.id, id)))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Project không tồn tại' };

  if (input.modeId && !(await isModeValid(input.modeId))) {
    return { ok: false, error: `Mode "${input.modeId}" không tồn tại` };
  }

  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.emoji !== undefined) patch.emoji = input.emoji;
  if (input.modeId !== undefined) patch.modeId = input.modeId;
  if (input.agentsCore !== undefined) patch.agentsCore = input.agentsCore | 0;
  if (input.agentsShared !== undefined) patch.agentsShared = input.agentsShared | 0;
  if (input.budget !== undefined) patch.budget = input.budget | 0;
  if (input.health !== undefined) patch.health = Math.max(0, Math.min(100, input.health | 0));
  if (input.revenue !== undefined) patch.revenue = input.revenue || '—';
  if (input.kpi !== undefined) patch.kpi = input.kpi;
  if (input.color !== undefined) patch.color = input.color;
  if (input.website !== undefined) patch.website = input.website;
  if (input.oneLiner !== undefined) patch.oneLiner = input.oneLiner;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.persona !== undefined) patch.persona = input.persona;
  if (input.hashtags !== undefined) patch.hashtags = input.hashtags;
  if (input.contentStrategy !== undefined) patch.contentStrategy = input.contentStrategy;
  if (input.stack !== undefined) patch.stack = input.stack;

  await db.update(projects).set(patch).where(eq(projects.id, id));

  revalidatePath('/');
  revalidatePath(`/p/${id}`);
  revalidatePath(`/p/${id}/board`);
  revalidatePath(`/p/${id}/squads`);
  revalidatePath(`/p/${id}/settings`);
  return { ok: true };
}

// AI-suggest the "Built with" / stack list from the project's own context (name + one-liner +
// homepage grounding) and save it — so filling stack is one tap per project, not manual typing.
// Any new user-fillable field should ship with a generate affordance like this — see
// feedback_auto_prefill. Overwrites only on an explicit click (never silent).
export async function suggestProjectStack(projectId: string): Promise<{ ok: boolean; stack?: string; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa set' };
  const db = ensureDb();
  const [p] = await db
    .select({ id: projects.id, name: projects.name, oneLiner: projects.oneLiner, bio: projects.bio, website: projects.website })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return { ok: false, error: 'project not found' };
  // Grounding: pull the homepage text (non-fatal) so the guess is anchored, not invented.
  let siteText = '';
  if (p.website) {
    try {
      const res = await fetch(p.website, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Brand/1.0)' }, signal: AbortSignal.timeout(6000) });
      siteText = (await res.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    } catch { siteText = ''; }
  }
  const ai = getOpenAI(); if (!ai) return { ok: false, error: 'AI client unavailable' };
  const sysPrompt = `You infer the likely TECH STACK / "Built with" tool list for a software product, for use as Product Hunt shoutouts and "Built with X" directory listings. Output STRICT JSON: { "stack": "Tool1, Tool2, Tool3, ..." }
- 4-7 REAL, well-known product names (e.g. Vercel, Supabase, Neon, Stripe, Claude, OpenAI, Cursor, Linear, Resend, Cloudflare, Plasmo, Tailwind, PostHog), comma-separated.
- Bias to tools that (a) a product like this plausibly uses AND (b) have an active Product Hunt page to receive a shoutout back.
- Real product names ONLY — never generic categories ("database", "hosting"). No prose, JSON only.`;
  const userPrompt = `# Project\nName: ${p.name}\nOne-liner: ${p.oneLiner || '(none)'}\nBio: ${p.bio || '(none)'}\nWebsite: ${p.website || '(none)'}\n# Homepage content (grounding — infer the real stack)\n${siteText || '(could not fetch — infer from name + one-liner)'}\n\nReturn STRICT JSON only.`;
  try {
    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.5, max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content?.trim() || '{}') as { stack?: unknown };
    const stack = (Array.isArray(parsed.stack) ? parsed.stack.map((x) => String(x ?? '')).filter(Boolean).join(', ') : String(parsed.stack ?? '')).trim();
    if (!stack) return { ok: false, error: 'AI trả rỗng' };
    await db.update(projects).set({ stack, updatedAt: new Date() }).where(eq(projects.id, projectId));
    revalidatePath(`/p/${projectId}`);
    revalidatePath(`/p/${projectId}/settings`);
    return { ok: true, stack };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function archiveProject(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.update(projects).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, id));
  revalidatePath('/');
  return { ok: true };
}

export async function deleteProjectHard(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // FK cascade wipes squads/cards/alerts/feed.
  await db.delete(squads).where(eq(squads.projectId, id));
  await db.delete(cards).where(eq(cards.projectId, id));
  await db.delete(alerts).where(eq(alerts.projectId, id));
  await db.delete(feedEvents).where(eq(feedEvents.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath('/');
  return { ok: true };
}

// Convenience for forms: redirect after create.
export async function createProjectAndRedirect(input: ProjectInput): Promise<void> {
  const res = await createProject(input);
  if (!res.ok || !res.id) {
    throw new Error(res.error || 'create failed');
  }
  redirect(`/p/${res.id}/settings`);
}
