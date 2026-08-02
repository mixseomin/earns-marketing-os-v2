'use server';

// Backlink SOURCE CATALOG actions. The catalog (table backlink_sources, migration 0143) is the
// single reusable source of truth; a project instantiates tasks from it via seedBacklinksFromCatalog
// (fills {product}/{domain} from the project). See decision 2026-07-19-backlink-source-catalog-standardization.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import { nichesForProject } from '../backlink-sites';

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
  usageCount: number;   // distinct projects that have a task from this source
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
    usageCount: 0,
  };
}

// {product}/{domain} are the only placeholders the catalog carries (topic stays illustrative).
// A backlink source is a GENERIC template; every project-specific component is a {param} filled here.
// {product}=name · {domain}=host · {pitch}=real one-liner (describe the product, don't invent) ·
// {link}=a flexible REAL url (homepage — never a fabricated sub-path). DOM-learned form fields are the
// other param set (fill_fields), shared at source/host level. Keep them all as params so one template
// serves every project.
function fillTemplate(tpl: string | null, vars: { product: string; domain: string; pitch: string; link: string }): string {
  if (!tpl) return '';
  return tpl
    .replace(/\{product\}/g, vars.product)
    .replace(/\{domain\}/g, vars.domain)
    .replace(/\{pitch\}/g, vars.pitch)
    .replace(/\{link\}/g, vars.link);
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
  // usage = distinct projects that have a task from each source (batched, not per-row — see reference_backlinks_view_perf).
  const usage = (await db.execute(sql`
    SELECT prep_payload->>'source_url' AS u, count(DISTINCT proj) AS n
    FROM human_tasks, jsonb_object_keys(COALESCE(prep_payload->'site_status', '{}'::jsonb)) AS proj
    WHERE platform_key = 'backlink' AND prep_payload->>'source_url' IS NOT NULL
    GROUP BY 1
  `)) as unknown as Row[];
  const useN = new Map(usage.map((r) => [String(r.u), Number(r.n)]));
  list = list.map((s) => ({ ...s, usageCount: useN.get(s.canonicalUrl) ?? 0 }));
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

// Source detail for a backlink task's drawer: the shared catalog row + the params it fills for THIS
// project ({product}/{domain}/{pitch}/{link}) + the filled preview. Lets the operator see which standard
// source a task comes from and how the generic template becomes project-specific.
export async function getBacklinkSourceForTask(sourceId: number, projectId: string): Promise<{ ok: boolean; source?: BacklinkSource; params?: { product: string; domain: string; pitch: string; link: string }; filled?: string; error?: string }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no-db' };
  const rows = (await db.execute(sql`SELECT * FROM backlink_sources WHERE id = ${Number(sourceId)} LIMIT 1`)) as unknown as Row[];
  const r = rows[0]; if (!r) return { ok: false, error: 'source không tồn tại' };
  const source = mapRow(r);
  let params: { product: string; domain: string; pitch: string; link: string } | undefined;
  let filled: string | undefined;
  if (projectId) {
    const pr = (await db.execute(sql`SELECT name, website, one_liner FROM projects WHERE id = ${projectId} LIMIT 1`)) as unknown as Row[];
    const proj = pr[0];
    if (proj) {
      const product = String(proj.name || projectId);
      const domain = domainOf(String(proj.website || ''), projectId);
      params = { product, domain, pitch: String(proj.one_liner || '').trim() || `${product} (https://${domain})`, link: `https://${domain}` };
      filled = fillTemplate(source.instructionTemplate, params);
    }
  }
  return { ok: true, source, params, filled };
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
    const pr = (await db.execute(sql`SELECT name, website, one_liner FROM projects WHERE id = ${projectId} LIMIT 1`)) as unknown as Row[];
    const proj = pr[0];
    if (!proj) return { ok: false, error: 'project không tồn tại' };
    const product = String(proj.name || projectId);
    const domain = domainOf(String(proj.website || ''), projectId);
    const pitch = String(proj.one_liner || '').trim() || `${product} (https://${domain})`;   // real product desc, never a hardcoded pitch
    const link = `https://${domain}`;                                                          // flexible real URL (homepage) — never a fabricated sub-path

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
      const instr = fillTemplate(s.instruction_template as string, { product, domain, pitch, link });
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

// One-click generator: seed a project with the play-source templates (audience_tags @> {play}) that FIT
// this site's niches — a 'universal' source (any topic) or one whose niche tags overlap the site's
// (nichesForProject). A site with no niche mapping falls back to every play. Reuses seedBacklinksFromCatalog
// → fills {product}/{domain}/{pitch}/{link}, dedups by source_url; results are living-templates.
export async function generatePlaysForProject(projectId: string): Promise<{ ok: boolean; created?: number; skipped?: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  try {
    const niches = nichesForProject(projectId);
    const nicheFilter = niches.length
      ? sql`AND ('universal' = ANY(audience_tags) OR audience_tags && ARRAY[${sql.join(niches.map((n) => sql`${n}`), sql`, `)}]::text[])`
      : sql``;   // unmapped site → all plays
    const rows = (await db.execute(sql`
      SELECT id FROM backlink_sources
      WHERE source_status = 'active' AND audience_tags @> ARRAY['play']::text[]
      ${nicheFilter}
      ORDER BY id
    `)) as unknown as Array<{ id: number }>;
    const ids = rows.map((r) => Number(r.id));
    if (!ids.length) return { ok: true, created: 0, skipped: 0 };
    return await seedBacklinksFromCatalog(projectId, ids);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Fan-out a catalog METHOD into a specific project: seed the method as an anchor task, then queue a
// CLAUDE request (engine=claude, not gpt-4o-mini — which would hallucinate target names) to research
// REAL targets for that project's niche and expand into concrete sibling tasks. Fulfilled by a Claude
// session servicing the ai_content queue (skill backlink-content-queue). Honest by design: real research,
// human-approved drafts, no fabricated URLs.
export async function queueMethodFanout(sourceId: number, projectId: string): Promise<{ ok: boolean; status?: string; already?: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  if (!projectId) return { ok: false, error: 'chưa chọn project' };
  try {
    const srcR = (await db.execute(sql`SELECT canonical_url, name, instruction_template, mechanism, category FROM backlink_sources WHERE id = ${sourceId} LIMIT 1`)) as unknown as Row[];
    const src = srcR[0];
    if (!src) return { ok: false, error: 'method không tồn tại' };
    const prR = (await db.execute(sql`SELECT name, website, one_liner FROM projects WHERE id = ${projectId} LIMIT 1`)) as unknown as Row[];
    const pr = prR[0];
    if (!pr) return { ok: false, error: 'project không tồn tại' };
    // Seed the method as an anchor task (idempotent — dedups by source_url), then resolve its id.
    await seedBacklinksFromCatalog(projectId, [sourceId]);
    const canonical = String(src.canonical_url);
    const tR = (await db.execute(sql`SELECT id FROM human_tasks WHERE platform_key = 'backlink' AND project_id = ${projectId} AND prep_payload->>'source_url' = ${canonical} ORDER BY id DESC LIMIT 1`)) as unknown as Array<{ id: number }>;
    const taskId = Number(tR[0]?.id);
    if (!taskId) return { ok: false, error: 'không seed được anchor task' };
    // One open request per (task) — don't re-queue if already pending.
    const ex = (await db.execute(sql`SELECT id FROM ai_content WHERE task_id = ${taskId} AND kind = 'method-fanout' AND status = 'queued' LIMIT 1`)) as unknown as Row[];
    if (ex[0]) return { ok: true, status: 'queued', already: true };
    const product = String(pr.name || projectId);
    const domain = domainOf(String(pr.website || ''), projectId);
    const niche = String(pr.one_liner || '').trim();
    const prompt = `FAN-OUT method "${src.name}" cho project ${product} (${domain}). Niche: ${niche || '(chưa có one-liner)'}.\n\nMethod template (khung):\n${src.instruction_template || '(trống)'}\n\nYÊU CẦU: research target THẬT cho niche này (subreddit / forum / FB group / directory — có TÊN + URL thật, đã verify). KHÔNG bịa. Bung thành NHIỀU task cụ thể, mỗi task = 1 target thật + các bước actionable (như plays militarycalc). Target không verify được → đưa SEARCH RECIPE cụ thể, tuyệt đối không bịa tên/URL. Tạo task ở dạng draft/pending cho ${product} để chờ duyệt.`;
    const ctx = { source_id: sourceId, source_name: src.name, category: src.category ?? null, method_template: src.instruction_template ?? null, product, domain, niche };
    const insR = (await db.execute(sql`INSERT INTO ai_content (task_id, project_id, site, kind, engine, status, prompt, context) VALUES (${taskId}, ${projectId}, ${domain}, 'method-fanout', 'claude', 'queued', ${prompt}, ${JSON.stringify(ctx)}::jsonb) RETURNING id`)) as unknown as Array<{ id: number }>;
    revalidatePath('/catalog');
    return { ok: true, status: 'queued', id: Number(insR[0]?.id) } as { ok: boolean; status?: string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface BacklinkSourceInput {
  id?: number;
  canonicalUrl: string;
  name: string;
  category?: string | null;
  mechanism?: string | null;
  dofollow?: string | null;
  da?: string | null;
  traffic?: string | null;
  audienceTags?: string[];
  instructionTemplate?: string | null;
  gates?: string | null;
  platformKey?: string | null;
  sourceStatus?: string;
}

// Create or edit a catalog source (admin). New rows upsert by canonical_url; edits target the id.
export async function upsertBacklinkSource(input: BacklinkSourceInput): Promise<{ ok: boolean; id?: number; synced?: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  const url = (input.canonicalUrl || '').trim();
  const name = (input.name || '').trim();
  if (!url || !name) return { ok: false, error: 'thiếu URL hoặc tên' };
  const tags = (input.audienceTags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const tagsSql = tags.length ? sql`ARRAY[${sql.join(tags.map((t) => sql`${t}`), sql`, `)}]::text[]` : sql`'{}'::text[]`;
  const status = input.sourceStatus && ['active', 'broken', 'needs-review', 'archived'].includes(input.sourceStatus) ? input.sourceStatus : 'active';
  try {
    if (input.id) {
      await db.execute(sql`
        UPDATE backlink_sources SET canonical_url = ${url}, name = ${name}, category = ${input.category ?? null},
          mechanism = ${input.mechanism ?? null}, dofollow = ${input.dofollow ?? null}, da = ${input.da ?? null},
          traffic = ${input.traffic ?? null}, audience_tags = ${tagsSql}, instruction_template = ${input.instructionTemplate ?? null},
          gates = ${input.gates ?? null}, platform_key = ${input.platformKey ?? null}, source_status = ${status}, updated_at = now()
        WHERE id = ${input.id}`);
      revalidatePath('/p/[id]/backlinks', 'page');
      // Propagate this template edit to every task already seeded from the source (living template).
      const sync = await syncTasksFromSource(input.id);
      return { ok: true, id: input.id, synced: sync.updated ?? 0 };
    }
    const ins = (await db.execute(sql`
      INSERT INTO backlink_sources (canonical_url, name, category, mechanism, dofollow, da, traffic, audience_tags, instruction_template, gates, platform_key, source_status)
      VALUES (${url}, ${name}, ${input.category ?? null}, ${input.mechanism ?? null}, ${input.dofollow ?? null}, ${input.da ?? null}, ${input.traffic ?? null}, ${tagsSql}, ${input.instructionTemplate ?? null}, ${input.gates ?? null}, ${input.platformKey ?? null}, ${status})
      ON CONFLICT (canonical_url) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, mechanism = EXCLUDED.mechanism,
        dofollow = EXCLUDED.dofollow, da = EXCLUDED.da, traffic = EXCLUDED.traffic, audience_tags = EXCLUDED.audience_tags,
        instruction_template = EXCLUDED.instruction_template, gates = EXCLUDED.gates, platform_key = EXCLUDED.platform_key,
        source_status = EXCLUDED.source_status, updated_at = now()
      RETURNING id`)) as unknown as Array<{ id: number }>;
    revalidatePath('/p/[id]/backlinks', 'page');
    return { ok: true, id: Number(ins[0]?.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Living template: propagate a source's instruction_template edit to EVERY task seeded from it,
// across all projects. The seed (seedBacklinksFromCatalog) only snapshots the filled template into
// human_tasks.instructions at creation time; without this the copy stays frozen. Here we re-fill the
// current template with each task's own project params and overwrite its instructions — EXCEPT tasks
// flagged prep_payload.custom_instructions (locally reshaped via normalizeInstructions → detached).
// Link is prep_payload.source_url === backlink_sources.canonical_url (same key the seed/list use).
export async function syncTasksFromSource(sourceId: number): Promise<{ ok: boolean; updated?: number; skipped?: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  try {
    const sr = (await db.execute(sql`SELECT canonical_url, instruction_template FROM backlink_sources WHERE id = ${Number(sourceId)} LIMIT 1`)) as unknown as Row[];
    const s = sr[0];
    if (!s) return { ok: false, error: 'source không tồn tại' };
    const tpl = (s.instruction_template as string | null) || null;
    if (!tpl) return { ok: true, updated: 0, skipped: 0 };   // no template → nothing to propagate
    const canonical = String(s.canonical_url);
    const tasks = (await db.execute(sql`
      SELECT id, project_id, (prep_payload->>'custom_instructions') AS custom
      FROM human_tasks
      WHERE platform_key = 'backlink' AND prep_payload->>'source_url' = ${canonical}
    `)) as unknown as Array<{ id: number; project_id: string | null; custom: string | null }>;
    const paramCache = new Map<string, { product: string; domain: string; pitch: string; link: string }>();
    const paramsFor = async (pid: string) => {
      const hit = paramCache.get(pid);
      if (hit) return hit;
      const pr = (await db.execute(sql`SELECT name, website, one_liner FROM projects WHERE id = ${pid} LIMIT 1`)) as unknown as Row[];
      const p = pr[0];
      const product = String(p?.name || pid);
      const domain = domainOf(String(p?.website || ''), pid);
      const v = { product, domain, pitch: String(p?.one_liner || '').trim() || `${product} (https://${domain})`, link: `https://${domain}` };
      paramCache.set(pid, v);
      return v;
    };
    let updated = 0, skipped = 0;
    const touched = new Set<string>();
    for (const t of tasks) {
      if (t.custom === 'true' || t.custom === 't') { skipped++; continue; }   // detached — keep bespoke text
      const pid = t.project_id || '';
      if (!pid) { skipped++; continue; }
      const filled = fillTemplate(tpl, await paramsFor(pid));
      await db.execute(sql`UPDATE human_tasks SET instructions = ${filled}, updated_at = now() WHERE id = ${Number(t.id)}`);
      updated++;
      touched.add(pid);
    }
    for (const pid of touched) { revalidatePath(`/p/${pid}/backlinks`, 'page'); revalidatePath(`/p/${pid}/plays`, 'page'); }
    return { ok: true, updated, skipped };
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
