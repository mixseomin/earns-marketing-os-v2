'use server';

// Server actions for community_briefs — per (account × habitat) approach plan.
// See migration 0039_community_briefs.sql for shape + intent.

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, communityBriefs, platformAccounts, habitats, tribes } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export interface BriefTemplate {
  label: string;
  body: string;
}

export interface BriefRow {
  id: number;
  projectId: string;
  accountId: number;
  habitatId: number;
  approachMd: string;
  cadence: string;
  tone: string;
  doMd: string;
  dontMd: string;
  templates: BriefTemplate[];
  aiSuggestion: unknown | null;       // last generated, shape = BriefSuggestion
  aiSuggestionAt: string | null;
  updatedAt: string;
}

export interface BriefForAccount extends BriefRow {
  habitatName: string;
  habitatKind: string;
  habitatUrl: string | null;
  habitatMembers: number;
  tribeName: string | null;
}

export interface BriefForHabitat extends BriefRow {
  accountHandle: string | null;
  accountEmail: string | null;
  accountStatus: string;
  platformKey: string;
  platformLabel: string;
}

// ── Read ──────────────────────────────────────────────────────────

// Count distinct accounts that have a brief in any habitat of each tribe.
// Returns: { byTribe: { [tribeId]: count }, byHabitat: { [habitatId]: count }, allHabitats: number, untrackedTribe: number }
//   - byTribe: distinct accounts across all habitats of a given tribe
//   - byHabitat: brief count per habitat (= account count, since (account, habitat) is unique)
//   - allHabitats: distinct accounts across the entire project
//   - untrackedTribe: distinct accounts in habitats with no tribe link
export async function countAccountsPerTribe(projectId: string): Promise<{
  byTribe: Record<number, number>;
  byHabitat: Record<number, number>;
  allHabitats: number;
  untrackedTribe: number;
}> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT b.account_id, b.habitat_id, h.tribe_id
    FROM community_briefs b
    JOIN habitats h ON h.id = b.habitat_id
    WHERE b.tenant_id = ${TENANT} AND b.project_id = ${projectId}
  `);
  const list = rows as unknown as Array<{ account_id: number; habitat_id: number; tribe_id: number | null }>;

  const byTribeSet = new Map<number, Set<number>>();
  const byHabitatSet = new Map<number, Set<number>>();
  const allSet = new Set<number>();
  const untrackedSet = new Set<number>();

  for (const r of list) {
    allSet.add(Number(r.account_id));
    const hSet = byHabitatSet.get(Number(r.habitat_id)) ?? new Set<number>();
    hSet.add(Number(r.account_id));
    byHabitatSet.set(Number(r.habitat_id), hSet);
    if (r.tribe_id == null) {
      untrackedSet.add(Number(r.account_id));
    } else {
      const tSet = byTribeSet.get(Number(r.tribe_id)) ?? new Set<number>();
      tSet.add(Number(r.account_id));
      byTribeSet.set(Number(r.tribe_id), tSet);
    }
  }

  const byTribe: Record<number, number> = {};
  for (const [tid, s] of byTribeSet) byTribe[tid] = s.size;
  const byHabitat: Record<number, number> = {};
  for (const [hid, s] of byHabitatSet) byHabitat[hid] = s.size;

  return {
    byTribe,
    byHabitat,
    allHabitats: allSet.size,
    untrackedTribe: untrackedSet.size,
  };
}


export async function listBriefsForAccount(accountId: number): Promise<BriefForAccount[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT
      b.id, b.project_id, b.account_id, b.habitat_id,
      b.approach_md, b.cadence, b.tone, b.do_md, b.dont_md, b.templates,
      b.ai_suggestion, b.ai_suggestion_at,
      b.updated_at,
      h.name AS habitat_name, h.kind AS habitat_kind, h.url AS habitat_url,
      h.members AS habitat_members,
      t.name AS tribe_name
    FROM community_briefs b
    JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN tribes t ON t.id = h.tribe_id
    WHERE b.tenant_id = ${TENANT} AND b.account_id = ${accountId}
    ORDER BY h.name ASC
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    projectId: String(r.project_id),
    accountId: Number(r.account_id),
    habitatId: Number(r.habitat_id),
    approachMd: String(r.approach_md ?? ''),
    cadence: String(r.cadence ?? ''),
    tone: String(r.tone ?? ''),
    doMd: String(r.do_md ?? ''),
    dontMd: String(r.dont_md ?? ''),
    templates: (r.templates as BriefTemplate[]) ?? [],
    aiSuggestion: r.ai_suggestion ?? null,
    aiSuggestionAt: r.ai_suggestion_at instanceof Date ? r.ai_suggestion_at.toISOString() : (r.ai_suggestion_at ? String(r.ai_suggestion_at) : null),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    habitatName: String(r.habitat_name ?? ''),
    habitatKind: String(r.habitat_kind ?? ''),
    habitatUrl: r.habitat_url ? String(r.habitat_url) : null,
    habitatMembers: Number(r.habitat_members ?? 0),
    tribeName: r.tribe_name ? String(r.tribe_name) : null,
  }));
}

export async function listBriefsForHabitat(habitatId: number): Promise<BriefForHabitat[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT
      b.id, b.project_id, b.account_id, b.habitat_id,
      b.approach_md, b.cadence, b.tone, b.do_md, b.dont_md, b.templates,
      b.ai_suggestion, b.ai_suggestion_at,
      b.updated_at,
      pa.handle AS account_handle, pa.email AS account_email, pa.status AS account_status,
      pa.platform_key,
      p.label AS platform_label
    FROM community_briefs b
    JOIN platform_accounts pa ON pa.id = b.account_id
    JOIN platforms p ON p.key = pa.platform_key
    WHERE b.tenant_id = ${TENANT} AND b.habitat_id = ${habitatId}
    ORDER BY pa.handle ASC NULLS LAST
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    projectId: String(r.project_id),
    accountId: Number(r.account_id),
    habitatId: Number(r.habitat_id),
    approachMd: String(r.approach_md ?? ''),
    cadence: String(r.cadence ?? ''),
    tone: String(r.tone ?? ''),
    doMd: String(r.do_md ?? ''),
    dontMd: String(r.dont_md ?? ''),
    templates: (r.templates as BriefTemplate[]) ?? [],
    aiSuggestion: r.ai_suggestion ?? null,
    aiSuggestionAt: r.ai_suggestion_at instanceof Date ? r.ai_suggestion_at.toISOString() : (r.ai_suggestion_at ? String(r.ai_suggestion_at) : null),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    accountHandle: r.account_handle ? String(r.account_handle) : null,
    accountEmail: r.account_email ? String(r.account_email) : null,
    accountStatus: String(r.account_status ?? 'todo'),
    platformKey: String(r.platform_key ?? ''),
    platformLabel: String(r.platform_label ?? ''),
  }));
}

// Habitats this account COULD engage in but doesn't have a brief yet.
// Filtered to project + same platform_key (we only post the same platform
// with the same account — Reddit handle on r/* habitats, not FB groups).
export async function listAddableHabitatsForAccount(
  projectId: string, accountId: number,
): Promise<Array<{ id: number; name: string; kind: string; url: string | null; tribeName: string | null }>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.kind, h.url, t.name AS tribe_name
    FROM habitats h
    LEFT JOIN tribes t ON t.id = h.tribe_id
    WHERE h.tenant_id = ${TENANT} AND h.project_id = ${projectId}
      AND NOT EXISTS (
        SELECT 1 FROM community_briefs b
        WHERE b.account_id = ${accountId} AND b.habitat_id = h.id
      )
    ORDER BY h.name ASC
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    kind: String(r.kind ?? ''),
    url: r.url ? String(r.url) : null,
    tribeName: r.tribe_name ? String(r.tribe_name) : null,
  }));
}

// Accounts this habitat COULD have a brief from but doesn't yet.
// Filtered to accounts on platforms matching habitat.kind (subreddit →
// reddit accounts only). Pass platformKeys=null to skip the filter
// (used when caller already knows the kind is platform-agnostic).
export async function listAddableAccountsForHabitat(
  projectId: string, habitatId: number, platformKeys: string[] | null,
): Promise<Array<{ id: number; handle: string | null; status: string; platformKey: string; platformLabel: string }>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT pa.id, pa.handle, pa.status, pa.platform_key, p.label AS platform_label
    FROM platform_accounts pa
    JOIN platforms p ON p.key = pa.platform_key
    JOIN project_accounts pj ON pj.account_id = pa.id AND pj.project_id = ${projectId}
    WHERE pa.tenant_id = ${TENANT}
      ${platformKeys && platformKeys.length > 0
        ? sql`AND pa.platform_key = ANY(${platformKeys}::text[])`
        : sql``}
      AND NOT EXISTS (
        SELECT 1 FROM community_briefs b
        WHERE b.habitat_id = ${habitatId} AND b.account_id = pa.id
      )
    ORDER BY pa.handle ASC NULLS LAST
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    handle: r.handle ? String(r.handle) : null,
    status: String(r.status ?? 'todo'),
    platformKey: String(r.platform_key ?? ''),
    platformLabel: String(r.platform_label ?? ''),
  }));
}

// ── Write ─────────────────────────────────────────────────────────

export interface BriefPatch {
  approachMd?: string;
  cadence?: string;
  tone?: string;
  doMd?: string;
  dontMd?: string;
  templates?: BriefTemplate[];
}

export async function upsertBrief(
  projectId: string, accountId: number, habitatId: number, patch: BriefPatch,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const db = ensureDb();

  // Validate FK pairings exist & belong to project
  const valid = await db.execute(sql`
    SELECT
      EXISTS (SELECT 1 FROM project_accounts WHERE project_id = ${projectId} AND account_id = ${accountId}) AS account_ok,
      EXISTS (SELECT 1 FROM habitats WHERE id = ${habitatId} AND project_id = ${projectId}) AS habitat_ok
  `);
  const v = (valid as unknown as Array<Record<string, unknown>>)[0];
  if (!v?.account_ok) return { ok: false, error: 'account not in project' };
  if (!v?.habitat_ok) return { ok: false, error: 'habitat not in project' };

  const existing = await db
    .select({ id: communityBriefs.id })
    .from(communityBriefs)
    .where(and(eq(communityBriefs.accountId, accountId), eq(communityBriefs.habitatId, habitatId)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(communityBriefs)
      .set({
        ...(patch.approachMd != null ? { approachMd: patch.approachMd } : {}),
        ...(patch.cadence    != null ? { cadence: patch.cadence } : {}),
        ...(patch.tone       != null ? { tone: patch.tone } : {}),
        ...(patch.doMd       != null ? { doMd: patch.doMd } : {}),
        ...(patch.dontMd     != null ? { dontMd: patch.dontMd } : {}),
        ...(patch.templates  != null ? { templates: patch.templates } : {}),
        updatedAt: new Date(),
      })
      .where(eq(communityBriefs.id, existing[0]!.id));
    revalidatePath(`/p/${projectId}/resources`);
    revalidatePath(`/p/${projectId}/tribes`);
    return { ok: true, id: existing[0]!.id };
  }

  const inserted = await db.insert(communityBriefs).values({
    tenantId: TENANT,
    projectId,
    accountId,
    habitatId,
    approachMd: patch.approachMd ?? '',
    cadence: patch.cadence ?? '',
    tone: patch.tone ?? '',
    doMd: patch.doMd ?? '',
    dontMd: patch.dontMd ?? '',
    templates: patch.templates ?? [],
  }).returning({ id: communityBriefs.id });

  revalidatePath(`/p/${projectId}/resources`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, id: inserted[0]?.id };
}

// Persist last AI suggestion so F5 doesn't lose it. Auto-creates an empty
// brief row if none exists yet (so the suggestion survives even before the
// user has saved any approach text).
export async function saveBriefSuggestion(
  projectId: string, accountId: number, habitatId: number, suggestion: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // Upsert empty row first so we have somewhere to attach the JSON
  const existing = await db
    .select({ id: communityBriefs.id })
    .from(communityBriefs)
    .where(and(eq(communityBriefs.accountId, accountId), eq(communityBriefs.habitatId, habitatId)))
    .limit(1);
  if (existing.length === 0) {
    // Validate FK pairings
    const valid = await db.execute(sql`
      SELECT
        EXISTS (SELECT 1 FROM project_accounts WHERE project_id = ${projectId} AND account_id = ${accountId}) AS account_ok,
        EXISTS (SELECT 1 FROM habitats WHERE id = ${habitatId} AND project_id = ${projectId}) AS habitat_ok
    `);
    const v = (valid as unknown as Array<Record<string, unknown>>)[0];
    if (!v?.account_ok) return { ok: false, error: 'account not in project' };
    if (!v?.habitat_ok) return { ok: false, error: 'habitat not in project' };
    await db.insert(communityBriefs).values({
      tenantId: TENANT, projectId, accountId, habitatId,
      aiSuggestion: suggestion as Record<string, unknown>,
      aiSuggestionAt: new Date(),
    });
  } else {
    await db.update(communityBriefs)
      .set({ aiSuggestion: suggestion as Record<string, unknown>, aiSuggestionAt: new Date() })
      .where(eq(communityBriefs.id, existing[0]!.id));
  }
  // Don't revalidate aggressively — the suggestion is metadata, doesn't
  // change the rendered brief list. Caller will re-read via state.
  return { ok: true };
}

export async function deleteBrief(projectId: string, briefId: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.delete(communityBriefs).where(eq(communityBriefs.id, briefId));
  revalidatePath(`/p/${projectId}/resources`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}
