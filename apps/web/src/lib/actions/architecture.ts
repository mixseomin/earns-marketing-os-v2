'use server';

// Architecture Studio — live instance binding + consistency checks + layout persistence.
// Reads real rows so each block can be validated against the model ("phản ánh đúng").
// Identifiers come from the trusted spec allowlist (BINDABLE_TABLES); values are parameterized.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { BINDABLE_TABLES, OBJ_BY_KEY, isInstanceFieldEditable } from '@/components/architecture/spec';
import { METRIC_PAGE_KIND, getMetricFieldSchema, isMetricApplicable, type MetricKey } from '@/lib/metric-field-schema';
import { setOverride } from './habitat-selectors';

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

// ── paginated + filtered instance browser ───────────────────────────────────
// listInstances tops out at 400 for the picker; the node drawer needs to walk
// ALL rows (accounts can be huge) → page + text filter + total count.
export interface BrowseRow extends InstanceRef { cols: Record<string, unknown> }
export interface InstancePage { rows: BrowseRow[]; total: number; facets?: Record<string, { value: string; count: number }[]> }

// real columns of a table → used to validate browseCols so a spec typo just drops the
// column instead of throwing (which would silently empty the whole table).
async function tableColumns(table: string): Promise<Set<string>> {
  const db = getDb();
  if (!db) return new Set();
  try {
    const res = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${table}`);
    return new Set((res as unknown as Array<{ column_name: string }>).map((r) => r.column_name));
  } catch { return new Set(); }
}

export async function browseInstances(
  objectKey: string,
  opts: { projectId?: string; parentId?: string; q?: string; limit?: number; offset?: number; cols?: string[]; sort?: { col: string; dir: 'asc' | 'desc' }; flt?: 'missing' | 'empty' | 'partial' | 'full' | 'broken'; filters?: Record<string, string[]>; facetCols?: string[]; siteMember?: string } = {},
): Promise<InstancePage> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return { rows: [], total: 0 };
  const db = getDb();
  if (!db) return { rows: [], total: 0 };
  const table = ident(obj.table);
  const pkr = obj.picker;
  const pk = sql.raw(`t.${ident(obj.pk || 'id')}`);
  const labelSel = pkr?.labelExpr ? sql.raw(`(${pkr.labelExpr})`) : sql.raw(`t.${ident(obj.labelCol || obj.pk || 'id')}`);
  const subSel = pkr?.subExpr ? sql`, (${sql.raw(pkr.subExpr)})::text AS sub` : sql``;
  const joinSql = pkr?.join ? sql.raw(pkr.join) : sql``;

  // extra columns (validated against the real table) → selected as t.<col>
  const reserved = new Set(['id', 'label', 'sub']);
  const special = new Set(['__projects', '__unread', '__platform', '__board', '__missingSel', '__domNew', '__domTotal']);
  let extraCols: string[] = [];
  let validCols = new Set<string>();
  if (opts.cols && opts.cols.length) {
    validCols = await tableColumns(obj.table);
    extraCols = opts.cols.filter((c) => !special.has(c) && /^[a-z_][a-z0-9_]*$/.test(c) && validCols.has(c) && !reserved.has(c));
  }
  const selParts = extraCols.map((c) => `t.${ident(c)}`);
  // __projects: all projects this instance belongs to via the m2m junction (account_id → project_id).
  const wantProjects = !!(opts.cols?.includes('__projects') && obj.projectsVia);
  if (wantProjects && obj.projectsVia) {
    const jt = ident(obj.projectsVia.table); const fk = ident(obj.projectsVia.fkCol); const pkc = ident(obj.pk || 'id');
    selParts.push(`(SELECT array_agg(DISTINCT j.project_id) FROM ${jt} j WHERE j.${fk} = t.${pkc}) AS __projects`);
  }
  // __unread: account_stats.unread_messages (jsonb subkey, ext quét khi đã login) → int cho cột ✉ triage.
  const wantUnread = !!(opts.cols?.includes('__unread') && validCols.has('account_stats'));
  if (wantUnread) selParts.push(`(t.account_stats->>'unread_messages')::int AS __unread`);
  // __platform: every board/channel belongs to a platform. Channels carry it via their habitat;
  // boards have platform_key directly (fall back to technology_key for engine-only forums).
  const wantPlatform = !!opts.cols?.includes('__platform');
  if (wantPlatform) {
    if (validCols.has('habitat_id')) selParts.push(`(SELECT platform_key FROM habitats WHERE id = t.habitat_id) AS __platform`);
    else if (validCols.has('platform_key')) selParts.push(`COALESCE(t.platform_key, t.technology_key) AS __platform`);
    else selParts.push(`NULL::text AS __platform`);
  }
  // __board: bảng có board_id (board_project_score…) → "tên board · platform" để readable thay vì id trần.
  const wantBoard = !!opts.cols?.includes('__board');
  if (wantBoard) {
    if (validCols.has('board_id')) selParts.push(`(SELECT COALESCE(NULLIF(pb.name,''), 'board') || ' · ' || COALESCE(pb.platform_key, pb.technology_key, '?') FROM platform_boards pb WHERE pb.id = t.board_id) AS __board`);
    else selParts.push(`NULL::text AS __board`);
  }
  // __missingSel: per platform, CORE selector fields chưa có (xét cả platform-scope + inherited
  // technology-scope). Để Studio chỉ thẳng "thiếu loại nào" → chủ động đi train/cập nhật. postBtn
  // chỉ bắt buộc khi auto_post_supported (suggest-only ko cần nút đăng).
  const wantMissingSel = !!(opts.cols?.includes('__missingSel') && validCols.has('technology_key') && validCols.has('auto_post_supported'));
  if (wantMissingSel) {
    // missing = CORE field CHƯA train; broken = field ĐÃ train nhưng selector hỏng (miss_streak>=3,
    // ext báo từ trang thật) → prefix '⚠'. Cột gộp cả hai để Studio chỉ thẳng "thiếu/hỏng loại nào".
    selParts.push(`(
      WITH present AS (
        SELECT DISTINCT so.page_kind || '.' || so.field_name AS fk
        FROM selector_overrides so
        WHERE (so.scope_kind = 'platform' AND so.scope_key = t.key)
           OR (so.scope_kind = 'technology' AND so.scope_key = t.technology_key)
      ), broken AS (
        SELECT DISTINCT so.page_kind || '.' || so.field_name AS fk
        FROM selector_overrides so
        WHERE ((so.scope_kind = 'platform' AND so.scope_key = t.key)
            OR (so.scope_kind = 'technology' AND so.scope_key = t.technology_key))
          AND COALESCE(so.miss_streak, 0) >= 3
      ), req AS (
        SELECT unnest(
          ARRAY['composer.composer.anchor','composer.composer.editor','composer.viewer.handle',
                'composer._adapter','composer.post.item','composer.post.author',
                'composer.post.body','composer.post.permalink','platform-any.viewer.logged_in']
          || CASE WHEN t.auto_post_supported THEN ARRAY['composer.composer.postBtn'] ELSE ARRAY[]::text[] END
        ) AS fk
      )
      SELECT COALESCE(NULLIF(concat_ws(', ',
        (SELECT string_agg(regexp_replace(r.fk, '^(composer|platform-any)\\.', ''), ', ' ORDER BY r.fk)
           FROM req r WHERE r.fk NOT IN (SELECT fk FROM present)),
        (SELECT string_agg('⚠' || regexp_replace(b.fk, '^(composer|platform-any)\\.', ''), ', ' ORDER BY b.fk)
           FROM broken b)
      ), ''), '✓ full')
    ) AS "__missingSel"`);   // QUOTE alias — unquoted Postgres lowercases → r['__missingsel'] ≠ r['__missingSel'] = null
  }
  // __domTotal / __domNew: DOM sample đã capture cho ĐÚNG platform (platform_key=key) + số CHƯA
  // ĐỌC (read_at NULL). KHÔNG gom theo technology. Parse DOM → train selector → __missingSel giảm.
  const wantDom = !!((opts.cols?.includes('__domTotal') || opts.cols?.includes('__domNew')) && validCols.has('key'));
  if (wantDom) {
    // CHỈ đếm sample của đúng platform (platform_key=key) — khớp với drawer list. KHÔNG gom theo technology.
    selParts.push(`(SELECT count(*)::int FROM dom_samples ds WHERE ds.platform_key = t.key) AS "__domTotal"`);
    selParts.push(`(SELECT count(*)::int FROM dom_samples ds WHERE ds.platform_key = t.key AND ds.read_at IS NULL) AS "__domNew"`);
  }
  const extraSel = selParts.length ? sql.raw(', ' + selParts.join(', ')) : sql``;

  const conds: ReturnType<typeof sql>[] = [];
  if (obj.projectScoped && opts.projectId && !pkr?.crossProject) conds.push(sql`t.project_id = ${opts.projectId}`);
  if (pkr?.parent && opts.parentId) conds.push(sql`${sql.raw('t.' + ident(pkr.parent.col))} = ${opts.parentId}`);
  const q = (opts.q || '').trim();
  if (q) {
    const like = `%${q}%`;
    const parts: ReturnType<typeof sql>[] = [sql`(${labelSel})::text ILIKE ${like}`, sql`${pk}::text ILIKE ${like}`];
    if (pkr?.subExpr) parts.push(sql`(${sql.raw(pkr.subExpr)})::text ILIKE ${like}`);
    conds.push(sql`(${sql.join(parts, sql` OR `)})`);
  }
  // flt: lọc health selector (node platform). 4 nhóm PHÂN BIỆT (vì ~all platform đều "missing" →
  // filter missing vô dụng): empty=chưa train field nào · partial=đã train ≥1 nhưng vẫn HỞ CORE ·
  // full=đủ CORE · broken=có selector HỎNG (miss_streak≥3). 'missing' giữ làm legacy (=empty+partial).
  if (opts.flt && wantMissingSel) {
    const scope = `((so.scope_kind='platform' AND so.scope_key=t.key) OR (so.scope_kind='technology' AND so.scope_key=t.technology_key))`;
    const missingBody = `EXISTS (
      WITH present AS (SELECT DISTINCT so.page_kind||'.'||so.field_name AS fk FROM selector_overrides so WHERE ${scope}),
      req AS (SELECT unnest(ARRAY['composer.composer.anchor','composer.composer.editor','composer.viewer.handle','composer._adapter','composer.post.item','composer.post.author','composer.post.body','composer.post.permalink','platform-any.viewer.logged_in']
        || CASE WHEN t.auto_post_supported THEN ARRAY['composer.composer.postBtn'] ELSE ARRAY[]::text[] END) AS fk)
      SELECT 1 FROM req r WHERE r.fk NOT IN (SELECT fk FROM present))`;
    const hasAny = `EXISTS (SELECT 1 FROM selector_overrides so WHERE ${scope})`;
    const brokenEx = `EXISTS (SELECT 1 FROM selector_overrides so WHERE ${scope} AND COALESCE(so.miss_streak,0) >= 3)`;
    if (opts.flt === 'empty') conds.push(sql.raw(`${missingBody} AND NOT ${hasAny}`));
    else if (opts.flt === 'partial') conds.push(sql.raw(`${missingBody} AND ${hasAny}`));
    else if (opts.flt === 'full') conds.push(sql.raw(`NOT ${missingBody}`));
    else if (opts.flt === 'broken') conds.push(sql.raw(brokenEx));
    else conds.push(sql.raw(missingBody));   // 'missing' legacy
  }
  // site membership (backlink shared entity): row's site_status jsonb has this site as a key.
  // Scoping filter (like project) → included in facetConds so facets reflect the site too.
  if (opts.siteMember && /^[a-z0-9_-]+$/.test(opts.siteMember) && validCols.has('site_status')) {
    conds.push(sql`jsonb_exists(t.site_status, ${opts.siteMember})`);
  }
  // generic per-column value filters (categorical cols). facets reflect the scope BEFORE these.
  const facetConds = conds.slice();
  if (opts.filters) {
    for (const [col, vals] of Object.entries(opts.filters)) {
      if (!vals?.length || !/^[a-z_][a-z0-9_]*$/.test(col) || !validCols.has(col) || reserved.has(col)) continue;
      conds.push(sql`(${sql.raw('t.' + ident(col))})::text IN (${sql.join(vals.map((v) => sql`${v}`), sql`, `)})`);
    }
  }
  const whereSql = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
  const facetWhereSql = facetConds.length ? sql`WHERE ${sql.join(facetConds, sql` AND `)}` : sql``;
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  // Sort server-side (qua phân trang). '__label' = cột label; pk; special col đã select (alias); real col.
  let orderSql = sql`${pk} DESC`;
  if (opts.sort?.col) {
    const dir = opts.sort.dir === 'asc' ? sql.raw('ASC') : sql.raw('DESC');
    const c = opts.sort.col;
    if (c === '__label') orderSql = sql`(${labelSel}) ${dir} NULLS LAST`;
    else if (c === (obj.pk || 'id')) orderSql = sql`${pk} ${dir}`;
    else if (special.has(c) && opts.cols?.includes(c)) orderSql = sql`${sql.raw(ident(c))} ${dir} NULLS LAST`;
    else if (validCols.has(c)) orderSql = sql`${sql.raw('t.' + ident(c))} ${dir} NULLS LAST`;
  }

  try {
    const [listRes, countRes] = await Promise.all([
      db.execute(sql`
        SELECT ${pk}::text AS id, ${labelSel}::text AS label${subSel}${extraSel}
        FROM ${sql.raw(table)} t
        ${joinSql}
        ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${limit} OFFSET ${offset}`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM ${sql.raw(table)} t ${joinSql} ${whereSql}`),
    ]);
    const rows = (listRes as unknown as Array<Record<string, unknown>>).map((r) => {
      const cols: Record<string, unknown> = {};
      for (const c of extraCols) cols[c] = r[c];
      if (wantProjects) cols['__projects'] = r['__projects'] ?? null;
      if (wantUnread) cols['__unread'] = r['__unread'] ?? null;
      if (wantPlatform) cols['__platform'] = r['__platform'] ?? null;
      if (wantBoard) cols['__board'] = r['__board'] ?? null;
      if (wantMissingSel) cols['__missingSel'] = r['__missingSel'] ?? null;
      if (wantDom) { cols['__domTotal'] = r['__domTotal'] ?? null; cols['__domNew'] = r['__domNew'] ?? null; }
      return { id: String(r.id), label: (r.label as string) || String(r.id), sub: (r.sub as string) || undefined, cols };
    });
    const total = (countRes as unknown as Array<{ n: number }>)[0]?.n ?? rows.length;
    // facets: distinct values + counts per requested categorical column (scope = base, ignores its own filter).
    const facets: Record<string, { value: string; count: number }[]> = {};
    const fcols = (opts.facetCols || []).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c) && validCols.has(c) && !reserved.has(c));
    if (fcols.length) {
      await Promise.all(fcols.map(async (c) => {
        const fr = await db.execute(sql`SELECT (${sql.raw('t.' + ident(c))})::text AS v, count(*)::int AS n FROM ${sql.raw(table)} t ${joinSql} ${facetWhereSql} GROUP BY 1 ORDER BY n DESC NULLS LAST LIMIT 50`);
        facets[c] = (fr as unknown as Array<{ v: string | null; n: number }>).map((x) => ({ value: String(x.v ?? ''), count: Number(x.n) })).filter((x) => x.value !== '' && x.value !== 'null');
      }));
    }
    return { rows, total, facets };
  } catch {
    return { rows: [], total: 0 };
  }
}

