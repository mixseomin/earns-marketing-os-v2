'use server';

// Architecture Studio — live instance binding + consistency checks + layout persistence.
// Reads real rows so each block can be validated against the model ("phản ánh đúng").
// Identifiers come from the trusted spec allowlist (BINDABLE_TABLES); values are parameterized.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { BINDABLE_TABLES, OBJ_BY_KEY } from '@/components/architecture/spec';
import { METRIC_PAGE_KIND, getMetricFieldSchema, type MetricKey } from '@/lib/metric-field-schema';

type Row = Record<string, unknown>;

export interface InstanceRef { id: string; label: string; sub?: string }
export interface Issue { level: 'error' | 'warn' | 'ok'; msg: string }
export interface InstanceDetail { row: Row; issues: Issue[] }

// Identifiers are spec-sourced, but sanitize defensively before raw interpolation.
function ident(s: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`bad identifier: ${s}`);
  return s;
}

async function exists(table: string, col: string, val: unknown): Promise<boolean> {
  const db = getDb();
  if (!db) return true; // can't verify → don't false-alarm
  try {
    const res = await db.execute(
      sql`SELECT 1 FROM ${sql.raw(ident(table))} WHERE ${sql.raw(ident(col))} = ${val} LIMIT 1`,
    );
    return (res as unknown as unknown[]).length > 0;
  } catch {
    return true;
  }
}

// ── instance picker ──────────────────────────────────────────────────────────
// A child entity is meaningless without its parent context, so each option carries
// a `sub` (parent label) and child entities (channel) can be filtered by a parentId.
export async function listInstances(objectKey: string, projectId?: string, parentId?: string): Promise<InstanceRef[]> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return [];
  const db = getDb();
  if (!db) return [];
  const table = ident(obj.table);
  const pkr = obj.picker;
  const pk = sql.raw(`t.${ident(obj.pk || 'id')}`);
  // primary label: a meaningful composite (labelExpr) when defined, else the bare labelCol
  const labelSel = pkr?.labelExpr ? sql.raw(`(${pkr.labelExpr})`) : sql.raw(`t.${ident(obj.labelCol || obj.pk || 'id')}`);
  const subSel = pkr?.subExpr ? sql`, (${sql.raw(pkr.subExpr)})::text AS sub` : sql``;
  const joinSql = pkr?.join ? sql.raw(pkr.join) : sql``;

  const conds: ReturnType<typeof sql>[] = [];
  if (obj.projectScoped && projectId && !pkr?.crossProject) conds.push(sql`t.project_id = ${projectId}`);
  if (pkr?.parent && parentId) conds.push(sql`${sql.raw('t.' + ident(pkr.parent.col))} = ${parentId}`);
  const whereSql = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;

  try {
    const res = await db.execute(sql`
      SELECT ${pk}::text AS id, ${labelSel}::text AS label${subSel}
      FROM ${sql.raw(table)} t
      ${joinSql}
      ${whereSql}
      ORDER BY ${pk} DESC
      LIMIT 400`);
    const rows = res as unknown as Array<{ id: string; label: string | null; sub: string | null }>;
    return rows.map((r) => ({ id: r.id, label: r.label || r.id, sub: r.sub || undefined }));
  } catch {
    return [];
  }
}

// ── instance detail + consistency checks ─────────────────────────────────────
export async function getInstance(objectKey: string, id: string): Promise<InstanceDetail | null> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return null;
  const db = getDb();
  if (!db) return null;
  const table = ident(obj.table);
  const pk = ident(obj.pk || 'id');
  let row: Row | null = null;
  try {
    const res = await db.execute(
      sql`SELECT * FROM ${sql.raw(table)} WHERE ${sql.raw(pk)}::text = ${id} LIMIT 1`,
    );
    const rows = res as unknown as Row[];
    row = rows[0] || null;
  } catch (e) {
    return { row: {}, issues: [{ level: 'error', msg: `query failed: ${e instanceof Error ? e.message : 'error'}` }] };
  }
  if (!row) return null;
  const issues = await runChecks(objectKey, row);
  return { row, issues };
}

