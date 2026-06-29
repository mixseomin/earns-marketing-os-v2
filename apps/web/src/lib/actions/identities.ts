'use server';

// Server Actions for `identities` (preset persona/brand/seeding per project).
// API ext (`/api/ext/identities*`) đã có cho chrome ext; file này cho UI dashboard.
// password lưu pgcrypto qua encryptValue() — chỉ reveal khi user chủ động bấm.

import { revalidatePath } from 'next/cache';
import { desc, eq, or, isNull } from 'drizzle-orm';
import { getDb, identities } from '@mos2/db';
import { encryptValue, decryptValue } from '../crypto';

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
  shared?: boolean;           // true → project_id NULL (portfolio-wide persona)
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
  // project-owned + shared (project_id NULL) identities both show in a project.
  const rows = await db
    .select()
    .from(identities)
    .where(or(eq(identities.projectId, projectId), isNull(identities.projectId)))
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
  // shared persona → project_id NULL (shows in every project).
  const ownerProjectId = input.shared ? null : projectId;
  const inserted = await db.insert(identities).values({
    projectId: ownerProjectId,
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
  if (projectId) revalidatePath(`/p/${projectId}/identities`);
  return row.id;
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
  // ponytail: only supports flipping TO shared (project_id NULL). To re-scope a shared
  // identity back to one project, pass a projectId — add when actually needed.
  if (input.shared === true) patch.projectId = null;
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
