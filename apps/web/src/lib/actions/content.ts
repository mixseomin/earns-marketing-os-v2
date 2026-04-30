'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, contentPieces } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { CHANNELS, type ContentStatus } from '@/lib/content-channels';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'piece';
}

export interface ContentInput {
  slug?: string;
  title: string;
  channel: string;
  tribeSlug?: string | null;
  persona?: string | null;
  subject?: string | null;
  bodyMd: string;
  status?: ContentStatus;
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  publishUrl?: string | null;
  aiNotes?: string[];
  tags?: string[];
  metrics?: Record<string, string | number>;
}

export async function createContentPiece(projectId: string, input: ContentInput): Promise<{ ok: boolean; slug?: string; error?: string }> {
  if (!input.title.trim()) return { ok: false, error: 'title required' };
  const db = ensureDb();
  let slug = input.slug?.trim() || slugify(input.title);
  // Unique per project
  for (let i = 1; i < 100; i++) {
    const ex = await db.select({ id: contentPieces.id }).from(contentPieces)
      .where(and(eq(contentPieces.tenantId, TENANT), eq(contentPieces.projectId, projectId), eq(contentPieces.slug, slug)))
      .limit(1);
    if (ex.length === 0) break;
    slug = `${slugify(input.title)}-${i}`;
  }
  await db.insert(contentPieces).values({
    tenantId: TENANT, projectId, slug,
    title: input.title, channel: input.channel,
    tribeSlug: input.tribeSlug ?? null, persona: input.persona ?? null,
    subject: input.subject ?? null, bodyMd: input.bodyMd,
    status: input.status ?? 'draft',
    scheduledAt: input.scheduledAt ?? null,
    publishedAt: input.publishedAt ?? null,
    publishUrl: input.publishUrl ?? null,
    aiNotes: input.aiNotes ?? [],
    tags: input.tags ?? [],
    metrics: input.metrics ?? {},
  });
  revalidatePath(`/p/${projectId}/studio`);
  return { ok: true, slug };
}

export async function updateContentPiece(id: number, projectId: string, patch: Partial<ContentInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof contentPieces.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(patch) as Array<keyof ContentInput>) {
    const v = patch[key];
    if (v === undefined) continue;
    (set as Record<string, unknown>)[key] = v;
  }
  await db.update(contentPieces).set(set).where(eq(contentPieces.id, id));
  revalidatePath(`/p/${projectId}/studio`);
  return { ok: true };
}

export async function archiveContentPiece(id: number, projectId: string): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(contentPieces).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(contentPieces.id, id));
  revalidatePath(`/p/${projectId}/studio`);
  return { ok: true };
}

// AI generate: produce title + bodyMd + subject + aiNotes from prompt + channel.
export async function generateContent(input: {
  prompt: string;
  channel: string;
  tribeSlug?: string;
  persona?: string;
  skillSnippet?: string;  // optional skill body từ /library to use as system prompt
}): Promise<{ ok: boolean; title?: string; subject?: string; bodyMd?: string; aiNotes?: string[]; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const client = getOpenAI();
  if (!client) return { ok: false, error: 'OpenAI client unavailable' };

  const channel = CHANNELS.find((c) => c.id === input.channel);
  const channelHint = channel ? `${channel.label} — ${channel.hint}` : input.channel;

  const systemPrompt = input.skillSnippet?.trim()
    ? input.skillSnippet
    : `Bạn là content creator cho marketing portfolio (Earns project). Output style trực tiếp, không sáo rỗng, action-driven.`;

  const userPrompt = `Tạo 1 piece content cho channel: ${channelHint}
${input.tribeSlug ? `Tribe / audience: ${input.tribeSlug}` : ''}
${input.persona ? `Persona / handle: ${input.persona}` : ''}
Brief: ${input.prompt}

Trả JSON object: { "title": "≤60 chars", "subject": "≤80 chars hook hoặc subject line (rỗng nếu không phải email/post)", "bodyMd": "full content markdown", "aiNotes": [3-5 quick checks về hook/tone/CTA] }`;

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1200,
    });
    const text = res.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text) as { title?: unknown; subject?: unknown; bodyMd?: unknown; aiNotes?: unknown };
    return {
      ok: true,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      bodyMd: typeof parsed.bodyMd === 'string' ? parsed.bodyMd : '',
      aiNotes: Array.isArray(parsed.aiNotes) ? parsed.aiNotes.filter((n): n is string => typeof n === 'string') : [],
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