async function runChecks(objectKey: string, row: Row): Promise<Issue[]> {
  const out: Issue[] = [];
  const s = (k: string) => (row[k] == null ? '' : String(row[k]));

  switch (objectKey) {
    case 'account': {
      const pk = s('platform_key');
      if (pk === 'x') out.push({ level: 'warn', msg: "platform_key='x' — should be canonical 'twitter'" });
      else if (pk && !(await exists('platforms', 'key', pk))) out.push({ level: 'error', msg: `platform_key='${pk}' not in platforms` });
      else if (pk) out.push({ level: 'ok', msg: `platform '${pk}' resolves` });
      if (!s('status')) out.push({ level: 'warn', msg: 'status empty' });
      break;
    }
    case 'people': {
      const pk = s('platform_key');
      if (pk === 'x') out.push({ level: 'warn', msg: "platform_key='x' — scene stores canonical 'twitter'" });
      else if (pk && !(await exists('platforms', 'key', pk))) out.push({ level: 'error', msg: `platform_key='${pk}' not in platforms` });
      if (s('habitat_id') && !(await exists('habitats', 'id', row['habitat_id']))) out.push({ level: 'error', msg: `habitat_id=${s('habitat_id')} missing` });
      break;
    }
    case 'habitat': {
      const pk = s('platform_key');
      const tk = s('technology_key');
      if (pk && !(await exists('platforms', 'key', pk))) out.push({ level: 'error', msg: `platform_key='${pk}' not in platforms` });
      if (tk && !(await exists('platform_technologies', 'key', tk))) out.push({ level: 'error', msg: `technology_key='${tk}' not in platform_technologies` });
      if (!pk && !tk) out.push({ level: 'warn', msg: 'no platform_key nor technology_key — detection may miss' });
      break;
    }
    case 'card': {
      const hasBrief = !!s('brief_id');
      const hasDirect = !!s('account_id') && !!s('habitat_id');
      if (!hasBrief && !hasDirect) out.push({ level: 'error', msg: 'identity unresolved: no brief_id and no (account_id+habitat_id)' });
      else out.push({ level: 'ok', msg: hasBrief ? 'identity via brief' : 'identity via direct account+habitat' });
      if (s('brief_id') && !(await exists('community_briefs', 'id', row['brief_id']))) out.push({ level: 'error', msg: `brief_id=${s('brief_id')} missing` });
      break;
    }
    case 'brief': {
      if (s('account_id') && !(await exists('platform_accounts', 'id', row['account_id']))) out.push({ level: 'error', msg: `account_id=${s('account_id')} missing` });
      if (s('habitat_id') && !(await exists('habitats', 'id', row['habitat_id']))) out.push({ level: 'error', msg: `habitat_id=${s('habitat_id')} missing` });
      if (s('account_id') && s('habitat_id')) out.push({ level: 'ok', msg: 'links account ↔ habitat' });
      break;
    }
    case 'selector': {
      const kind = s('scope_kind');
      const key = s('scope_key');
      const map: Record<string, [string, string]> = {
        platform: ['platforms', 'key'],
        engine: ['platform_technologies', 'key'],
        habitat: ['habitats', 'id'],
      };
      const tgt = map[kind];
      if (tgt && key && !(await exists(tgt[0], tgt[1], key))) out.push({ level: 'error', msg: `scope ${kind}='${key}' not in ${tgt[0]}` });
      else if (tgt && key) out.push({ level: 'ok', msg: `scope ${kind} resolves` });
      const spec = row['spec'];
      if (!spec || (typeof spec === 'object' && !(spec as Row)['css'])) out.push({ level: 'warn', msg: 'spec.css empty' });
      break;
    }
    case 'interaction': {
      if (s('people_id') && !(await exists('people', 'id', row['people_id']))) out.push({ level: 'error', msg: `people_id=${s('people_id')} missing` });
      if (s('card_id') && !(await exists('cards', 'id', row['card_id']))) out.push({ level: 'error', msg: `card_id=${s('card_id')} missing` });
      break;
    }
    case 'platform': {
      const tk = s('technology_key');
      if (tk && !(await exists('platform_technologies', 'key', tk))) out.push({ level: 'error', msg: `technology_key='${tk}' not in platform_technologies` });
      break;
    }
    default:
      break;
  }
  if (out.length === 0) out.push({ level: 'ok', msg: 'no issues detected' });
  return out;
}

