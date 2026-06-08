'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, mediaAssets, infraResources, budgetEntries } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { uploadToR2 } from '@/lib/r2';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

// ── Media ─────────────────────────────────────────────────────────
export interface MediaInput {
  projectId?: string | null;
  kind: 'image' | 'video' | 'audio' | 'doc' | 'other';
  filename: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  hot?: boolean;
  tags?: string[];
  notes?: string | null;
  source?: string | null;
}

export async function createMediaAsset(input: MediaInput, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  if (!input.filename.trim() || !input.url.trim()) return { ok: false, error: 'filename + url required' };
  const db = ensureDb();
  await db.insert(mediaAssets).values({
    tenantId: TENANT,
    projectId: input.projectId ?? projectIdScope ?? null,
    kind: input.kind, filename: input.filename, url: input.url,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? 0,
    width: input.width ?? null,
    height: input.height ?? null,
    durationSec: input.durationSec ?? null,
    hot: input.hot ?? false,
    tags: input.tags ?? [],
    notes: input.notes ?? null,
    source: input.source ?? 'upload',
  });
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

// Upload a pasted/dropped file straight to R2 + insert a media_assets row.
// Browser sends FormData (file + projectId + optional description/tags/dims).
// Lets users build a screenshot library fast: copy → paste → describe → save.
export async function uploadMediaAsset(form: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'no file' };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: 'file too large (max 20MB)' };

  const projectId = String(form.get('projectId') || '').trim() || null;
  const description = (form.get('description') as string)?.trim() || null;
  const tagsStr = (form.get('tags') as string) || '';
  const hot = form.get('hot') === '1';
  const widthRaw = form.get('width');
  const heightRaw = form.get('height');
  const width = widthRaw ? Number(widthRaw) || null : null;
  const height = heightRaw ? Number(heightRaw) || null : null;

  const type = file.type || 'application/octet-stream';
  const kind: MediaInput['kind'] =
    type.startsWith('video') ? 'video' :
    type.startsWith('audio') ? 'audio' :
    type.startsWith('image') ? 'image' :
    type.includes('pdf') || type.includes('document') ? 'doc' : 'other';

  const ts = Date.now();
  const ext = (type.split('/')[1] || 'bin').split('+')[0];
  const rawName = file.name && file.name !== 'image.png' ? file.name : `paste-${ts}.${ext}`;
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const key = `vault/${projectId || 'unfiled'}/${ts}-${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(key, buf, type);
  if (!url) return { ok: false, error: 'R2 upload failed (check R2_* env on server)' };

  const res = await createMediaAsset({
    projectId, kind, filename: safeName, url, mimeType: type,
    sizeBytes: buf.length, width, height,
    notes: description, source: 'upload', hot,
    tags: tagsStr.split(',').map((s) => s.trim()).filter(Boolean),
  }, projectId ?? undefined);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, url };
}

export async function updateMediaAsset(id: number, patch: Partial<MediaInput>, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof mediaAssets.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(patch) as Array<keyof MediaInput>) {
    const v = patch[key];
    if (v === undefined) continue;
    (set as Record<string, unknown>)[key] = v;
  }
  await db.update(mediaAssets).set(set).where(eq(mediaAssets.id, id));
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

// AI suggest tags + notes from filename + URL + kind.
// Used by Media form button "🤖 AI suggest" — returns array tags + 1-line notes.
export async function suggestMediaMeta(input: {
  filename: string;
  url: string;
  kind: string;
}): Promise<{ ok: boolean; tags?: string[]; notes?: string; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const client = getOpenAI();
  if (!client) return { ok: false, error: 'OpenAI client unavailable' };

  const prompt = `Bạn là trợ lý phân loại media asset cho marketing portfolio (Earns project — passive income, content marketing, affiliate). Dựa vào metadata sau:
- Kind: ${input.kind}
- Filename: ${input.filename}
- URL: ${input.url}

Trả về JSON object: { "tags": [3-6 short keyword tags], "notes": "1 câu mô tả ngắn (≤80 chars)" }
Tags phải lowercase, hyphen-separated nếu nhiều từ. Ưu tiên use-case (logo, hero-banner, demo-screenshot, tutorial-thumbnail, ad-creative, etc.) không phải file format.`;

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    });
    const text = res.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text) as { tags?: unknown; notes?: unknown };
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === 'string') : [];
    const notes = typeof parsed.notes === 'string' ? parsed.notes : '';
    return { ok: true, tags, notes };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteMediaAsset(id: number, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

// ── Infra ─────────────────────────────────────────────────────────
export interface InfraInput {
  projectId?: string | null;
  kind: string;          // proxy|sim|device|api_key|domain|server|other
  label: string;
  provider?: string | null;
  status?: 'active' | 'expired' | 'paused' | 'broken';
  expiresAt?: Date | null;
  costMonthly?: number;
  currency?: string;
  meta?: Record<string, unknown>;
  notes?: string | null;
  tags?: string[];
}

export async function createInfraResource(input: InfraInput, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  if (!input.label.trim() || !input.kind.trim()) return { ok: false, error: 'label + kind required' };
  const db = ensureDb();
  await db.insert(infraResources).values({
    tenantId: TENANT,
    projectId: input.projectId ?? projectIdScope ?? null,
    kind: input.kind, label: input.label,
    provider: input.provider ?? null,
    status: input.status ?? 'active',
    expiresAt: input.expiresAt ?? null,
    costMonthly: input.costMonthly ?? 0,
    currency: input.currency ?? 'VND',
    meta: input.meta ?? {},
    notes: input.notes ?? null,
    tags: input.tags ?? [],
  });
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

export async function updateInfraResource(id: number, patch: Partial<InfraInput>, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof infraResources.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(patch) as Array<keyof InfraInput>) {
    const v = patch[key];
    if (v === undefined) continue;
    (set as Record<string, unknown>)[key] = v;
  }
  await db.update(infraResources).set(set).where(eq(infraResources.id, id));
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

export async function deleteInfraResource(id: number, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.delete(infraResources).where(eq(infraResources.id, id));
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

// ── Budget ────────────────────────────────────────────────────────
export interface BudgetInput {
  projectId?: string | null;
  kind: 'income' | 'expense' | 'recurring';
  category: string;     // ads|tools|hosting|content|salary|tax|other
  label: string;
  amountCents: number;
  currency?: string;
  occurredAt?: Date;
  recurringIntervalDays?: number | null;
  notes?: string | null;
  tags?: string[];
}

export async function createBudgetEntry(input: BudgetInput, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  if (!input.label.trim()) return { ok: false, error: 'label required' };
  const db = ensureDb();
  await db.insert(budgetEntries).values({
    tenantId: TENANT,
    projectId: input.projectId ?? projectIdScope ?? null,
    kind: input.kind, category: input.category, label: input.label,
    amountCents: input.amountCents | 0,
    currency: input.currency ?? 'VND',
    occurredAt: input.occurredAt ?? new Date(),
    recurringIntervalDays: input.recurringIntervalDays ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? [],
  });
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

export async function updateBudgetEntry(id: number, patch: Partial<BudgetInput>, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof budgetEntries.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(patch) as Array<keyof BudgetInput>) {
    const v = patch[key];
    if (v === undefined) continue;
    (set as Record<string, unknown>)[key] = v;
  }
  await db.update(budgetEntries).set(set).where(eq(budgetEntries.id, id));
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}

export async function deleteBudgetEntry(id: number, projectIdScope?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.delete(budgetEntries).where(eq(budgetEntries.id, id));
  if (projectIdScope) revalidatePath(`/p/${projectIdScope}/resources`);
  return { ok: true };
}
