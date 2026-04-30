'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, squads } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export interface SquadConfig {
  mission?: string;             // 1 dòng goal/raison-d'être
  skillsMd?: string;            // Markdown description: bullet list, persona traits, expertise
  tools?: string[];             // IDs từ TOOLS_LIBRARY (lib/tools-library.ts)
  systemPrompt?: string;        // For AI runtime (phase 10): squad's persona
  model?: string;               // Phụ thuộc API key đã configure (xem /settings/api)
  trustLevel?: 1 | 2 | 3 | 4;   // L1 AUTO, L2 NOTIFY, L3 APPROVE, L4 ESCALATE
  useAgentLoop?: boolean;       // Phase 10: bật/tắt LLM tool-use loop. Default false (single-shot).
}

export interface SquadInput {
  squadKey: string;
  name: string;
  vi: string;
  icon: string;
  agents: number;
  active: number;
  color: string;
  descText: string;
  health: 'ok' | 'warn' | 'bad';
  config?: SquadConfig;
}

function squadKeyFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'squad';
}

async function findByKey(projectId: string, squadKey: string) {
  const db = ensureDb();
  const rows = await db
    .select()
    .from(squads)
    .where(and(eq(squads.tenantId, TENANT), eq(squads.projectId, projectId), eq(squads.squadKey, squadKey)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSquad(projectId: string, input: SquadInput): Promise<{ ok: boolean; squadKey?: string; error?: string }> {
  const db = ensureDb();
  if (!input.name.trim()) return { ok: false, error: 'Tên squad không được rỗng' };

  let key = input.squadKey?.trim() || squadKeyFromName(input.name);
  for (let i = 1; i < 100; i++) {
    const ex = await findByKey(projectId, key);
    if (!ex) break;
    key = `${squadKeyFromName(input.name)}-${i}`;
  }

  await db.insert(squads).values({
    tenantId: TENANT,
    projectId,
    squadKey: key,
    name: input.name.trim(),
    vi: input.vi || '',
    icon: input.icon || '🤖',
    agents: input.agents | 0,
    active: input.active | 0,
    color: input.color || '#00e5ff',
    descText: input.descText || '',
    health: input.health,
    config: input.config ?? {},
  });

  revalidatePath(`/p/${projectId}/squads`);
  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/board`);
  return { ok: true, squadKey: key };
}

export async function updateSquad(projectId: string, squadKey: string, patch: Partial<SquadInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const sq = await findByKey(projectId, squadKey);
  if (!sq) return { ok: false, error: 'squad not found' };

  const set: Partial<typeof squads.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.vi !== undefined) set.vi = patch.vi;
  if (patch.icon !== undefined) set.icon = patch.icon;
  if (patch.agents !== undefined) set.agents = patch.agents | 0;
  if (patch.active !== undefined) set.active = patch.active | 0;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.descText !== undefined) set.descText = patch.descText;
  if (patch.health !== undefined) set.health = patch.health;
  if (patch.config !== undefined) set.config = patch.config;

  await db.update(squads).set(set).where(eq(squads.id, sq.id));

  revalidatePath(`/p/${projectId}/squads`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}

export async function deleteSquad(projectId: string, squadKey: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const sq = await findByKey(projectId, squadKey);
  if (!sq) return { ok: false, error: 'squad not found' };

  await db.delete(squads).where(eq(squads.id, sq.id));
  revalidatePath(`/p/${projectId}/squads`);
  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/board`);
  return { ok: true };
}