// NOTE: this Studio is a READ-ONLY map of the existing system — it creates no new
// tables/objects. Canvas layout is persisted client-side (localStorage), not in the DB.

// Object metadata for the client (avoids shipping the whole spec twice).
export async function objectMeta(objectKey: string): Promise<{ projectScoped: boolean; bindable: boolean }> {
  const obj = OBJ_BY_KEY[objectKey];
  return { projectScoped: !!obj?.projectScoped, bindable: !!obj?.table };
}

// Refresh the display label of persisted bindings on load, so the canvas shows the
// current meaningful label immediately (no click) — even if localStorage held an old one.
export async function resolveBoundLabels(items: Array<{ key: string; id: string }>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const db = getDb();
  if (!db) return out;
  await Promise.all(items.map(async ({ key, id }) => {
    const obj = BINDABLE_TABLES[key];
    if (!obj?.table) return;
    try {
      const pkr = obj.picker;
      const labelSel = pkr?.labelExpr ? `(${pkr.labelExpr})` : `t.${ident(obj.labelCol || obj.pk || 'id')}`;
      const res = await db.execute(sql`
        SELECT ${sql.raw(labelSel)}::text AS label
        FROM ${sql.raw(ident(obj.table))} t
        ${pkr?.join ? sql.raw(pkr.join) : sql``}
        WHERE t.${sql.raw(ident(obj.pk || 'id'))}::text = ${id} LIMIT 1`);
      const rows = res as unknown as Array<{ label: string | null }>;
      if (rows[0]?.label) out[key] = rows[0].label;
    } catch { /* */ }
  }));
  return out;
}

// Default the studio to the project with the most content, so project-scoped pickers
// aren't empty on first load (the source of "many nodes have nothing to pick").
export async function busiestProjectId(): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r = await db.execute(sql`SELECT project_id FROM cards WHERE project_id IS NOT NULL GROUP BY project_id ORDER BY count(*) DESC LIMIT 1`);
    const rows = r as unknown as Array<{ project_id: string }>;
    return rows[0]?.project_id || null;
  } catch { return null; }
}

// ── system-wide health scan (set-based anti-joins — scans ALL rows, finds every
//    cross-layer inconsistency, not a sample). The QC payoff for "lỗi vặt do chồng chéo". ──
export interface ScanItem { level: 'error' | 'warn'; msg: string; count: number }
export interface ObjScan { rows: number; errors: number; warns: number; items: ScanItem[] }
export type ScanResult = Record<string, ObjScan>;