// ── instance mutation (narrow, sanctioned exception to the read-only map) ─────
// Generic field edit cho InstanceDetail (sửa thẳng trong drawer). Gửi VALUE string|null,
// Postgres tự cast theo kiểu cột (text/int/bool/jsonb/date). isInstanceFieldEditable ở spec.ts
// (sync helper — 'use server' chỉ export được async fn).
export async function updateInstanceField(
  objectKey: string, id: string, col: string, value: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return { ok: false, error: 'unknown object' };
  if (!isInstanceFieldEditable(objectKey, col)) return { ok: false, error: `cột '${col}' không cho sửa` };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const cols = await tableColumns(obj.table);
  if (!cols.has(col)) return { ok: false, error: 'no such column' };
  const v = (value == null || value === '') ? null : value;
  const sets: ReturnType<typeof sql>[] = [sql`${sql.raw(ident(col))} = ${v}`];
  if (cols.has('updated_at')) sets.push(sql`updated_at = now()`);
  const pk = ident(obj.pk || 'id');
  try {
    await db.execute(sql`UPDATE ${sql.raw(ident(obj.table))} SET ${sql.join(sets, sql`, `)} WHERE ${sql.raw(pk)}::text = ${id}`);
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'update failed' }; }
}

// Backlink node (Option B): set per-site status + per-site live URL trong prep_payload
// (site_status[site] + site_url[site]). site validated; jsonb_set path qua bound param (no injection).
export async function setBacklinkSite(taskId: number, site: string, status: string, url: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  if (!/^[a-z0-9_-]+$/.test(site)) return { ok: false, error: 'bad site' };
  if (!['pending', 'claimed', 'completed', 'verified'].includes(status)) return { ok: false, error: 'bad status' };
  const u = (url || '').trim();
  try {
    // merge (||) — tạo key site_status/site_url nếu CHƯA có (jsonb_set không tạo key cha thiếu).
    const r = await db.execute(sql`
      UPDATE human_tasks SET prep_payload =
        COALESCE(prep_payload, '{}'::jsonb)
        || jsonb_build_object('site_status', COALESCE(prep_payload->'site_status', '{}'::jsonb) || jsonb_build_object(${site}::text, to_jsonb(${status}::text)))
        || jsonb_build_object('site_url',    COALESCE(prep_payload->'site_url',    '{}'::jsonb) || jsonb_build_object(${site}::text, to_jsonb(${u}::text))),
        updated_at = now()
      WHERE id = ${taskId} AND platform_key = 'backlink'
      RETURNING (prep_payload->'site_status') AS ss`);
    // Roll the row-level status up from the per-site rollup so self-completing in the
    // CRM/grid (same rule as the staff /done) closes the row — and reopens it if a
    // site is un-completed. Mirrors api/ext/my-tasks/done.
    const ss = (r as unknown as Array<{ ss: Record<string, string> }>)[0]?.ss || {};
    const vals = Object.values(ss);
    const allDone = vals.length > 0 && vals.every((v) => v === 'completed' || v === 'verified');
    if (allDone) {
      await db.execute(sql`UPDATE human_tasks SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink' AND status <> 'completed'`);
    } else {
      await db.execute(sql`UPDATE human_tasks SET status = 'pending', completed_at = NULL, updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink' AND status = 'completed'`);
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

// Backlink shared entity: remove a site from membership (drop the key from both
// site_status + site_url). Inverse of setBacklinkSite for the Sites multi-select.
export async function removeBacklinkSite(taskId: number, site: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  if (!/^[a-z0-9_-]+$/.test(site)) return { ok: false, error: 'bad site' };
  try {
    await db.execute(sql`
      UPDATE human_tasks SET prep_payload =
        COALESCE(prep_payload, '{}'::jsonb)
        || jsonb_build_object('site_status', (COALESCE(prep_payload->'site_status', '{}'::jsonb) - ${site}::text))
        || jsonb_build_object('site_url',    (COALESCE(prep_payload->'site_url',    '{}'::jsonb) - ${site}::text)),
        updated_at = now()
      WHERE id = ${taskId} AND platform_key = 'backlink'`);
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

// Studio triage: đổi status + append note cho 1 account ngay trên /architecture.
const ACCOUNT_STATUS = ['todo', 'creating', 'warming', 'active', 'limited', 'blocked', 'banned'];
export async function updateInstance(
  objectKey: string, id: string, patch: { status?: string; noteAppend?: string },
): Promise<{ ok: boolean; error?: string }> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return { ok: false, error: 'unknown object' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const cols = await tableColumns(obj.table);
  const sets: ReturnType<typeof sql>[] = [];
  if (patch.status != null) {
    if (objectKey !== 'account') return { ok: false, error: 'status edit chỉ hỗ trợ account' };
    if (!ACCOUNT_STATUS.includes(patch.status)) return { ok: false, error: `status không hợp lệ (${ACCOUNT_STATUS.join('|')})` };
    if (!cols.has('status')) return { ok: false, error: 'no status column' };
    sets.push(sql`status = ${patch.status}`);
  }
  if (patch.noteAppend != null && patch.noteAppend.trim()) {
    if (!cols.has('notes')) return { ok: false, error: 'no notes column' };
    const line = `[studio ${new Date().toISOString().slice(0, 10)}] ${patch.noteAppend.trim()}`;
    sets.push(sql`notes = case when coalesce(notes, '') = '' then ${line} else notes || E'\n' || ${line} end`);
  }
  if (!sets.length) return { ok: false, error: 'nothing to update' };
  if (cols.has('updated_at')) sets.push(sql`updated_at = now()`);
  const pk = ident(obj.pk || 'id');
  try {
    await db.execute(sql`UPDATE ${sql.raw(ident(obj.table))} SET ${sql.join(sets, sql`, `)} WHERE ${sql.raw(pk)}::text = ${id}`);
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'update failed' }; }
}

// ── generic CREATE / DELETE / RESTORE (CRUD trong studio) ────────────────────
// Allowlist = BINDABLE_TABLES. Reject VIEW cho create/restore. Values text → Postgres
// cast theo cột. Cột NOT NULL thiếu → insert fail rõ ràng (surface error).
async function isView(db: NonNullable<ReturnType<typeof getDb>>, table: string): Promise<boolean> {
  const r = await db.execute(sql`SELECT relkind::text AS k FROM pg_class WHERE relname = ${table} LIMIT 1`);
  return (r as unknown as Array<{ k: string }>)[0]?.k === 'v';
}
export async function createInstance(objectKey: string, values: Record<string, string | null>, projectId?: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return { ok: false, error: 'unknown object' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  if (await isView(db, obj.table)) return { ok: false, error: 'view — không tạo trực tiếp' };
  const cols = await tableColumns(obj.table);
  const names: string[] = []; const vals: ReturnType<typeof sql>[] = [];
  for (const [c, v] of Object.entries(values)) {
    if (!isInstanceFieldEditable(objectKey, c) || !cols.has(c) || v == null || v === '') continue;
    names.push(ident(c)); vals.push(sql`${v}`);
  }
  if (obj.projectScoped && cols.has('project_id') && projectId && !names.includes(ident('project_id'))) {
    names.push(ident('project_id')); vals.push(sql`${projectId}`);
  }
  if (!names.length) return { ok: false, error: 'chưa nhập field nào' };
  const pk = ident(obj.pk || 'id');
  try {
    const r = await db.execute(sql`INSERT INTO ${sql.raw(ident(obj.table))} (${sql.raw(names.join(', '))}) VALUES (${sql.join(vals, sql`, `)}) RETURNING ${sql.raw(pk)}::text AS id`);
    return { ok: true, id: (r as unknown as Array<{ id: string }>)[0]?.id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'insert failed' }; }
}
// Trả về snapshot row đã xoá (cho undo). View auto-updatable → xoá row base.
export async function deleteInstance(objectKey: string, id: string): Promise<{ ok: boolean; row?: Record<string, unknown>; error?: string }> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return { ok: false, error: 'unknown object' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const pk = ident(obj.pk || 'id');
  try {
    const snap = await db.execute(sql`SELECT * FROM ${sql.raw(ident(obj.table))} WHERE ${sql.raw(pk)}::text = ${id} LIMIT 1`);
    const row = (snap as unknown as Array<Record<string, unknown>>)[0];
    await db.execute(sql`DELETE FROM ${sql.raw(ident(obj.table))} WHERE ${sql.raw(pk)}::text = ${id}`);
    return { ok: true, row };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'delete failed' }; }
}
// Undo: re-insert toàn bộ cột (gồm pk) từ snapshot. Best-effort (con cascade ko khôi phục, view ko hỗ trợ).
export async function restoreInstance(objectKey: string, row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table || !row) return { ok: false, error: 'bad restore' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  if (await isView(db, obj.table)) return { ok: false, error: 'view — không khôi phục được' };
  const cols = await tableColumns(obj.table);
  const names: string[] = []; const vals: ReturnType<typeof sql>[] = [];
  for (const [c, v] of Object.entries(row)) {
    if (!cols.has(c) || v == null) continue;
    names.push(ident(c));
    vals.push(typeof v === 'object' ? sql`${JSON.stringify(v)}` : sql`${v as string | number | boolean}`);
  }
  if (!names.length) return { ok: false, error: 'empty row' };
  try {
    await db.execute(sql`INSERT INTO ${sql.raw(ident(obj.table))} (${sql.raw(names.join(', '))}) VALUES (${sql.join(vals, sql`, `)})`);
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'restore failed' }; }
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
      // normalize legacy 'engine' → 'technology' before resolving the target table.
      const kind = s('scope_kind') === 'engine' ? 'technology' : s('scope_kind');
      const key = s('scope_key');
      const map: Record<string, [string, string]> = {
        platform: ['platforms', 'key'],
        technology: ['platform_technologies', 'key'],
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

// Crew ext capability matrix — latest row self-reported by ext buildCapabilities(). null = chưa report
// (Architecture Studio fallback bản bundled). Single source = ext cfg LIVE.
export async function getCrewCapabilities(): Promise<Record<string, unknown> | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r = await db.execute(sql`SELECT data FROM crew_capabilities ORDER BY updated_at DESC LIMIT 1`);
    const rows = r as unknown as Array<{ data: Record<string, unknown> }>;
    return rows[0]?.data ?? null;
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
    add('selector', 'error', "technology scope not in platform_technologies", sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.scope_kind IN ('engine','technology') AND NOT EXISTS (SELECT 1 FROM platform_technologies t WHERE t.key = s.scope_key)`),
    add('selector', 'error', "habitat scope not in habitats", sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.scope_kind = 'habitat' AND NOT EXISTS (SELECT 1 FROM habitats h WHERE h.id::text = s.scope_key)`),
    add('selector', 'warn', 'spec.css empty', sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE COALESCE(s.spec->>'css','') = ''`),
    // health telemetry (ext báo từ trang thật): miss_streak cao = DOM đổi → selector hỏng.
    add('selector', 'error', 'likely BROKEN — 5+ consecutive misses on live pages (retrain selector)', sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.miss_streak >= 5`),
    add('selector', 'warn', 'flaky — 3-4 recent misses on live pages (DOM may have changed)', sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.miss_streak >= 3 AND s.miss_streak < 5`),
    add('selector', 'warn', "Reddit page_kind (subreddit-*) on a non-reddit platform — taxonomy leak, rename to a platform-neutral kind", sql`SELECT count(*)::int AS n FROM selector_overrides s WHERE s.page_kind LIKE 'subreddit%' AND s.scope_key <> 'reddit'`),
    // interaction (global)
    add('interaction', 'error', 'people_id dangling', sql`SELECT count(*)::int AS n FROM interactions i WHERE NOT EXISTS (SELECT 1 FROM people pe WHERE pe.id = i.people_id)`),
    // platform (global)
    add('platform', 'error', 'technology_key not in platform_technologies', sql`SELECT count(*)::int AS n FROM platforms p WHERE p.technology_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM platform_technologies t WHERE t.key = p.technology_key)`),
  ]);

  return result;
}

// ── selector library for a scope (per platform/technology/habitat × entity) ──
export interface SelRow { id: string; pageKind: string; fieldName: string; css: string; attr: string | null; source: string; confidence: number }
export async function listSelectors(scopeKind: string, scopeKey: string): Promise<SelRow[]> {
  const db = getDb();
  if (!db) return [];
  // normalize legacy 'engine' → 'technology'; the SQL still matches both stored values.
  const kind = scopeKind === 'engine' ? 'technology' : scopeKind;
  if (!['platform', 'technology', 'habitat'].includes(kind)) return [];
  const kindMatch = kind === 'technology' ? ['technology', 'engine'] : [kind];
  try {
    const r = await db.execute(sql`
      SELECT id::text AS id, page_kind, field_name, spec, source, confidence
      FROM selector_overrides
      WHERE scope_kind IN (${sql.join(kindMatch.map((k) => sql`${k}`), sql`, `)}) AND scope_key = ${scopeKey}
      ORDER BY page_kind, field_name`);
    const rows = r as unknown as Array<{ id: string; page_kind: string; field_name: string; spec: { css?: string; attr?: string } | null; source: string; confidence: number }>;
    return rows.map((x) => ({
      id: x.id, pageKind: x.page_kind, fieldName: x.field_name,
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
      id: x.id, scopeKind: x.scope_kind === 'engine' ? 'technology' : x.scope_kind, scopeKey: x.scope_key, pageKind: x.page_kind,
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
      id: x.id, scopeKind: x.scope_kind === 'engine' ? 'technology' : x.scope_kind, scopeKey: x.scope_key, pageKind: x.page_kind,
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
  trained: boolean; scope: 'platform' | 'technology' | 'habitat' | null; scopeKey: string | null;
  source: string | null; via: string | null; hasCss: boolean; selId: string | null;
  cards: number;        // posted cards on this platform
  populated: number;    // cards where the matching insights_* column is non-null
  gap: boolean;         // applicable + wanted (cards>0) but no selector → real gap (⚠)
  apiFed: boolean;      // populated>0 but no selector → value comes from API/other path, not DOM
  notApplicable: boolean; // platform/technology không phơi bày metric này cho loại nội dung → "–" N/A, KHÔNG gap
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
          h.technology_key AS hab_tech,
          c.insights_views_count AS m_views, c.insights_score AS m_score,
          c.insights_reply_count AS m_reply, c.insights_engagements AS m_share
        FROM cards c
        LEFT JOIN community_briefs b ON b.id = c.brief_id
        LEFT JOIN platform_accounts pa ON pa.id = COALESCE(c.account_id, b.account_id)
        LEFT JOIN habitats h ON h.id = COALESCE(c.habitat_id, b.habitat_id)
        WHERE c.post_url IS NOT NULL
      )
      -- technology = platforms.technology_key, fallback về habitat.technology_key
      -- (forum như resetera-com có platforms.tech=NULL mà habitat=xenforo → vẫn cascade technology được).
      SELECT cp.platform, COALESCE(p.technology_key, max(cp.hab_tech)) AS tech, count(*)::int AS cards,
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
    const selRowsRaw = sel as unknown as Array<{ id: string; scope_kind: string; scope_key: string; field_name: string; source: string; via: string | null; has_css: boolean }>;
    // normalize legacy 'engine' scope → 'technology' for the cascade pick below.
    const selRows = selRowsRaw.map((r) => ({ ...r, scope_kind: r.scope_kind === 'engine' ? 'technology' : r.scope_kind }));

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

    // Cascade pick: platform-scope beats technology-scope (habitat omitted from matrix).
    // field_name khớp cả 'metric.views' (schema) lẫn 'metric_views' (editor canonField '.'→'_').
    const nf = (s: string) => s.toLowerCase().replace(/\./g, '_');
    const pickSel = (field: string, platform: string, tech: string | null) => {
      const f = nf(field);
      const plat = selRows.find((r) => r.scope_kind === 'platform' && canonPf(r.scope_key) === platform && nf(r.field_name) === f);
      if (plat) return { row: plat, scope: 'platform' as const };
      if (tech) { const eng = selRows.find((r) => r.scope_kind === 'technology' && r.scope_key === tech && nf(r.field_name) === f); if (eng) return { row: eng, scope: 'technology' as const }; }
      return null;
    };

    const cells: MetricCell[] = [];
    for (const p of platforms) {
      for (const m of schema) {
        const hit = pickSel(m.field, p.key, p.technologyKey);
        const populated = (popOf[p.key]?.[m.metric]) || 0;
        const trained = !!hit;
        // applicable = nền tảng có phơi bày metric này cho loại nội dung (comment/reply) không.
        const applicable = isMetricApplicable(p.key, p.technologyKey, m.metric);
        cells.push({
          metric: m.metric, field: m.field, platform: p.key,
          trained, scope: hit?.scope ?? null, scopeKey: hit?.row.scope_key ?? null,
          source: hit?.row.source ?? null, via: hit?.row.via ?? null,
          hasCss: hit?.row.has_css ?? false, selId: hit?.row.id ?? null,
          cards: p.cards, populated,
          // gap (đỏ) = APPLICABLE + có card mà KHÔNG selector VÀ chưa số nào bắt được.
          // apiFed (◆) = chưa selector DOM nhưng đã có số từ API/commentstats (1 phần OK).
          // notApplicable (–) = nền tảng không phơi bày metric → không phải gap, đừng báo đỏ.
          gap: applicable && !trained && p.cards > 0 && populated === 0,
          apiFed: !trained && populated > 0,
          notApplicable: !applicable && !trained && populated === 0,
        });
      }
    }
    return { metrics, platforms, cells };
  } catch { return empty; }
}

// ── DOM sample library (ext capture) ────────────────────────────────────────
// Summary fields tách được khi ĐỌC (parse) 1 sample — lưu vào dom_samples.extract,
// list hiển thị khỏi parse lại HTML mỗi lần.
export interface DomExtractSummary {
  counts: { users: number; threads: number; boards: number; inputs: number };
  selFields: string[];   // field selector phát hiện (thread.title, user.url, username…)
  inputs: string[];      // nhãn input form (non-button)
  engine: string | null; loggedIn: boolean | null;
}
export interface DomSampleRow {
  id: number; platformKey: string | null; technologyKey: string | null;
  pageKind: string; url: string | null; hostname: string | null; title: string | null;
  bytes: number; capturedAt: string; readAt: string | null;
  extract: DomExtractSummary | null;   // null = chưa đọc lần nào
}
function mapDomRow(r: Record<string, unknown>): DomSampleRow {
  let extract: DomExtractSummary | null = null;
  const ex = r.extract;
  if (ex && typeof ex === 'object') extract = ex as DomExtractSummary;
  else if (typeof ex === 'string' && ex) { try { extract = JSON.parse(ex); } catch { extract = null; } }
  return {
    id: Number(r.id), platformKey: (r.platform_key as string | null) ?? null,
    technologyKey: (r.technology_key as string | null) ?? null, pageKind: String(r.page_kind ?? 'page'),
    url: (r.url as string | null) ?? null, hostname: (r.hostname as string | null) ?? null,
    title: (r.title as string | null) ?? null, bytes: Number(r.bytes) || 0, capturedAt: String(r.captured_at),
    readAt: (r.read_at as string | null) ?? null, extract,
  };
}
export async function listDomSamples(): Promise<DomSampleRow[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`
      SELECT id, platform_key, technology_key, page_kind, url, hostname, title, bytes, captured_at, read_at, extract
      FROM dom_samples ORDER BY captured_at DESC LIMIT 300`);
    return (rows as unknown as Array<Record<string, unknown>>).map(mapDomRow);
  } catch { return []; }
}
// DOM samples cho 1 platform (platform_key trực tiếp HOẶC inherited technology) — click cột DOM ở
// Studio mở list này. Unread (read_at NULL) lên đầu.
export async function listDomSamplesForPlatform(platformKey: string): Promise<DomSampleRow[]> {
  const db = getDb();
  if (!db || !platformKey) return [];
  // CHỈ sample của đúng platform này — KHÔNG gom theo technology (đừng kéo phpbb site khác vào).
  const q = sql`
      SELECT id, platform_key, technology_key, page_kind, url, hostname, title, bytes, captured_at, read_at, extract
      FROM dom_samples WHERE platform_key = ${platformKey}
      ORDER BY (read_at IS NULL) DESC, captured_at DESC LIMIT 300`;
  try {
    let rows = (await db.execute(q) as unknown as Array<Record<string, unknown>>).map(mapDomRow);
    // Backfill: sample ĐÃ ĐỌC nhưng chưa có extract (capture trước khi có cột) → tự parse 1 lần.
    const stale = rows.filter((r) => r.readAt && !r.extract).map((r) => r.id);
    if (stale.length) {
      for (const id of stale) { try { await extractDomSample(id); } catch { /* skip */ } }
      rows = (await db.execute(q) as unknown as Array<Record<string, unknown>>).map(mapDomRow);
    }
    return rows;
  } catch { return []; }
}
// Auto-extract entity LISTS từ HTML 1 sample (generic, regex theo href pattern) để
// user KIỂM SOÁT page trích được gì TRƯỚC khi seed: user list, thread/post list, board list.
export interface ExtractedEntity { key: string; label: string; url: string | null }
// 1 selector đề xuất từ sample → map vào (technology|platform) scope qua seedSelectorsFromSample.
// tech/plat = trạng thái so với selector ĐÃ CÓ ở scope đó: new (chưa có) · same (y hệt →
// seed bỏ qua) · diff (đã có khác → seed sẽ ghi đè; nếu source='manual' thì PROTECT).
export interface SeedFieldState { status: 'new' | 'same' | 'diff'; css?: string; attr?: string; source?: string }
export interface SeedSelector { pageKind: string; field: string; css: string; attr: string; label: string; count: number; tech?: SeedFieldState; plat?: SeedFieldState }
// 1 form control (input/textarea/select/button) — login/register/search/post fields.
export interface ExtractedInput { tag: string; type: string; name: string; id: string; placeholder: string; value: string; label: string; css: string }
// Page-level training signals (1 sample = nhiều tín hiệu train platform/tech).
export interface ExtractSignals {
  lang: string | null; dir: string | null; charset: string | null;
  generator: string | null; engine: string | null; styleName: string | null; viewport: string | null;
  loggedIn: boolean | null; session: string | null;       // session = masked (••last4) — KHÔNG leak token
  loginUrl: string | null; registerUrl: string | null; logoutUrl: string | null;
}
export interface DomExtract {
  id: number; url: string | null; title: string | null; bytes: number; pageKind: string;
  platformKey: string | null; technologyKey: string | null;
  signals: ExtractSignals; // lang / engine / login-state / auth-urls — train platform·tech
  users: ExtractedEntity[]; threads: ExtractedEntity[]; boards: ExtractedEntity[];
  inputs: ExtractedInput[]; // form fields (login/register/search/post)
  blocks: string[];         // headings / panel titles = "menu state" (Личное меню, Друзья…)
  breadcrumbs: string[];    // breadcrumb trail (orients board context)
  pagination: { topics: number | null; page: number | null; totalPages: number | null }; // crawl bounds
  counts: { users: number; threads: number; boards: number; anchors: number; inputs: number };
  classHooks: string[];
  seedSelectors: SeedSelector[]; // proposals user review TRƯỚC khi seed (kiểm soát)
  gaps: string[];           // capture-next guidance (register/viewtopic/logged-in pages…)
}
// href token nhận diện theo loại entity — ưu tiên token đặc thù (memberlist.php) trước
// path chung (/user/) để selector a[href*=token] không quét nhầm (login/register…).
const SEED_TOKENS: Record<'user' | 'thread' | 'board', string[]> = {
  user: ['memberlist.php', 'mode=viewprofile', '/members/', '/member/', '/users/', '/user/', '/profile/', '/u/', '/@'],
  thread: ['viewtopic.php', 'showthread.php', '/threads/', '/thread/', '/topic/', '/comments/'],
  board: ['viewforum.php', '/forums/', '/forum/', '/board/'],
};
function pickToken(urls: string[], kind: 'user' | 'thread' | 'board'): string | null {
  const low = urls.map((u) => u.toLowerCase());
  for (const t of SEED_TOKENS[kind]) if (low.some((u) => u.includes(t))) return t;
  return null;
}
export async function extractDomSample(id: number): Promise<DomExtract | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db.execute(sql`SELECT html, url, title, bytes, page_kind, platform_key, technology_key FROM dom_samples WHERE id = ${id} LIMIT 1`);
  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  // mark-read: mở sample trong Studio = đã đọc → giảm "DOM chưa đọc" của platform.
  try { await db.execute(sql`UPDATE dom_samples SET read_at = now() WHERE id = ${id} AND read_at IS NULL`); } catch { /* non-fatal */ }
  const html = String(row.html ?? '');
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
  const strip = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const users = new Map<string, ExtractedEntity>();
  const threads = new Map<string, ExtractedEntity>();
  const boards = new Map<string, ExtractedEntity>();
  let anchors = 0;
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && anchors < 12000) {
    anchors++;
    const href = decode(m[1] ?? '');
    const text = strip(m[2] ?? '');
    let g: RegExpMatchArray | null;
    // NB: KHÔNG escape dấu `?` sau `.php` — để [?&] còn match được dấu `?` đầu khi id
    // là param ĐẦU. SEO alt (mod_rewrite): /memberNNN.html (user) + slug-tNNN.html
    // (thread) — riperam.org dùng dạng này, matcher cũ bỏ sót ~57 user / 42 thread.
    const STOP = /^(register|login|logout|signin|signup|password|reset|search|faq|help|new|edit|delete|home|app|index|posting|ucp|mcp|cron|memberlist|viewforum|viewtopic)$/i;
    if (/memberlist\.php[^"]*?[?&](?:mode=group|g=)/i.test(href)) { /* group legend, not a user */ }
    else if ((g = href.match(/\/member(\d+)\.html|memberlist\.php[^"]*?[?&]u=(\d+)|\/(?:user|users|members?|profile)\/([\w.%-]+)|\/u\/([\w.%-]+)|\/@([\w.%-]+)/i))) {
      const key = g[1] || g[2] || g[3] || g[4] || g[5];
      if (key && !STOP.test(key) && text && !/^[<>›»\s]*$/.test(text) && text.length <= 40) { if (!users.has(key)) users.set(key, { key, label: text, url: href }); }
      continue;
    }
    if ((g = href.match(/-t(\d+)(?:-\d+)?\.html|viewtopic\.php[^"]*?[?&]t=(\d+)|showthread\.php[^"]*?[?&]t=(\d+)|\/(?:thread|topic)\/([\w-]+)|\/comments\/([\w]+)/i))) {
      const key = g[1] || g[2] || g[3] || g[4] || g[5];
      if (key && !STOP.test(key) && text && text.length >= 2) { if (!threads.has(key)) threads.set(key, { key, label: text, url: href }); }
      continue;
    }
    if ((g = href.match(/viewforum\.php[^"]*?[?&]f=(\d+)|\/(?:board|category)\/([\w-]+)/i))) {
      const key = g[1] || g[2];
      if (key && !STOP.test(key) && text) { if (!boards.has(key)) boards.set(key, { key, label: text, url: href }); }
      continue;
    }
  }
  // Boards cũng nằm trong jumpbox <select name="f"> options (board ko hiện thành row).
  const jb = html.match(/<select[^>]*\bname="f"[^>]*>([\s\S]*?)<\/select>/i);
  if (jb) { const opt = /<option[^>]*value="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi; let om: RegExpExecArray | null;
    while ((om = opt.exec(jb[1] ?? '')) && boards.size < 120) { const k = om[1]!; const t = strip(om[2] ?? ''); if (k !== '0' && t && t.length <= 60 && !boards.has(k)) boards.set(k, { key: k, label: t, url: null }); } }

  // ── PAGE SIGNALS ─────────────────────────────────────────────────────────────
  const grp = (rx: RegExp): string | null => { const x = html.match(rx); return x && x[1] ? decode(x[1]).trim() : null; };
  const engine = /id="phpbb"|styles\/[a-z0-9_]+\/theme\/|(?:ucp|viewtopic|viewforum|memberlist)\.php\?|phpbbforum_recent_/i.test(html) ? 'phpbb'
    : /data-xf-init|class="p-nav|XF\.extendObject|\/community\//i.test(html) ? 'xenforo'
    : /data-discourse|discourse-application|<meta name="discourse/i.test(html) ? 'discourse'
    : /vBulletin|vb_login|class="vbmenu/i.test(html) ? 'vbulletin'
    : /class="ipsApp|data-ipsHook/i.test(html) ? 'invisionpower' : null;
  const sidRaw = grp(/[?&]sid=([0-9a-f]{16,40})/i);
  const loginUrl = grp(/href="([^"]*(?:ucp\.php\?mode=login|\/user\/login)[^"]*)"/i);
  const registerUrl = grp(/href="([^"]*(?:ucp\.php\?mode=register|\/user\/register|\/register\b)[^"]*)"/i);
  const logoutUrl = grp(/href="([^"]*(?:ucp\.php\?mode=logout|\/user\/logout)[^"]*)"/i);
  const loggedIn = logoutUrl ? true : /\bnot-logged-in\b/i.test(html) ? false : (loginUrl ? false : null);
  const signals: ExtractSignals = {
    lang: grp(/<html[^>]*\blang="([^"]+)"/i),
    dir: grp(/<html[^>]*\bdir="(ltr|rtl)"/i) || (/<body[^>]*class="[^"]*\brtl\b/i.test(html) ? 'rtl' : /<body[^>]*class="[^"]*\bltr\b/i.test(html) ? 'ltr' : null),
    charset: (grp(/<meta\s+charset="([^"]+)"/i) || '').toLowerCase() || null,
    generator: grp(/<meta\s+name="generator"\s+content="([^"]+)"/i),
    engine, styleName: grp(/styles\/([a-z0-9_]+)\/(?:theme|imageset)\//i),
    viewport: grp(/<meta\s+name="viewport"\s+content="([^"]+)"/i),
    loggedIn, session: sidRaw ? '••••' + sidRaw.slice(-4) : null,
    loginUrl, registerUrl, logoutUrl,
  };

  // ── FORM CONTROLS (login/register/search/post) ───────────────────────────────
  const inputs: ExtractedInput[] = [];
  const seenIn = new Set<string>();
  const ctl = /<(input|textarea|select|button)\b([^>]*)>/gi; let cm: RegExpExecArray | null; let ci = 0;
  while ((cm = ctl.exec(html)) && ci < 800) {
    ci++;
    const tag = (cm[1] ?? '').toLowerCase();
    const a = cm[2] ?? '';
    const at = (n: string): string => { const x = a.match(new RegExp(n + '\\s*=\\s*"([^"]*)"', 'i')); return x ? decode(x[1] ?? '') : ''; };
    const type = (at('type') || (tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : tag === 'button' ? 'submit' : 'text')).toLowerCase();
    if (type === 'hidden') continue;
    // Loại element do CHÍNH ext tạo (launcher/picker/FAB — id/class chứa mos2) + password
    // manager. KHÔNG loại input thật chỉ vì có data-mos2-key (đó là field trang, ext gắn nhãn).
    if (/\s(?:id|class)="[^"]*mos2/i.test(a) || /lastpass|1password|data-dashlane/i.test(a)) continue;
    const name = at('name'); const idA = at('id'); const ph = at('placeholder'); const val = at('value');
    const css = name ? `${tag}[name="${name}"]` : idA ? `#${idA}` : `${tag}${tag === 'input' && type ? `[type="${type}"]` : ''}`;
    const k = css + '|' + type; if (seenIn.has(k)) continue; seenIn.add(k);
    const label = (ph || (type === 'submit' || type === 'button' ? val : '') || name || idA || `${tag}:${type}`).slice(0, 50);
    inputs.push({ tag, type, name, id: idA, placeholder: ph, value: type === 'password' ? '' : val.slice(0, 40), label, css });
    if (inputs.length >= 50) break;
  }

  // ── BLOCKS (menu state) + BREADCRUMBS + PAGINATION ──────────────────────────
  const uniq = (arr: string[]) => Array.from(new Set(arr));
  const blocks = uniq([
    ...(html.match(/portal_\w+\.(?:png|gif|jpg)"[^>]*>(?:&nbsp;|\s|;)*([^<&]{2,40})/gi) || []).map((s) => strip(s.replace(/^[\s\S]*?>(?:&nbsp;|\s|;)*/, ''))),
    ...(html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi) || []).map(strip),
  ].map((s) => s.replace(/&nbsp;/g, ' ').trim())).filter((t) => t && t.length >= 2 && t.length <= 50).slice(0, 30);
  let breadcrumbs: string[] = [];
  const bc = html.match(/<ul class="[^"]*navlinks[^"]*">([\s\S]*?)<\/ul>/i) || html.match(/<[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/(?:ul|div|nav|p)>/i);
  if (bc) breadcrumbs = uniq((bc[1] ?? '').match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)?.map(strip).filter((t) => t && t.length <= 40) || []).slice(0, 12);
  const pg = { topics: null as number | null, page: null as number | null, totalPages: null as number | null };
  const mt = html.match(/(?:Тем|Topics|Темы):\s*([\d.,]+)/i); if (mt) pg.topics = Number((mt[1] ?? '').replace(/[.,]/g, '')) || null;
  const mp = html.match(/(?:Страница|Page)\s+(\d+)\s+(?:из|of)\s+(\d+)/i); if (mp) { pg.page = Number(mp[1]) || null; pg.totalPages = Number(mp[2]) || null; }

  const classHooks = Array.from(new Set((html.match(/class="([a-z][\w-]*(?:[_-][\w-]+){1,})"/gi) || []).map((c) => c.replace(/^class="|"$/g, ''))))
    .filter((c) => /recent|post|user|author|thread|topic|forum|message|profile|member|username|topictitle|lastpost|pagination|topiclist/i.test(c)).slice(0, 28);

  // ── SEED PROPOSALS (review trước khi ghi) ────────────────────────────────────
  const usersArr = Array.from(users.values());
  const threadsArr = Array.from(threads.values());
  const boardsArr = Array.from(boards.values());
  const has = (rx: RegExp) => rx.test(html);
  const seedSelectors: SeedSelector[] = [];
  // user: a[href*="/member"] phủ cả memberlist.php + memberNNN.html (SEO). a.username-coloured = tên.
  if (users.size) {
    const uCss = usersArr.some((e) => /\/member\d+\.html|memberlist\.php/i.test(e.url || '')) ? 'a[href*="/member"]' : `a[href*="${pickToken(usersArr.map((e) => e.url ?? ''), 'user') || '/member'}"]`;
    seedSelectors.push({ pageKind: 'member-list', field: 'user.url', css: uCss, attr: 'href', label: 'Link profile (id/slug)', count: users.size });
    if (has(/class="username-coloured"|class="username"/i)) seedSelectors.push({ pageKind: 'member-list', field: 'user.handle', css: 'a.username-coloured, a.username', attr: 'textContent', label: 'Tên user', count: users.size });
  }
  // thread: a.topictitle (class chuẩn phpbb, phủ cả SEO -tNNN.html) > token href.
  if (threads.size) {
    const tClass = has(/class="topictitle"/i);
    const tCss = tClass ? 'a.topictitle' : `a[href*="${pickToken(threadsArr.map((e) => e.url ?? ''), 'thread') || 'viewtopic.php'}"]`;
    seedSelectors.push({ pageKind: 'thread-list', field: 'thread.title', css: tCss, attr: 'textContent', label: 'Tiêu đề bài', count: threads.size });
    seedSelectors.push({ pageKind: 'thread-list', field: 'thread.url', css: tCss, attr: 'href', label: 'Thread URL/id', count: threads.size });
  }
  if (boards.size) seedSelectors.push({ pageKind: 'thread-list', field: 'thread.board', css: 'a[href*="viewforum.php"]', attr: 'textContent', label: 'Board/sub-forum', count: boards.size });
  // signup: từ LOGIN form (fallback hint — register page mới đủ email/confirm). attr=value (WRITE).
  const loginInputs = inputs.filter((i) => i.type !== 'submit' && i.type !== 'button');
  if (has(/name="username"/i) && has(/type="password"/i)) {
    seedSelectors.push({ pageKind: 'signup', field: 'username', css: 'input[name="username"]', attr: 'value', label: 'Username (từ login — xác minh ở register)', count: 1 });
    seedSelectors.push({ pageKind: 'signup', field: 'password', css: 'input[type="password"]', attr: 'value', label: 'Password (từ login — xác minh ở register)', count: 1 });
  }
  void loginInputs;

  // ── DEDUP + EXISTING-STATE (lọc trùng + đã có) ──────────────────────────────
  // (a) Bỏ proposal trùng (pageKind, css): 2 field cùng 1 element (vd thread.title +
  //     thread.url cùng `a.topictitle`, khác mỗi attr) sẽ bị CSS-identity guard GỘP
  //     thành 1 row khi seed → giữ field ĐẦU (canonical), drop cái sau. Tránh box đè.
  const seenCss = new Set<string>();
  const dedupSel: SeedSelector[] = [];
  for (const s of seedSelectors) {
    const k = `${s.pageKind}|${s.css}`;
    if (seenCss.has(k)) continue;
    seenCss.add(k); dedupSel.push(s);
  }
  // (b) So với selector ĐÃ CÓ ở scope technology/platform → new/same/diff + source.
  //     UI hiện badge; seed bỏ qua 'same' (no-op) + KHÔNG ghi đè 'manual' (no silent override).
  const techKey = (row.technology_key as string | null) ?? null;
  const platKey = (row.platform_key as string | null) ?? null;
  if (dedupSel.length && (techKey || platKey)) {
    // scope_key = NULL → so sánh ra UNKNOWN, row tự loại → nhánh thiếu key không match.
    const exRows = await db.execute(sql`
      SELECT scope_kind, page_kind, field_name, spec->>'css' AS css, spec->>'attr' AS attr, source
      FROM selector_overrides
      WHERE (scope_kind IN ('technology','engine') AND scope_key = ${techKey})
         OR (scope_kind = 'platform' AND scope_key = ${platKey})`);
    const techMap = new Map<string, { css: string; attr: string; source: string }>();
    const platMap = new Map<string, { css: string; attr: string; source: string }>();
    for (const r of exRows as unknown as Array<{ scope_kind: string; page_kind: string; field_name: string; css: string | null; attr: string | null; source: string | null }>) {
      const tgt = r.scope_kind === 'platform' ? platMap : techMap;
      tgt.set(`${r.page_kind}|${r.field_name}`, { css: r.css ?? '', attr: r.attr ?? '', source: r.source ?? 'manual' });
    }
    const stateOf = (m: Map<string, { css: string; attr: string; source: string }>, s: SeedSelector): SeedFieldState => {
      const e = m.get(`${s.pageKind}|${s.field}`);
      if (!e) return { status: 'new' };
      const same = e.css === s.css && (e.attr || '') === (s.attr || '');
      return { status: same ? 'same' : 'diff', css: e.css, attr: e.attr, source: e.source };
    };
    for (const s of dedupSel) {
      if (techKey) s.tech = stateOf(techMap, s);
      if (platKey) s.plat = stateOf(platMap, s);
    }
  }

  // ── GAPS: page cần capture thêm để train đủ phpbb ───────────────────────────
  const gaps: string[] = [];
  if (!has(/<textarea[^>]*name="message"/i) && !has(/id="message"/i)) gaps.push('Composer: chưa có ô soạn reply → capture viewtopic.php?t=<id> + posting.php?mode=reply (logged-in) để seed composer.editor/postBtn + post.item/body/author.');
  if (registerUrl) gaps.push('Signup đầy đủ: chỉ thấy form login → capture trang register (' + registerUrl + ') để seed email/password_confirm/display_name.');
  if (loggedIn === false) gaps.push('Viewer.*: trang đang LOGGED-OUT → capture 1 trang đã đăng nhập để seed viewer.handle/avatar/logout/unread.');

  const result: DomExtract = {
    id, url: (row.url as string | null) ?? null, title: (row.title as string | null) ?? null,
    bytes: Number(row.bytes) || 0, pageKind: String(row.page_kind ?? 'page'),
    platformKey: (row.platform_key as string | null) ?? null, technologyKey: (row.technology_key as string | null) ?? null,
    signals,
    users: usersArr.slice(0, 80), threads: threadsArr.slice(0, 80), boards: boardsArr.slice(0, 60),
    inputs, blocks, breadcrumbs, pagination: pg,
    counts: { users: users.size, threads: threads.size, boards: boards.size, anchors, inputs: inputs.length },
    classHooks, seedSelectors: dedupSel, gaps,
  };
  // Lưu SUMMARY fields tách được (đọc 1 lần, list khỏi parse lại) — đồng bộ với read_at.
  const summary: DomExtractSummary = {
    counts: result.counts,
    selFields: dedupSel.map((s) => s.field),
    inputs: inputs.filter((i) => i.type !== 'submit' && i.type !== 'button').map((i) => i.label || i.name || i.type).filter(Boolean).slice(0, 14),
    engine: signals.engine, loggedIn: signals.loggedIn,
  };
  try { await db.execute(sql`UPDATE dom_samples SET extract = ${JSON.stringify(summary)}::jsonb WHERE id = ${id}`); } catch { /* non-fatal */ }
  return result;
}

// Seed: ghi seedSelectors của 1 sample vào selector_overrides ở scope chọn (technology
// = mọi forum cùng engine kế thừa; platform = chỉ site này). Sau seed, ext highlight
// các field này trên trang (page_kind thread-list/member-list). Trả số dòng đã ghi.
export interface SeedResult { ok: boolean; seeded: number; skippedSame: number; protectedManual: number; scopeKey?: string; error?: string }
export async function seedSelectorsFromSample(id: number, scope: 'technology' | 'platform', force = false): Promise<SeedResult> {
  const fail = (error: string): SeedResult => ({ ok: false, seeded: 0, skippedSame: 0, protectedManual: 0, error });
  const db = getDb();
  if (!db) return fail('no db');
  const ex = await extractDomSample(id);
  if (!ex) return fail('sample not found');
  const scopeKey = scope === 'technology' ? ex.technologyKey : ex.platformKey;
  if (!scopeKey) return fail(`sample chưa gắn ${scope}`);
  if (!ex.seedSelectors.length) return fail('không có selector đề xuất (trang ít entity-link)');
  let seeded = 0, skippedSame = 0, protectedManual = 0;
  for (const s of ex.seedSelectors) {
    const st = scope === 'technology' ? s.tech : s.plat;
    if (st?.status === 'same') { skippedSame++; continue; }                                  // đã có y hệt → no-op
    if (st?.status === 'diff' && st.source === 'manual' && !force) { protectedManual++; continue; } // train tay → KHÔNG đè (trừ khi force)
    const res = await setOverride({ scopeKind: scope, scopeKey, pageKind: s.pageKind, fieldName: s.field, spec: { css: s.css, attr: s.attr }, source: 'promoted' });
    if (res.ok) seeded++;
  }
  return { ok: true, seeded, skippedSame, protectedManual, scopeKey };
}

export async function deleteDomSample(id: number): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  try { await db.execute(sql`DELETE FROM dom_samples WHERE id = ${id}`); return { ok: true }; }
  catch (e) { return { ok: false, error: (e as Error).message }; }
}

// ── UX Flows (need→action chains, data-driven block-diagram) ─────────────────
// Node 'uxFlow' trong Studio: list flow + steps; mỗi step.objects = entity key →
// mở drawer entity. Drive thiết kế ext (chuỗi nhu cầu→hành động).
export interface UxFlowRow { id: number; key: string; label: string; surface: string | null; description: string | null; steps: number }
export interface UxFlowStep { id: number; stepKey: string; label: string; need: string | null; action: string | null; objects: string[]; route: string | null; note: string | null; orderIndex: number }
export interface UxFlowDetailData { id: number; key: string; label: string; surface: string | null; description: string | null; steps: UxFlowStep[] }

export async function listUxFlows(): Promise<UxFlowRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT f.id, f.key, f.label, f.surface, f.description,
           (SELECT count(*)::int FROM ux_flow_steps s WHERE s.flow_id = f.id) AS steps
    FROM ux_flows f WHERE f.archived_at IS NULL ORDER BY f.order_index, f.id`);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), key: String(r.key), label: String(r.label),
    surface: (r.surface as string | null) ?? null, description: (r.description as string | null) ?? null,
    steps: Number(r.steps) || 0,
  }));
}

export async function getUxFlow(id: number): Promise<UxFlowDetailData | null> {
  const db = getDb();
  if (!db) return null;
  const fr = await db.execute(sql`SELECT id, key, label, surface, description FROM ux_flows WHERE id = ${id} LIMIT 1`);
  const f = (fr as unknown as Array<Record<string, unknown>>)[0];
  if (!f) return null;
  const sr = await db.execute(sql`SELECT id, step_key, label, need, action, objects, route, note, order_index FROM ux_flow_steps WHERE flow_id = ${id} ORDER BY order_index, id`);
  const steps: UxFlowStep[] = (sr as unknown as Array<Record<string, unknown>>).map((s) => ({
    id: Number(s.id), stepKey: String(s.step_key), label: String(s.label),
    need: (s.need as string | null) ?? null, action: (s.action as string | null) ?? null,
    objects: Array.isArray(s.objects) ? (s.objects as string[]) : (typeof s.objects === 'string' ? (JSON.parse(s.objects) as string[]) : []),
    route: (s.route as string | null) ?? null, note: (s.note as string | null) ?? null,
    orderIndex: Number(s.order_index) || 0,
  }));
  return { id: Number(f.id), key: String(f.key), label: String(f.label), surface: (f.surface as string | null) ?? null, description: (f.description as string | null) ?? null, steps };
}

// ── Identities (view + edit in Studio) ───────────────────────────────────────
// Identity node drawer: list per project → open one → see full persona/custom
// fields → edit text fields inline. Password is NEVER read/edited here (only a
// has-password flag) — credential editing stays in the ext flow.
export interface IdentityRow { id: number; name: string; kind: string | null; handleBase: string | null; email: string | null; displayName: string | null; project: string | null }
export interface IdentityDetailData {
  id: number; projectId: string | null; name: string; kind: string | null;
  handleBase: string | null; email: string | null; displayName: string | null;
  bio: string | null; avatarUrl: string | null;
  persona: Record<string, unknown> | null; customFields: Record<string, unknown> | null;
  hasPassword: boolean; updatedAt: string | null;
}
const asJsonObj = (v: unknown): Record<string, unknown> | null => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string' && v.trim()) { try { const p = JSON.parse(v); return p && typeof p === 'object' ? p as Record<string, unknown> : null; } catch { return null; } }
  return null;
};

export async function listIdentities(projectId?: string): Promise<IdentityRow[]> {
  const db = getDb();
  if (!db) return [];
  const base = sql`
    SELECT i.id, i.name, i.kind, i.handle_base, i.email, i.display_name, p.name AS project
    FROM identities i LEFT JOIN projects p ON p.id = i.project_id`;
  const rows = await db.execute(projectId
    ? sql`${base} WHERE EXISTS (SELECT 1 FROM identity_projects ip WHERE ip.identity_id = i.id AND ip.project_id = ${projectId}) ORDER BY i.updated_at DESC NULLS LAST, i.id DESC`
    : sql`${base} ORDER BY i.updated_at DESC NULLS LAST, i.id DESC`);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), name: String(r.name ?? ''),
    kind: (r.kind as string | null) ?? null, handleBase: (r.handle_base as string | null) ?? null,
    email: (r.email as string | null) ?? null, displayName: (r.display_name as string | null) ?? null,
    project: (r.project as string | null) ?? null,
  }));
}

export async function getIdentity(id: number): Promise<IdentityDetailData | null> {
  const db = getDb();
  if (!db) return null;
  const r = await db.execute(sql`
    SELECT id, project_id, name, kind, handle_base, email, display_name, bio, avatar_url,
           persona, custom_fields, password_enc, updated_at
    FROM identities WHERE id = ${id} LIMIT 1`);
  const x = (r as unknown as Array<Record<string, unknown>>)[0];
  if (!x) return null;
  return {
    id: Number(x.id), projectId: (x.project_id as string | null) ?? null, name: String(x.name ?? ''),
    kind: (x.kind as string | null) ?? null, handleBase: (x.handle_base as string | null) ?? null,
    email: (x.email as string | null) ?? null, displayName: (x.display_name as string | null) ?? null,
    bio: (x.bio as string | null) ?? null, avatarUrl: (x.avatar_url as string | null) ?? null,
    persona: asJsonObj(x.persona), customFields: asJsonObj(x.custom_fields),
    hasPassword: !!x.password_enc, updatedAt: x.updated_at ? String(x.updated_at) : null,
  };
}

export interface IdentityPatch { name?: string; kind?: string; handleBase?: string; email?: string; displayName?: string; bio?: string }
export async function updateIdentity(id: number, patch: IdentityPatch): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  // COALESCE → only provided (non-null) fields change; omit a field to keep it.
  // Project membership = pivot identity_projects (setIdentityProjects), KHÔNG ở đây.
  try {
    await db.execute(sql`
      UPDATE identities SET
        name = COALESCE(${patch.name ?? null}, name),
        kind = COALESCE(${patch.kind ?? null}, kind),
        handle_base = COALESCE(${patch.handleBase ?? null}, handle_base),
        email = COALESCE(${patch.email ?? null}, email),
        display_name = COALESCE(${patch.displayName ?? null}, display_name),
        bio = COALESCE(${patch.bio ?? null}, bio),
        updated_at = now()
      WHERE id = ${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── identity ↔ projects (pivot, mirror accountProjectsPanel) ──────────────────
// 1 persona dùng cho N project. participations = project đang link; allProjects =
// project có thể chọn thêm. role 'primary' = home (đồng bộ identities.project_id).
export async function identityProjectsPanel(identityId: number): Promise<{
  participations: Array<{ projectId: string; name: string; emoji: string; role: string }>;
  allProjects: Array<{ id: string; name: string; emoji: string }>;
}> {
  const db = getDb();
  if (!db) return { participations: [], allProjects: [] };
  const parts = await db.execute(sql`
    SELECT ip.project_id, ip.role, p.name, p.emoji
    FROM identity_projects ip LEFT JOIN projects p ON p.id = ip.project_id
    WHERE ip.identity_id = ${identityId}
    ORDER BY (ip.role = 'primary') DESC, p.name`);
  const all = await db.execute(sql`
    SELECT id, name, emoji FROM projects WHERE is_demo = false AND archived_at IS NULL ORDER BY name`);
  return {
    participations: (parts as unknown as Array<Record<string, unknown>>).map((r) => ({
      projectId: String(r['project_id']), name: String(r['name'] ?? r['project_id']), emoji: r['emoji'] ? String(r['emoji']) : '', role: String(r['role'] ?? 'shared'),
    })),
    allProjects: (all as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r['id']), name: String(r['name'] ?? r['id']), emoji: r['emoji'] ? String(r['emoji']) : '',
    })),
  };
}

// Batch set: persona dùng cho ĐÚNG tập projectIds. Giữ home cũ làm 'primary' nếu còn
// trong tập, else project đầu. Đồng bộ scalar identities.project_id = primary (để picker
// cũ + getIdentity vẫn đúng). Empty = gỡ khỏi mọi project (orphan, hiện ở global view).
export async function setIdentityProjects(identityId: number, projectIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  const ids = Array.from(new Set(projectIds.filter(Boolean)));
  try {
    const cur = await db.execute(sql`SELECT project_id FROM identities WHERE id = ${identityId} LIMIT 1`);
    const home = (cur as unknown as Array<{ project_id: string | null }>)[0]?.project_id ?? null;
    const primary = (home && ids.includes(home)) ? home : (ids[0] ?? null);
    await db.transaction(async (tx) => {
      // ponytail: delete-all + re-insert (≤ vài chục project) — đơn giản, đúng trong 1 tx.
      await tx.execute(sql`DELETE FROM identity_projects WHERE identity_id = ${identityId}`);
      for (const pid of ids) {
        await tx.execute(sql`INSERT INTO identity_projects (project_id, identity_id, role) VALUES (${pid}, ${identityId}, ${pid === primary ? 'primary' : 'shared'})`);
      }
      await tx.execute(sql`UPDATE identities SET project_id = ${primary}, updated_at = now() WHERE id = ${identityId}`);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Template Adoption ────────────────────────────────────────────────────────
// Scaling lever: 1 technology template (e.g. xenforo signup+composer+profile)
// covers EVERY forum on that engine the moment a platform binds technology_key.
// This worklist surfaces (a) which templates exist + who's bound, (b) ext-detected
// candidates awaiting a 1-click adopt, (c) unbound platforms that still need a template.
export interface AdoptTech {
  key: string;
  label: string;
  selectorCounts: Record<string, number>; // technology-scope page_kind → n (the inheritance pack)
  total: number;
  bound: Array<{ key: string; label: string; ownComposer: number; ownSignup: number }>;
  candidates: Array<{ host: string; platformKey: string; platformExists: boolean; hits: number; lastSeen: string }>;
}
export interface AdoptUnbound { key: string; label: string; accounts: number; signup: number; composer: number; detectedTech: string | null }
export interface TemplateAdoptionData {
  techs: AdoptTech[];                              // technologies that actually carry selectors (templates)
  allTechs: Array<{ key: string; label: string }>; // every technology (for manual bind dropdown)
  unbound: AdoptUnbound[];                         // platforms with accounts, no tech bound, not seed-ready
  detectedCount: number;
  seedReadyCount: number;
}

export async function templateAdoption(): Promise<TemplateAdoptionData> {
  const empty: TemplateAdoptionData = { techs: [], allTechs: [], unbound: [], detectedCount: 0, seedReadyCount: 0 };
  const db = getDb();
  if (!db) return empty;
  try {
    // technology-scope selector pack per page_kind (legacy 'engine' folded into 'technology')
    const techSelRaw = await db.execute(sql`
      SELECT scope_key, page_kind, count(*)::int AS n FROM selector_overrides
      WHERE scope_kind IN ('technology','engine') GROUP BY scope_key, page_kind`);
    const techSel = new Map<string, Record<string, number>>();
    for (const r of techSelRaw as unknown as Array<{ scope_key: string; page_kind: string; n: number }>) {
      const m = techSel.get(r.scope_key) ?? techSel.set(r.scope_key, {}).get(r.scope_key)!;
      m[r.page_kind] = (m[r.page_kind] ?? 0) + Number(r.n);
    }
    // platform-scope own counts per page_kind
    const platSelRaw = await db.execute(sql`
      SELECT scope_key, page_kind, count(*)::int AS n FROM selector_overrides
      WHERE scope_kind = 'platform' GROUP BY scope_key, page_kind`);
    const platSel = new Map<string, Record<string, number>>();
    for (const r of platSelRaw as unknown as Array<{ scope_key: string; page_kind: string; n: number }>) {
      const m = platSel.get(r.scope_key) ?? platSel.set(r.scope_key, {}).get(r.scope_key)!;
      m[r.page_kind] = (m[r.page_kind] ?? 0) + Number(r.n);
    }
    const allTechsRaw = await db.execute(sql`SELECT key, label FROM platform_technologies ORDER BY label`);
    const allTechs = (allTechsRaw as unknown as Array<{ key: string; label: string }>).map((t) => ({ key: String(t.key), label: String(t.label) }));
    const platRaw = await db.execute(sql`
      SELECT p.key, p.label, p.technology_key, p.category,
             (SELECT count(*)::int FROM platform_accounts WHERE platform_key = p.key) AS accounts
      FROM platforms p`);
    const plats = platRaw as unknown as Array<{ key: string; label: string; technology_key: string | null; category: string | null; accounts: number }>;
    const detRaw = await db.execute(sql`
      SELECT d.host, d.platform_key, d.technology_key, d.hits, d.last_seen,
             (p.key IS NOT NULL) AS exists, p.technology_key AS bound
      FROM platform_tech_detections d LEFT JOIN platforms p ON p.key = d.platform_key
      ORDER BY d.last_seen DESC`);
    const dets = detRaw as unknown as Array<{ host: string; platform_key: string; technology_key: string; hits: number; last_seen: string; exists: boolean; bound: string | null }>;

    const own = (k: string, pk: string) => platSel.get(k)?.[pk] ?? 0;
    const isSeedReady = (k: string, techKey: string | null) => {
      const inh = techKey ? (techSel.get(techKey) ?? {}) : {};
      const sig = own(k, 'signup') + (inh['signup'] ?? 0);
      const com = own(k, 'composer') + (inh['composer'] ?? 0);
      return sig > 0 && com > 0;
    };

    // techs = only technologies carrying selectors (real templates)
    const techs: AdoptTech[] = [];
    for (const t of allTechs) {
      const sc = techSel.get(t.key);
      if (!sc || Object.keys(sc).length === 0) continue;
      const bound = plats.filter((p) => p.technology_key === t.key)
        .map((p) => ({ key: p.key, label: p.label, ownComposer: own(p.key, 'composer'), ownSignup: own(p.key, 'signup') }));
      const candidates = dets.filter((d) => d.technology_key === t.key && d.bound !== t.key)
        .map((d) => ({ host: d.host, platformKey: d.platform_key, platformExists: !!d.exists, hits: Number(d.hits), lastSeen: String(d.last_seen) }));
      techs.push({ key: t.key, label: t.label, selectorCounts: sc, total: Object.values(sc).reduce((a, b) => a + b, 0), bound, candidates });
    }
    techs.sort((a, b) => (b.candidates.length - a.candidates.length) || (b.total - a.total));

    const detByPlat = new Map<string, string>();
    for (const d of dets) if (!detByPlat.has(d.platform_key)) detByPlat.set(d.platform_key, d.technology_key);

    // Manual-bind list = CHỈ forum platform thật. Template adoption chỉ áp dụng cho
    // forum chạy engine chung (xenforo/phpbb/…); platform bespoke (Discord/FB/LinkedIn/
    // AdSense/Product Hunt…) train selector RIÊNG ở platform scope, KHÔNG dùng technology
    // → loại khỏi đây (tránh list phình vô hạn + bind vô nghĩa). Tín hiệu forum:
    //   (a) đã ext-detect engine (→ nằm ở candidates per-template rồi, loại khỏi đây để khỏi trùng), HOẶC
    //   (b) category = community/forum (forum chưa ext-thăm → cho bind tay).
    const FORUM_CATS = new Set(['community', 'forum']);
    const unbound: AdoptUnbound[] = plats
      .filter((p) => !p.technology_key && Number(p.accounts) > 0 && !isSeedReady(p.key, null)
        && FORUM_CATS.has(String(p.category || '').toLowerCase()) && !detByPlat.has(p.key))
      .map((p) => ({ key: p.key, label: p.label, accounts: Number(p.accounts), signup: own(p.key, 'signup'), composer: own(p.key, 'composer'), detectedTech: null }))
      .sort((a, b) => (b.accounts - a.accounts) || a.label.localeCompare(b.label));

    const seedReadyCount = plats.filter((p) => isSeedReady(p.key, p.technology_key)).length;
    return { techs, allTechs, unbound, detectedCount: dets.length, seedReadyCount };
  } catch { return empty; }
}

// canonChecks — LIVE drift for the behavioral registry (Studio "Canon" view). The backend
// can't read the ext literals (other repo), so this checks the DB invariants the canon
// resolvers exist to protect: platform_key rows under a non-canonical alias (x/bsky should
// be twitter/bluesky) + selector_overrides field_name that isn't canon. drift=-1 = check failed.
export interface CanonCheck { key: string; drift: number; detail: string }
export async function canonChecks(): Promise<CanonCheck[]> {
  const db = getDb();
  if (!db) return [];
  const rowsOf = (res: unknown): Array<Record<string, unknown>> =>
    Array.isArray(res) ? res : ((res as { rows?: Array<Record<string, unknown>> }).rows || []);
  const out: CanonCheck[] = [];
  try {
    const r = rowsOf(await db.execute(sql`
      SELECT
        (SELECT count(*) FROM platform_accounts WHERE platform_key IN ('x','bsky')) AS acc,
        (SELECT count(*) FROM habitats WHERE platform_key IN ('x','bsky')) AS hab,
        (SELECT count(*) FROM platform_boards WHERE platform_key IN ('x','bsky')) AS brd,
        (SELECT count(*) FROM platforms WHERE key IN ('x','bsky')) AS cat`));
    const x = r[0] || {};
    const n = (['acc', 'hab', 'brd', 'cat'] as const).reduce((a, k) => a + Number(x[k] ?? 0), 0);
    out.push({
      key: 'platformKey', drift: n,
      detail: n
        ? `${Number(x.acc ?? 0)} accounts · ${Number(x.hab ?? 0)} habitats · ${Number(x.brd ?? 0)} boards · ${Number(x.cat ?? 0)} catalog under alias key (x/bsky) — phải canonical (twitter/bluesky)`
        : 'mọi platform_key row đã canonical (0 row x/bsky)',
    });
  } catch (e) { out.push({ key: 'platformKey', drift: -1, detail: (e as Error).message }); }
  try {
    // Structural fields are verbatim by design (composer page_kind + dotted convention), so an
    // uppercase there is NOT drift. Flag only FORM fields: non-structural uppercase (mechCanon would
    // lowercase) + known unfolded signup aliases (bio→about, website→profile_website…).
    const r = rowsOf(await db.execute(sql`
      SELECT count(*) AS n FROM selector_overrides
      WHERE (field_name ~ '[A-Z]' AND page_kind <> 'composer'
             AND field_name !~ '^(composer|post|viewer|thread|parent|metric)\.')
         OR field_name IN ('bio','website','pronoun','pronouns','homepage','nickname','displayname')`));
    const n = Number(r[0]?.n ?? 0);
    out.push({
      key: 'fieldCanon', drift: n,
      detail: n
        ? `${n} selector_overrides có field_name form chưa canon (hoa ngoài cấu trúc, hoặc alias chưa fold: bio/website/pronoun…)`
        : 'mọi form field_name đã canon (structural verbatim không tính)',
    });
  } catch (e) { out.push({ key: 'fieldCanon', drift: -1, detail: (e as Error).message }); }
  return out;
}
