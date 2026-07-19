'use server';

// Backlink SOURCE CATALOG actions. The catalog (table backlink_sources, migration 0143) is the
// single reusable source of truth; a project instantiates tasks from it via seedBacklinksFromCatalog
// (fills {product}/{domain} from the project). See decision 2026-07-19-backlink-source-catalog-standardization.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';

export interface BacklinkSource {
  id: number;
  canonicalUrl: string;
  name: string;
  category: string | null;
  mechanism: string | null;
  dofollow: string | null;
  da: string | null;
  traffic: string | null;
  audienceTags: string[];
  instructionTemplate: string | null;
  gates: string | null;
  platformKey: string | null;
  verifiedAt: string | null;
  sourceStatus: string;
  usedByHere?: boolean; // already seeded to the queried project
}

type Row = Record<string, unknown>;
function mapRow(r: Row): BacklinkSource {
  return {
    id: Number(r.id),
    canonicalUrl: String(r.canonical_url),
    name: String(r.name),
    category: (r.category as string) ?? null,
    mechanism: (r.mechanism as string) ?? null,
    dofollow: (r.dofollow as string) ?? null,
    da: (r.da as string) ?? null,
    traffic: (r.traffic as string) ?? null,
    audienceTags: Array.isArray(r.audience_tags) ? (r.audience_tags as string[]) : [],
    instructionTemplate: (r.instruction_template as string) ?? null,
    gates: (r.gates as string) ?? null,
    platformKey: (r.platform_key as string) ?? null,
    verifiedAt: r.verified_at ? String(r.verified_at) : null,
    sourceStatus: String(r.source_status ?? 'active'),
    usedByHere: r.used_here === true || r.used_here === 't',
  };
}

