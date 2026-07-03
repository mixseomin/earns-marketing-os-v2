'use server';

// Server Actions for `identities` (preset persona/brand/seeding per project).
// API ext (`/api/ext/identities*`) đã có cho chrome ext; file này cho UI dashboard.
// password lưu pgcrypto qua encryptValue() — chỉ reveal khi user chủ động bấm.

import { revalidatePath } from 'next/cache';
import { desc, eq, or, inArray, sql } from 'drizzle-orm';
import { getDb, identities, identityProjects } from '@mos2/db';
import { encryptValue, decryptValue } from '../crypto';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';

export type IdentityKind = 'brand' | 'seeding';

export interface IdentityRow {
  id: number;
  projectId: string | null; // null = shared across all projects
  name: string;
  kind: IdentityKind;
  handleBase: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  hasPassword: boolean;
  persona: Record<string, unknown>;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityInput {
  name: string;
  kind?: IdentityKind;
  handleBase?: string;
  email?: string;
  password?: string;          // plaintext; '' → clear; undefined → leave alone
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  persona?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured');
  return db;
}

function toRow(r: typeof identities.$inferSelect): IdentityRow {
  return {
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    kind: (r.kind === 'brand' ? 'brand' : 'seeding') as IdentityKind,
    handleBase: r.handleBase,
    email: r.email,
    displayName: r.displayName,
    bio: r.bio,
    avatarUrl: r.avatarUrl,
    hasPassword: !!r.passwordEnc,
    persona: (r.persona ?? {}) as Record<string, unknown>,
    customFields: (r.customFields ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listIdentities(projectId: string): Promise<IdentityRow[]> {
  const db = ensureDb();
  // multi-project: identities linked to projectId via pivot identity_projects
  // (home project_id giữ làm fallback cho hàng chưa có pivot — sau backfill thì đã đủ).
  const linked = db.select({ id: identityProjects.identityId }).from(identityProjects).where(eq(identityProjects.projectId, projectId));
  const rows = await db
    .select()
    .from(identities)
    .where(or(inArray(identities.id, linked), eq(identities.projectId, projectId)))
    .orderBy(desc(identities.updatedAt));
  return rows.map(toRow);
}

// 1 identity theo id (cho account modal show "Identity gốc" — account.persona.identityId).
export async function getIdentity(id: number): Promise<IdentityRow | null> {
  const db = ensureDb();
  const [r] = await db.select().from(identities).where(eq(identities.id, id)).limit(1);
  return r ? toRow(r) : null;
}

export async function createIdentity(projectId: string | null, input: IdentityInput): Promise<number> {
  const db = ensureDb();
  const name = (input.name ?? '').trim();
  if (!name) throw new Error('name required');
  const pw = input.password ? String(input.password) : '';
  const passwordEnc = pw ? await encryptValue(pw) : null;
  const inserted = await db.insert(identities).values({
    projectId,                          // home/primary project (scalar, đồng bộ pivot)
    name,
    kind: input.kind === 'brand' ? 'brand' : 'seeding',
    handleBase: input.handleBase ?? '',
    email: input.email ?? '',
    passwordEnc,
    displayName: input.displayName ?? '',
    bio: input.bio ?? '',
    avatarUrl: input.avatarUrl ?? '',
    persona: input.persona ?? {},
    customFields: input.customFields ?? {},
  }).returning({ id: identities.id });
  const row = inserted[0];
  if (!row) throw new Error('insert returned no row');
  // pivot 'primary' cho home project (multi-project add từ studio/drawer).
  if (projectId) {
    await db.insert(identityProjects).values({ projectId, identityId: row.id, role: 'primary' }).onConflictDoNothing();
    revalidatePath(`/p/${projectId}/identities`);
  }
  return row.id;
}

// AI-generate a persona (name/handle/email/bio) from project context and SAVE it as an identity,
// so a campaign sender picker can offer "＋ Tạo mới (AI)". Mirrors /api/ext/identities/generate.
export async function generateIdentityAI(projectId: string, kind: IdentityKind = 'brand', hint?: string): Promise<{ ok: boolean; identity?: IdentityRow; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'AI chưa cấu hình (OPENAI_API_KEY)' };
  const ai = getOpenAI();
  if (!ai) return { ok: false, error: 'AI client unavailable' };
  const db = ensureDb();
  const pr = await db.execute(sql`SELECT name, bio, one_liner, persona, website FROM projects WHERE id = ${projectId} LIMIT 1`);
  const proj = ((pr as unknown as Array<Record<string, unknown>>)[0]) || {};
  const sys = `You generate ONE realistic online persona for ${kind === 'brand' ? 'an OFFICIAL brand account' : 'a community seeding account (an anonymous-feeling regular member, NOT obviously promotional)'}. Output STRICT JSON only.`;
  const user = `Project: ${proj.name ?? ''} — ${proj.one_liner ?? ''}
Brand bio: ${proj.bio ?? ''}
Brand persona/voice: ${proj.persona ?? ''}
Kind: ${kind}${hint ? `\nExtra hint: ${hint}` : ''}

Generate a persona to send outreach emails as. JSON shape EXACTLY:
{
  "name": "<short preset name, e.g. 'Founder Persona'>",
  "handleBase": "<username, lowercase, letters/numbers/underscore, 4-16 chars>",
  "email": "<plausible email matching handle>",
  "displayName": "<real-sounding full name for the email 'From'>",
  "bio": "<short bio 1-2 sentences, English>",
  "persona": { "name_first": "", "name_last": "", "gender": "", "country": "", "city": "", "interests": ["",""], "backstory": "<2-3 sentence backstory>" }
}
${kind === 'seeding' ? 'Anonymous regular member vibe. Do NOT mention the brand.' : 'Professional brand representative.'}`;
  try {
    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.9, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    });
    let out: Record<string, unknown> = {};
    try { out = JSON.parse(completion.choices[0]?.message?.content || '{}'); } catch { /* ignore */ }
    const id = await createIdentity(projectId, {
      name: String(out.name || 'AI persona'), kind,
      handleBase: String(out.handleBase || ''), email: String(out.email || ''),
      displayName: String(out.displayName || out.name || ''), bio: String(out.bio || ''),
      persona: (out.persona as Record<string, unknown>) || {},
    });
    const identity = await getIdentity(id);
    return { ok: true, identity: identity ?? undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateIdentity(id: number, input: IdentityInput): Promise<void> {
  const db = ensureDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.kind !== undefined) patch.kind = input.kind === 'brand' ? 'brand' : 'seeding';
  if (input.handleBase !== undefined) patch.handleBase = input.handleBase;
  if (input.email !== undefined) patch.email = input.email;
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
  if (input.persona !== undefined) patch.persona = input.persona;
  if (input.customFields !== undefined) patch.customFields = input.customFields;
  // project membership = pivot identity_projects (setIdentityProjects), KHÔNG ở đây.
  if (input.password !== undefined) {
    const pw = String(input.password);
    patch.passwordEnc = pw ? await encryptValue(pw) : null;
  }
  const [updated] = await db.update(identities).set(patch).where(eq(identities.id, id)).returning({ projectId: identities.projectId });
  if (updated?.projectId) revalidatePath(`/p/${updated.projectId}/identities`);
}

export async function deleteIdentity(id: number): Promise<void> {
  const db = ensureDb();
  const [deleted] = await db.delete(identities).where(eq(identities.id, id)).returning({ projectId: identities.projectId });
  if (deleted?.projectId) revalidatePath(`/p/${deleted.projectId}/identities`);
}

// Reveal password — decrypt just-in-time. UI hits this only when user clicks "show".
export async function revealIdentityPassword(id: number): Promise<string> {
  const db = ensureDb();
  const [r] = await db.select({ passwordEnc: identities.passwordEnc }).from(identities).where(eq(identities.id, id)).limit(1);
  if (!r?.passwordEnc) return '';
  return await decryptValue(r.passwordEnc);
}