export async function systemScan(projectId?: string): Promise<ScanResult> {
  const db = getDb();
  if (!db) return {};
  const P = projectId && /^[a-z0-9_-]+$/i.test(projectId) ? projectId : null;
  const result: ScanResult = {};

  const num = async (q: ReturnType<typeof sql>): Promise<number> => {
    try {
      const r = await db.execute(q);
      const rows = r as unknown as Array<{ n: number | string }>;
      return Number(rows[0]?.n || 0);
    } catch { return 0; }
  };

  // row counts for every bindable object
  for (const [key, obj] of Object.entries(BINDABLE_TABLES)) {
    if (!obj.table) continue;
    const table = ident(obj.table);
    const rows = await num(sql`SELECT count(*)::int AS n FROM ${sql.raw(table)} ${obj.projectScoped && P ? sql`WHERE project_id = ${P}` : sql``}`);
    result[key] = { rows, errors: 0, warns: 0, items: [] };
  }

  const add = async (key: string, level: 'error' | 'warn', msg: string, q: ReturnType<typeof sql>) => {
    const c = await num(q);
    const o = result[key];
    if (c > 0 && o) { o.items.push({ level, msg, count: c }); if (level === 'error') o.errors += c; else o.warns += c; }
  };
  const fPe = P ? sql` AND pe.project_id = ${P}` : sql``;
  const fH = P ? sql` AND h.project_id = ${P}` : sql``;
  const fC = P ? sql` AND c.project_id = ${P}` : sql``;
  const fB = P ? sql` AND b.project_id = ${P}` : sql``;

  await Promise.all([
    // account (shared across projects → global, no project filter)
    add('account', 'error', "platform_key not in platforms", sql`SELECT count(*)::int AS n FROM platform_accounts a WHERE a.platform_key IS NOT NULL AND a.platform_key <> '' AND NOT EXISTS (SELECT 1 FROM platforms p WHERE p.key = a.platform_key)`),
    add('account', 'warn', "platform_key='x' — use canonical 'twitter'", sql`SELECT count(*)::int AS n FROM platform_accounts a WHERE a.platform_key = 'x'`),
    // people
    add('people', 'warn', "platform_key='x' — scene stores 'twitter'", sql`SELECT count(*)::int AS n FROM people pe WHERE pe.platform_key = 'x'${fPe}`),
    add('people', 'error', 'habitat_id dangling', sql`SELECT count(*)::int AS n FROM people pe WHERE pe.habitat_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM habitats h WHERE h.id = pe.habitat_id)${fPe}`),
    // habitat
    add('habitat', 'error', 'platform_key not in platforms', sql`SELECT count(*)::int AS n FROM habitats h WHERE h.platform_key IS NOT NULL AND h.platform_key <> '' AND NOT EXISTS (SELECT 1 FROM platforms p WHERE p.key = h.platform_key)${fH}`),
    add('habitat', 'error', 'technology_key not in platform_technologies', sql`SELECT count(*)::int AS n FROM habitats h WHERE h.technology_key IS NOT NULL AND h.technology_key <> '' AND NOT EXISTS (SELECT 1 FROM platform_technologies t WHERE t.key = h.technology_key)${fH}`),
    add('habitat', 'warn', 'same community duplicated across projects (approach belongs in brief, not habitat)', sql`SELECT count(*)::int AS n FROM (SELECT url FROM habitats WHERE url <> '' GROUP BY url HAVING count(DISTINCT project_id) > 1) d`),
    // card
    add('card', 'warn', 'identity unresolved (no brief, no direct acct+habitat)', sql`SELECT count(*)::int AS n FROM cards c WHERE c.brief_id IS NULL AND (c.account_id IS NULL OR c.habitat_id IS NULL)${fC}`),
    add('card', 'error', 'brief_id dangling', sql`SELECT count(*)::int AS n FROM cards c WHERE c.brief_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM community_briefs b WHERE b.id = c.brief_id)${fC}`),
    // brief
    add('brief', 'error', 'account_id dangling', sql`SELECT count(*)::int AS n FROM community_briefs b WHERE b.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM platform_accounts a WHERE a.id = b.account_id)${fB}`),
    add('brief', 'error', 'habitat_id dangling', sql`SELECT count(*)::int AS n FROM community_briefs b WHERE b.habitat_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM habitats h WHERE h.id = b.habitat_id)${fB}`),
    // selector (global)
    add('selector', 'error', "platform scope not in platforms", sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.scope_kind = 'platform' AND NOT EXISTS (SELECT 1 FROM platforms p WHERE p.key = s.scope_key)`),
    add('selector', 'error', "engine scope not in platform_technologies", sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.scope_kind = 'engine' AND NOT EXISTS (SELECT 1 FROM platform_technologies t WHERE t.key = s.scope_key)`),
    add('selector', 'error', "habitat scope not in habitats", sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.scope_kind = 'habitat' AND NOT EXISTS (SELECT 1 FROM habitats h WHERE h.id::text = s.scope_key)`),
    add('selector', 'warn', 'spec.css empty', sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE COALESCE(s.spec->>'css','') = ''`),
    add('selector', 'warn', "Reddit page_kind (subreddit-*) on a non-reddit platform — taxonomy leak, rename to a platform-neutral kind", sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.page_kind LIKE 'subreddit%' AND s.scope_key <> 'reddit'`),
    // interaction (global)
    add('interaction', 'error', 'people_id dangling', sql`SELECT count(*)::int AS n FROM interactions i WHERE NOT EXISTS (SELECT 1 FROM people pe WHERE pe.id = i.people_id)`),
    // platform (global)
    add('platform', 'error', 'technology_key not in platform_technologies', sql`SELECT count(*)::int AS n FROM platforms p WHERE p.technology_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM platform_technologies t WHERE t.key = p.technology_key)`),
  ]);

  return result;
}

// ── selector library for a scope (per platform/engine/habitat × entity) ──
export interface SelRow { pageKind: string; fieldName: string; css: string; attr: string | null; source: string; confidence: number }
export async function listSelectors(scopeKind: string, scopeKey: string): Promise<SelRow[]> {
  const db = getDb();
  if (!db) return [];
  if (!['platform', 'engine', 'habitat'].includes(scopeKind)) return [];
  try {
    const r = await db.execute(sql`
      SELECT page_kind, field_name, spec, source, confidence
      FROM selector_overrides
      WHERE scope_kind = ${scopeKind} AND scope_key = ${scopeKey}
      ORDER BY page_kind, field_name`);
    const rows = r as unknown as Array<{ page_kind: string; field_name: string; spec: { css?: string; attr?: string } | null; source: string; confidence: number }>;
    return rows.map((x) => ({
      pageKind: x.page_kind, fieldName: x.field_name,
      css: x.spec?.css || '', attr: x.spec?.attr || null,
      source: x.source, confidence: x.confidence,
    }));
  } catch { return []; }
}

// ── full selector catalog (compact overview: scope → page_kind → fields) ──
export interface SelCatRow { id: string; scopeKind: string; scopeKey: string; pageKind: string; fieldName: string; source: string; hasCss: boolean }
export async function selectorCatalog(): Promise<SelCatRow[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const r = await db.execute(sql`
      SELECT id::text AS id, scope_kind, scope_key, page_kind, field_name, source,
             (COALESCE(spec->>'css','') <> '') AS has_css
      FROM selector_overrides
      ORDER BY scope_kind, scope_key, page_kind, field_name`);
    const rows = r as unknown as Array<{ id: string; scope_kind: string; scope_key: string; page_kind: string; field_name: string; source: string; has_css: boolean }>;
    return rows.map((x) => ({
      id: x.id, scopeKind: x.scope_kind, scopeKey: x.scope_key, pageKind: x.page_kind,
      fieldName: x.field_name, source: x.source, hasCss: x.has_css,
    }));
  } catch { return []; }
}

// ── one selector row, full detail (for the 2nd-layer drawer) ──
export interface SelDetail {
  id: string; scopeKind: string; scopeKey: string; pageKind: string; fieldName: string;
  source: string; confidence: number | null; lastVerifiedAt: string | null;
  spec: Record<string, unknown>;
}
export async function getSelectorRow(id: string): Promise<SelDetail | null> {
  const db = getDb();
  if (!db || !/^\d+$/.test(id)) return null;
  try {
    const r = await db.execute(sql`
      SELECT id::text AS id, scope_kind, scope_key, page_kind, field_name, source,
             confidence, last_verified_at, spec
      FROM selector_overrides WHERE id = ${id} LIMIT 1`);
    const rows = r as unknown as Array<{ id: string; scope_kind: string; scope_key: string; page_kind: string; field_name: string; source: string; confidence: number | null; last_verified_at: string | null; spec: Record<string, unknown> | null }>;
    const x = rows[0];
    if (!x) return null;
    return {
      id: x.id, scopeKind: x.scope_kind, scopeKey: x.scope_key, pageKind: x.page_kind,
      fieldName: x.field_name, source: x.source, confidence: x.confidence,
      lastVerifiedAt: x.last_verified_at, spec: x.spec || {},
    };
  } catch { return null; }
}

// ── live ext activity (ext_call_log) — what the extension does on real sites ──
export interface ExtCall {
  id: string; ts: string; endpoint: string; method: string; status: number;
  durationMs: number | null; host: string; extVersion: string | null; errorMsg: string | null;
  who: string | null; place: string | null; platform: string | null; result: string | null;
  objKey: string | null; objId: string | null; // related studio object + specific instance to pre-bind
}
const EP_OBJ: Record<string, string> = {
  habitats: 'habitat', briefs: 'brief', brief: 'brief', insights: 'card',
  'learn-selectors': 'selector', 'save-selector': 'selector', 'train-selector': 'selector',
  'clear-selector': 'selector', 'suggest-selector': 'selector', selectors: 'selector',
  accounts: 'account', scene: 'interaction',
};
export interface ExtActivity {
  rows: ExtCall[];
  stats: { total: number; last24h: number; last7d: number; errors7d: number; lastCallAt: string | null; versions: Array<{ v: string; last: string }> };
  endpoints: Array<{ endpoint: string; n: number; errs: number; avgMs: number | null; last: string }>;
}
function jstr(v: unknown): string | null { return v == null ? null : String(v); }
export async function extActivity(opts?: { limit?: number; errorsOnly?: boolean }): Promise<ExtActivity> {
  const db = getDb();
  const empty: ExtActivity = { rows: [], stats: { total: 0, last24h: 0, last7d: 0, errors7d: 0, lastCallAt: null, versions: [] }, endpoints: [] };
  if (!db) return empty;
  const limit = Math.min(Math.max(opts?.limit || 60, 1), 200);
  try {
    const r = await db.execute(sql`
      SELECT id::text AS id, created_at, endpoint, method, status, duration_ms, page_url, ext_version, error_msg, payload_meta, response_meta
      FROM ext_call_log ${opts?.errorsOnly ? sql`WHERE status >= 400` : sql``}
      ORDER BY created_at DESC LIMIT ${limit}`);
    const raw = r as unknown as Array<{ id: string; created_at: string; endpoint: string; method: string; status: number; duration_ms: number | null; page_url: string | null; ext_version: string | null; error_msg: string | null; payload_meta: Record<string, unknown> | null; response_meta: Record<string, unknown> | null }>;
    const rows: ExtCall[] = raw.map((x) => {
      const p = x.payload_meta || {}; const rs = x.response_meta || {};
      const viewer = (rs.viewer as Record<string, unknown>) || {};
      const host = (x.page_url || '').match(/:\/\/([^/]+)/)?.[1] || '';
      const result = jstr(rs.action) || jstr(viewer.briefAction) || jstr(rs.joinStatus) || (rs.fields != null ? `${rs.fields} fields` : null);
      const objKey = EP_OBJ[x.endpoint] || null;
      const objId = x.endpoint === 'habitats' ? jstr(rs.id)
        : (x.endpoint === 'briefs' || x.endpoint === 'brief') ? jstr(rs.briefId)
        : x.endpoint === 'insights' ? jstr(rs.cardId)
        : x.endpoint === 'accounts' ? (jstr(rs.id) || jstr(rs.accountId)) : null;
      return {
        id: x.id, ts: x.created_at, endpoint: x.endpoint, method: x.method, status: x.status,
        durationMs: x.duration_ms, host, extVersion: x.ext_version, errorMsg: x.error_msg,
        who: jstr(p.handle) || jstr(p.viewer_handle) || jstr(viewer.handle),
        place: jstr(p.habitat_name) || jstr(p.name), platform: jstr(p.platform_key), result,
        objKey, objId,
      };
    });
    const s = await db.execute(sql`
      SELECT count(*)::int total,
             count(*) FILTER (WHERE created_at > now()-interval '24 hours')::int d1,
             count(*) FILTER (WHERE created_at > now()-interval '7 days')::int d7,
             count(*) FILTER (WHERE status >= 400 AND created_at > now()-interval '7 days')::int errs7d,
             max(created_at)::text last FROM ext_call_log`);
    const st = (s as unknown as Array<{ total: number; d1: number; d7: number; errs7d: number; last: string | null }>)[0];
    const v = await db.execute(sql`SELECT ext_version v, max(created_at)::text last FROM ext_call_log WHERE ext_version <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 4`);
    const versions = (v as unknown as Array<{ v: string; last: string }>).map((x) => ({ v: x.v, last: x.last }));
    const e = await db.execute(sql`
      SELECT endpoint, count(*)::int n, count(*) FILTER (WHERE status >= 400)::int errs,
             round(avg(duration_ms))::int avg_ms, max(created_at)::text last
      FROM ext_call_log GROUP BY 1 ORDER BY 2 DESC LIMIT 16`);
    const endpoints = (e as unknown as Array<{ endpoint: string; n: number; errs: number; avg_ms: number | null; last: string }>).map((x) => ({ endpoint: x.endpoint, n: x.n, errs: x.errs, avgMs: x.avg_ms, last: x.last }));
    return { rows, stats: { total: st?.total || 0, last24h: st?.d1 || 0, last7d: st?.d7 || 0, errors7d: st?.errs7d || 0, lastCallAt: st?.last || null, versions }, endpoints };
  } catch { return empty; }
}

// ── Metric tracking coverage (the "chỗ quản lý" cho engagement DOM capture) ──
// Ma trận metric × platform: mỗi ô = có selector_overrides (page_kind='post-metrics')
// nào feed metric này cho platform đó không. Lộ GAP (đỏ): platform đang có card đã
// đăng nhưng KHÔNG selector → metric không bao giờ bắt được (vd Reddit views).
// Anomaly: insights có data mà KHÔNG selector nào feed (= đến từ API/đường khác).
const PLATFORM_CANON_MC: Record<string, string> = { x: 'twitter', 'x.com': 'twitter', 'twitter.com': 'twitter' };
const canonPf = (k: string) => PLATFORM_CANON_MC[k.toLowerCase()] || k.toLowerCase();

export interface MetricCell {
  metric: MetricKey; field: string; platform: string;
  trained: boolean; scope: 'platform' | 'engine' | 'habitat' | null; scopeKey: string | null;
  source: string | null; via: string | null; hasCss: boolean; selId: string | null;
  cards: number;        // posted cards on this platform
  populated: number;    // cards where the matching insights_* column is non-null
  gap: boolean;         // wanted (cards>0) but no selector
  apiFed: boolean;      // populated>0 but no selector → value comes from API/other path, not DOM
}
export interface MetricCoverage {
  metrics: Array<{ metric: MetricKey; field: string; label: string; hint: string; insightsCol: string }>;
  platforms: Array<{ key: string; technologyKey: string | null; cards: number }>;
  cells: MetricCell[];
}
export async function metricCoverage(): Promise<MetricCoverage> {
  const schema = getMetricFieldSchema();
  const metrics = schema.map((e) => ({ metric: e.metric, field: e.field, label: e.label, hint: e.hint, insightsCol: e.insightsCol }));
  const db = getDb();
  const empty: MetricCoverage = { metrics, platforms: [], cells: [] };
  if (!db) return empty;
  try {
    // 1) Posted cards per platform + how many have each metric column populated.
    const pf = await db.execute(sql`
      WITH card_pf AS (
        SELECT c.id,
          COALESCE(pa.platform_key, h.platform_key) AS platform,
          c.insights_views_count AS m_views, c.insights_score AS m_score,
          c.insights_reply_count AS m_reply, c.insights_engagements AS m_share
        FROM cards c
        LEFT JOIN community_briefs b ON b.id = c.brief_id
        LEFT JOIN platform_accounts pa ON pa.id = COALESCE(c.account_id, b.account_id)
        LEFT JOIN habitats h ON h.id = COALESCE(c.habitat_id, b.habitat_id)
        WHERE c.post_url IS NOT NULL
      )
      SELECT cp.platform, p.technology_key AS tech, count(*)::int AS cards,
             count(cp.m_views)::int AS v, count(cp.m_score)::int AS s,
             count(cp.m_reply)::int AS r, count(cp.m_share)::int AS sh
      FROM card_pf cp LEFT JOIN platforms p ON p.key = cp.platform
      WHERE cp.platform IS NOT NULL AND cp.platform <> ''
      GROUP BY cp.platform, p.technology_key`);
    const pfRows = pf as unknown as Array<{ platform: string; tech: string | null; cards: number; v: number; s: number; r: number; sh: number }>;

    // 2) Trained metric selectors (post-metrics rows).
    const sel = await db.execute(sql`
      SELECT id::text AS id, scope_kind, scope_key, field_name, source,
             spec->>'via' AS via, (COALESCE(spec->>'css','') <> '') AS has_css
      FROM selector_overrides WHERE page_kind = ${METRIC_PAGE_KIND}`);
    const selRows = sel as unknown as Array<{ id: string; scope_kind: string; scope_key: string; field_name: string; source: string; via: string | null; has_css: boolean }>;

    // Aggregate platforms: cards-derived + any platform-scope selector target (trained ahead of cards).
    const popOf: Record<string, Record<MetricKey, number>> = {};
    const techOf: Record<string, string | null> = {};
    const cardsOf: Record<string, number> = {};
    for (const x of pfRows) {
      const k = canonPf(x.platform);
      cardsOf[k] = (cardsOf[k] || 0) + x.cards;
      techOf[k] = techOf[k] || x.tech;
      const cur = popOf[k] || { views: 0, score: 0, replyCount: 0, shareCount: 0 };
      cur.views += x.v; cur.score += x.s; cur.replyCount += x.r; cur.shareCount += x.sh;
      popOf[k] = cur;
    }
    for (const r of selRows) if (r.scope_kind === 'platform') { const k = canonPf(r.scope_key); if (!(k in cardsOf)) cardsOf[k] = 0; }

    const platforms = Object.keys(cardsOf).sort((a, b) => ((cardsOf[b] ?? 0) - (cardsOf[a] ?? 0)) || a.localeCompare(b))
      .map((k) => ({ key: k, technologyKey: techOf[k] ?? null, cards: cardsOf[k] ?? 0 }));

    // Cascade pick: platform-scope beats engine-scope (habitat omitted from matrix).
    const pickSel = (field: string, platform: string, tech: string | null) => {
      const plat = selRows.find((r) => r.scope_kind === 'platform' && canonPf(r.scope_key) === platform && r.field_name === field);
      if (plat) return { row: plat, scope: 'platform' as const };
      if (tech) { const eng = selRows.find((r) => r.scope_kind === 'engine' && r.scope_key === tech && r.field_name === field); if (eng) return { row: eng, scope: 'engine' as const }; }
      return null;
    };

    const cells: MetricCell[] = [];
    for (const p of platforms) {
      for (const m of schema) {
        const hit = pickSel(m.field, p.key, p.technologyKey);
        const populated = (popOf[p.key]?.[m.metric]) || 0;
        const trained = !!hit;
        cells.push({
          metric: m.metric, field: m.field, platform: p.key,
          trained, scope: hit?.scope ?? null, scopeKey: hit?.row.scope_key ?? null,
          source: hit?.row.source ?? null, via: hit?.row.via ?? null,
          hasCss: hit?.row.has_css ?? false, selId: hit?.row.id ?? null,
          cards: p.cards, populated,
          // gap (đỏ) = có card mà KHÔNG selector VÀ chưa số nào bắt được (trống thật).
          // apiFed (◆) = chưa selector DOM nhưng đã có số từ API/commentstats (1 phần OK).
          gap: !trained && p.cards > 0 && populated === 0,
          apiFed: !trained && populated > 0,
        });
      }
    }
    return { metrics, platforms, cells };
  } catch { return empty; }
}
