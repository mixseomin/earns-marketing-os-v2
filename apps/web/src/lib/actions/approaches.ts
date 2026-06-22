'use server';

// Server actions for approach_playbooks — the SHARED cross-project approach library.
// Same table the ext /api/ext/approaches uses; this is the dashboard (server-action) entry so the
// brief editor can apply a saved angle into approach_md OR promote a brief's approach into the
// library. One concept, two stages (discovery scoring ↔ brief execution), one shared dictionary.
// See decision 2026-06-22-seeding-radar-place-detector.md (Phase 7 pipeline).

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { TENANT } from '@/lib/db-helpers';

export interface ApproachPlaybook {
  id: number; title: string; angle: string; category: string;
  tags: string[]; platformKey: string | null; sourceProjectId: string | null; uses: number;
}

function ensureDb() { const d = getDb(); if (!d) throw new Error('DATABASE_URL not configured.'); return d; }
const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
function mapRow(r: Record<string, unknown>): ApproachPlaybook {
  return {
    id: Number(r.id), title: String(r.title ?? ''), angle: String(r.angle ?? ''),
    category: String(r.category ?? ''), tags: asArr(r.tags),
    platformKey: r.platform_key != null ? String(r.platform_key) : null,
    sourceProjectId: r.source_project_id != null ? String(r.source_project_id) : null,
    uses: Number(r.uses ?? 0),
  };
}

export async function listApproaches(opts?: { q?: string; platformKey?: string | null }): Promise<ApproachPlaybook[]> {
  await getCurrentUser();
  const q = (opts?.q || '').trim().toLowerCase();
  const platformKey = (opts?.platformKey || '').trim() || null;
  const like = q ? `%${q}%` : null;
  const rows = (await ensureDb().execute(sql`
    SELECT id, title, angle, category, tags, source_project_id, platform_key, uses
    FROM approach_playbooks
    WHERE tenant_id = ${TENANT}
      ${platformKey ? sql`AND (platform_key = ${platformKey} OR platform_key IS NULL)` : sql``}
      ${like ? sql`AND (lower(title) LIKE ${like} OR lower(angle) LIKE ${like} OR lower(category) LIKE ${like})` : sql``}
    ORDER BY uses DESC, updated_at DESC LIMIT 100`)) as Array<Record<string, unknown>>;
  return rows.map(mapRow);
}

export async function createApproach(input: {
  title: string; angle: string; category?: string; sourceProjectId?: string | null; platformKey?: string | null;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  await getCurrentUser();
  const title = String(input.title ?? '').trim().slice(0, 160);
  const angle = String(input.angle ?? '').trim().slice(0, 1000);
  if (!title) return { ok: false, error: 'title required' };
  if (!angle) return { ok: false, error: 'angle required' };
  const category = String(input.category ?? '').trim().slice(0, 80);
  const sourceProjectId = String(input.sourceProjectId ?? '').trim() || null;
  const platformKey = String(input.platformKey ?? '').trim() || null;
  const ins = (await ensureDb().execute(sql`
    INSERT INTO approach_playbooks (tenant_id, title, angle, category, source_project_id, platform_key)
    VALUES (${TENANT}, ${title}, ${angle}, ${category}, ${sourceProjectId}, ${platformKey})
    RETURNING id`)) as Array<Record<string, unknown>>;
  return { ok: true, id: ins[0] ? Number(ins[0].id) : undefined };
}

export async function deleteApproach(id: number): Promise<{ ok: boolean }> {
  await getCurrentUser();
  if (!Number.isFinite(id)) return { ok: false };
  await ensureDb().execute(sql`DELETE FROM approach_playbooks WHERE id = ${id} AND tenant_id = ${TENANT}`);
  return { ok: true };
}