// {product}/{domain} are the only placeholders the catalog carries (topic stays illustrative).
function fillTemplate(tpl: string | null, product: string, domain: string): string {
  if (!tpl) return '';
  return tpl.replace(/\{product\}/g, product).replace(/\{domain\}/g, domain);
}
function domainOf(website: string, fallback: string): string {
  const d = (website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
  return d || fallback;
}

export async function listBacklinkSources(opts?: {
  audience?: string; category?: string; status?: string; projectId?: string;
}): Promise<BacklinkSource[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT * FROM backlink_sources ORDER BY source_status, COALESCE(category, 'zzz'), name
  `)) as unknown as Row[];
  let list = rows.map(mapRow);
  if (opts?.projectId) {
    const used = (await db.execute(sql`
      SELECT DISTINCT prep_payload->>'source_url' AS u FROM human_tasks
      WHERE platform_key = 'backlink' AND prep_payload->'site_status' ? ${opts.projectId}
    `)) as unknown as Row[];
    const have = new Set(used.map((r) => String(r.u)));
    list = list.map((s) => ({ ...s, usedByHere: have.has(s.canonicalUrl) }));
  }
  if (opts?.audience) list = list.filter((s) => s.audienceTags.includes(opts.audience!));
  if (opts?.category) list = list.filter((s) => s.category === opts.category);
  if (opts?.status) list = list.filter((s) => s.sourceStatus === opts.status);
  return list;
}

// Instantiate backlink tasks for a project from selected catalog sources (dedupe: skip sources the
// project already has). Fills {product}/{domain} from the project's name/website.
export async function seedBacklinksFromCatalog(
  projectId: string,
  sourceIds: number[],
): Promise<{ ok: boolean; created?: number; skipped?: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  if (!projectId || !/^[a-z0-9_-]+$/i.test(projectId)) return { ok: false, error: 'projectId không hợp lệ' };
  if (!sourceIds?.length) return { ok: false, error: 'chưa chọn nguồn' };
  try {
    const pr = (await db.execute(sql`SELECT name, website FROM projects WHERE id = ${projectId} LIMIT 1`)) as unknown as Row[];
    const proj = pr[0];
    if (!proj) return { ok: false, error: 'project không tồn tại' };
    const product = String(proj.name || projectId);
    const domain = domainOf(String(proj.website || ''), projectId);

    const idList = sql.join(sourceIds.map((n) => sql`${Number(n)}`), sql`, `);
    const srcs = (await db.execute(sql`SELECT * FROM backlink_sources WHERE id IN (${idList})`)) as unknown as Row[];
    const ex = (await db.execute(sql`
      SELECT DISTINCT prep_payload->>'source_url' AS u FROM human_tasks
      WHERE platform_key = 'backlink' AND prep_payload->'site_status' ? ${projectId}
    `)) as unknown as Row[];
    const have = new Set(ex.map((r) => String(r.u)));

    let created = 0, skipped = 0;
    for (const s of srcs) {
      const url = String(s.canonical_url);
      if (have.has(url)) { skipped++; continue; }
      const instr = fillTemplate(s.instruction_template as string, product, domain);
      const title = `${s.name} — ${product}`;
      const pp = {
        source_url: url,
        mechanism: s.mechanism ?? null,
        da: s.da ?? null,
        dofollow: s.dofollow ?? null,
        traffic: s.traffic ?? null,
        site_status: { [projectId]: 'pending' },
        seeded_from_catalog: true,
      };
      await db.execute(sql`
        INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, status)
        VALUES ('self', ${projectId}, ${title}, ${instr}, ${JSON.stringify(pp)}::jsonb, 'backlink', 'pending')
      `);
      created++;
    }
    revalidatePath(`/p/${projectId}/backlinks`);
    return { ok: true, created, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setBacklinkSourceStatus(id: number, status: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  if (!['active', 'broken', 'needs-review', 'archived'].includes(status)) return { ok: false, error: 'status không hợp lệ' };
  try {
    await db.execute(sql`UPDATE backlink_sources SET source_status = ${status}, updated_at = now() WHERE id = ${id}`);
    revalidatePath('/p/[id]/backlinks', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Freshness re-check (weekly cron): confirm each catalog action URL still resolves. Only a clear
// 404/410 demotes to 'broken' (honest — a 403/timeout is inconclusive, never cries wolf). A previously
// broken URL that resolves again self-heals to 'active'. Stamps verified_at on any conclusive check.
export async function verifyBacklinkSources(): Promise<{ ok: boolean; checked: number; broken: number; healed: number }> {
  const db = getDb();
  if (!db) return { ok: false, checked: 0, broken: 0, healed: 0 };
  const rows = (await db.execute(sql`
    SELECT id, canonical_url, source_status FROM backlink_sources
    WHERE source_status IN ('active', 'broken', 'needs-review') AND canonical_url LIKE 'http%'
  `)) as unknown as Row[];
  let checked = 0, broken = 0, healed = 0;
  for (const r of rows) {
    const id = Number(r.id);
    const url = String(r.canonical_url);
    const wasBroken = r.source_status === 'broken';
    let dead: boolean | null = null; // null = inconclusive
    try {
      const res = await fetch(url, {
        method: 'GET', redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; MOS2-linkcheck/1.0)' },
        signal: AbortSignal.timeout(20000),
      });
      dead = res.status === 404 || res.status === 410; // reachable-but-blocked (403/405/5xx) is NOT dead
    } catch {
      dead = null; // network/timeout = inconclusive
    }
    if (dead === null) continue; // don't touch on inconclusive
    checked++;
    if (dead) {
      broken++;
      await db.execute(sql`UPDATE backlink_sources SET source_status = 'broken', verified_at = now(), updated_at = now() WHERE id = ${id}`);
    } else {
      if (wasBroken) healed++;
      await db.execute(sql`
        UPDATE backlink_sources
        SET verified_at = now(), source_status = CASE WHEN source_status = 'broken' THEN 'active' ELSE source_status END, updated_at = now()
        WHERE id = ${id}
      `);
    }
  }
  return { ok: true, checked, broken, healed };
}
