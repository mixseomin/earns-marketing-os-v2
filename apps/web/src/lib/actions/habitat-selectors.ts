'use server';

// 3-tier selector inheritance (mig 0061 selector_overrides table).
// Cascade: habitat > platform > technology. Field-level — mỗi field tự
// resolve qua chuỗi cascade, dùng row có scope cụ thể nhất.
// NOTE: scope_kind 'technology' was renamed from the legacy value 'engine'
// (mig 0101). Reads stay backward-compatible via normScopeKind/scopeKindMatch.
//
// Files liên quan:
//   - apps/web/src/app/api/ext/learn-selectors/route.ts (ext entry)
//   - apps/web/src/components/habitat-selectors-section.tsx (UI)

import { getDb, selectorOverrides, habitats } from '@mos2/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { canonField } from '../selector-field-canon';
// Sync scope helpers live in a plain module ('use server' files may only export
// async fns). Re-export the TYPE here (type-only re-export is erased → allowed) so
// existing `import { ScopeKind } from '.../habitat-selectors'` sites keep working.
import { normScopeKind, scopeKindMatch, type ScopeKind } from '@/lib/scope-kind';
export type { ScopeKind } from '@/lib/scope-kind';

// CSS-identity guard: if a row at the same (scope, page_kind) already holds
// this exact css under a DIFFERENT field_name, that existing field IS this
// field (same element). Return its name so the writer adopts it instead of
// spawning a parallel duplicate. Catches "same element, different name" that
// alias maps can't predict. Returns null when no collision.
async function adoptExistingField(
  db: NonNullable<ReturnType<typeof getDb>>,
  scopeKind: string, scopeKey: string, pageKind: string,
  fieldName: string, css: string,
  ignoreField?: string | null,
): Promise<string | null> {
  if (!css) return null;
  const conds = [
    eq(selectorOverrides.tenantId, TENANT),
    eq(selectorOverrides.scopeKind, scopeKind),
    eq(selectorOverrides.scopeKey, scopeKey),
    eq(selectorOverrides.pageKind, pageKind),
    sql`${selectorOverrides.spec}->>'css' = ${css}`,
    sql`${selectorOverrides.fieldName} <> ${fieldName}`,
  ];
  // Explicit rename: exclude the row we're renaming FROM (same element, the user
  // is intentionally giving it a new name) so the guard doesn't pull it straight back.
  if (ignoreField) conds.push(sql`${selectorOverrides.fieldName} <> ${ignoreField}`);
  const rows = await db
    .select({ field: selectorOverrides.fieldName })
    .from(selectorOverrides)
    .where(and(...conds))
    .limit(1);
  return rows[0]?.field ?? null;
}

export interface SelectorSpec {
  css: string;
  attr?: string;
  parse?: 'number' | 'date' | 'number-suffix' | 'enum';
  enum_values?: string[];
  notes?: string;
  // Metric-only (page_kind='post-metrics'): cách ext đọc SỐ ra khỏi element,
  // khớp branch trong MOS2.sel.metrics(). Bỏ trống cho field thường.
  via?: 'text' | 'attr' | 'count' | 'depthCount' | 'aria';
}

export type SelectorMap = Record<string, SelectorSpec>;

export interface ResolvedField {
  spec: SelectorSpec;
  source: {
    scope: ScopeKind;
    key: string;
    source: 'llm' | 'manual' | 'promoted';
    updated_at: string;
  };
}

export type ResolvedMap = Record<string, ResolvedField>;

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// Scope priority cho cascade: số cao = ưu tiên cao hơn.
const SCOPE_PRIORITY: Record<ScopeKind, number> = {
  habitat: 3,
  platform: 2,
  technology: 1,
};

// resolveSelectors: input (habitatId/platformKey/techKey, pageKind) →
// output merged map kèm source-of-truth per field. Cách query 1 shot:
// lấy mọi row match 3 scope, group theo field, pick row có scope priority
// cao nhất.
export async function resolveSelectors(opts: {
  habitatId?: number | null;
  platformKey?: string | null;
  technologyKey?: string | null;
  pageKind: string;
}): Promise<ResolvedMap> {
  const db = getDb();
  if (!db) return {};

  // scopes: list of legacy-aware scope_kind values per condition. The technology
  // tier matches BOTH the new 'technology' and the legacy 'engine' value so
  // un-migrated rows still resolve.
  const conditions: Array<{ scopes: string[]; key: string }> = [];
  if (opts.habitatId != null) conditions.push({ scopes: ['habitat'], key: String(opts.habitatId) });
  if (opts.platformKey) conditions.push({ scopes: ['platform'], key: opts.platformKey });
  if (opts.technologyKey) conditions.push({ scopes: ['technology', 'engine'], key: opts.technologyKey });
  if (conditions.length === 0) return {};

  // OR mỗi (scope_kind, scope_key) pair + page_kind chung.
  const rows = await db.execute(sql`
    SELECT scope_kind, scope_key, field_name, spec, source, updated_at
    FROM selector_overrides
    WHERE tenant_id = ${TENANT}
      AND page_kind = ${opts.pageKind}
      AND (
        ${sql.join(
          conditions.map((c) => sql`(scope_kind IN (${sql.join(c.scopes.map((s) => sql`${s}`), sql`, `)}) AND scope_key = ${c.key})`),
          sql` OR `,
        )}
      )
  `);

  const out: ResolvedMap = {};
  for (const r of rows as unknown as Array<{
    scope_kind: string; scope_key: string; field_name: string;
    spec: SelectorSpec; source: 'llm' | 'manual' | 'promoted'; updated_at: Date | string;
  }>) {
    const scope = normScopeKind(r.scope_kind);
    const existing = out[r.field_name];
    const newPri = SCOPE_PRIORITY[scope] ?? 0;
    const oldPri = existing ? SCOPE_PRIORITY[existing.source.scope] ?? 0 : -1;
    if (newPri > oldPri) {
      out[r.field_name] = {
        spec: r.spec,
        source: {
          scope,
          key: r.scope_key,
          source: r.source,
          updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
        },
      };
    }
  }
  return out;
}

// resolveSelectorsForHabitat: helper - lookup habitat → tự derive
// platformKey + technologyKey. Dùng khi UI có habitatId nhưng không
// có sẵn platform/tech.
export async function resolveSelectorsForHabitat(
  habitatId: number, pageKind: string,
): Promise<{ resolved: ResolvedMap; platformKey: string | null; technologyKey: string | null }> {
  const db = getDb();
  if (!db) return { resolved: {}, platformKey: null, technologyKey: null };
  const [hab] = await db
    .select({
      id: habitats.id,
      platformKey: habitats.platformKey,
      technologyKey: habitats.technologyKey,
    })
    .from(habitats)
    .where(eq(habitats.id, habitatId))
    .limit(1);
  if (!hab) return { resolved: {}, platformKey: null, technologyKey: null };
  const resolved = await resolveSelectors({
    habitatId: hab.id,
    platformKey: hab.platformKey,
    technologyKey: hab.technologyKey,
    pageKind,
  });
  return { resolved, platformKey: hab.platformKey, technologyKey: hab.technologyKey };
}

// setOverride: upsert 1 field-scope. Source default 'manual' (UI edit).
export async function setOverride(opts: {
  scopeKind: ScopeKind;
  scopeKey: string;
  pageKind: string;
  fieldName: string;
  spec: SelectorSpec;
  source?: 'llm' | 'manual' | 'promoted';
  // Explicit rename from the editor: the field_name this element was saved under
  // before. When set and the name actually changed, rename the existing row (drop
  // the old name) instead of letting the CSS-identity guard adopt the new name
  // straight back onto it. Without this, renames silently no-op.
  renameFrom?: string;
}): Promise<{ ok: boolean; error?: string; canonicalField?: string; adopted?: boolean }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  if (!opts.spec.css) return { ok: false, error: 'spec.css required' };
  // Always persist the canonical scope value (never legacy 'engine').
  const scopeKind = normScopeKind(opts.scopeKind);
  // 1) Normalize field name (bracket/case/alias) so variants converge.
  let field = canonField(opts.fieldName, opts.pageKind);
  if (!field) return { ok: false, error: 'field_name empty after normalize' };
  const renameFrom = opts.renameFrom ? canonField(opts.renameFrom, opts.pageKind) : null;
  const isRename = !!renameFrom && renameFrom !== field;
  // 2) CSS-identity guard: same css under another name → adopt it (no dup). On an
  //    explicit rename, exclude the old-name row so we rename it (step 3) instead
  //    of folding the new name back onto it.
  const requested = field;
  const adoptedName = await adoptExistingField(
    db, scopeKind, opts.scopeKey, opts.pageKind, field, opts.spec.css,
    isRename ? renameFrom : undefined,
  );
  if (adoptedName) field = adoptedName;
  // adopted = the guard folded the requested name onto a DIFFERENT existing field
  // (a silent collision the caller must surface — NOT a rename, NOT a pure re-save).
  const adopted = !!adoptedName && adoptedName !== requested;
  try {
    await db.execute(sql`
      INSERT INTO selector_overrides
        (tenant_id, scope_kind, scope_key, page_kind, field_name, spec, source, updated_at)
      VALUES (${TENANT}, ${scopeKind}, ${opts.scopeKey}, ${opts.pageKind},
              ${field}, ${JSON.stringify(opts.spec)}::jsonb,
              ${opts.source ?? 'manual'}, NOW())
      ON CONFLICT (tenant_id, scope_kind, scope_key, page_kind, field_name)
      DO UPDATE SET spec = EXCLUDED.spec, source = EXCLUDED.source, updated_at = NOW()
    `);
    // 3) Explicit rename committed: the new name now holds the spec, so drop the
    //    old-name row (same scope/page). Skip if the guard re-folded onto it.
    if (isRename && renameFrom && field !== renameFrom) {
      await db.delete(selectorOverrides).where(and(
        eq(selectorOverrides.tenantId, TENANT),
        inArray(selectorOverrides.scopeKind, scopeKindMatch(scopeKind)),
        eq(selectorOverrides.scopeKey, opts.scopeKey),
        eq(selectorOverrides.pageKind, opts.pageKind),
        eq(selectorOverrides.fieldName, renameFrom),
      ));
    }
    revalidatePath('/platforms');
    return { ok: true, canonicalField: field, adopted };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// setMap: upsert multiple fields cùng scope (bulk save từ UI edit JSON).
// PROTECT: LLM source KHÔNG ghi đè spec đã có source='manual'.
// User-trained selector luôn thắng — LLM chỉ fill field CHƯA có hoặc
// field đã có source='llm' (trước đó tự gen). Để override manual,
// caller phải truyền source='manual' (qua save-selector flow).
export async function setMap(opts: {
  scopeKind: ScopeKind;
  scopeKey: string;
  pageKind: string;
  selectors: SelectorMap;
  source?: 'llm' | 'manual' | 'promoted';
}): Promise<{ ok: boolean; saved: number; skipped: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, saved: 0, skipped: 0, error: 'DB unavailable' };
  const scopeKind = normScopeKind(opts.scopeKind);
  const source = opts.source ?? 'llm';
  let saved = 0;
  let skipped = 0;
  // Within-batch css dedup: first field to claim a css wins; later fields with
  // the same css fold onto it (prevents the LLM emitting two names for one node).
  const cssClaimed = new Map<string, string>();
  try {
    for (const [rawField, spec] of Object.entries(opts.selectors)) {
      if (!spec?.css) continue;
      let field = canonField(rawField, opts.pageKind);
      if (!field) { skipped++; continue; }
      // In-batch claim, then DB-wide CSS-identity guard (adopt existing name).
      const claimed = cssClaimed.get(spec.css);
      if (claimed && claimed !== field) field = claimed;
      else {
        const adopted = await adoptExistingField(db, scopeKind, opts.scopeKey, opts.pageKind, field, spec.css);
        if (adopted) field = adopted;
        cssClaimed.set(spec.css, field);
      }
      // Skip nếu LLM cố ghi đè spec đã có source='manual'.
      // ON CONFLICT WHERE clause: chỉ update khi current source != 'manual'
      // OR new source IS 'manual' (manual luôn được set).
      const res = await db.execute(sql`
        INSERT INTO selector_overrides
          (tenant_id, scope_kind, scope_key, page_kind, field_name, spec, source, updated_at)
        VALUES (${TENANT}, ${scopeKind}, ${opts.scopeKey}, ${opts.pageKind},
                ${field}, ${JSON.stringify(spec)}::jsonb,
                ${source}, NOW())
        ON CONFLICT (tenant_id, scope_kind, scope_key, page_kind, field_name)
        DO UPDATE SET spec = EXCLUDED.spec, source = EXCLUDED.source, updated_at = NOW()
        WHERE selector_overrides.source != 'manual' OR EXCLUDED.source = 'manual'
        RETURNING field_name
      `);
      // pg returns rowCount on the result; nếu rowCount = 0 nghĩa là
      // ON CONFLICT WHERE filter chặn (đã có manual) → skipped.
      // Drizzle/pg shape: res.rowCount hoặc res.rows.length tùy driver.
      const updated = (res as { rowCount?: number; rows?: unknown[] }).rowCount
        ?? (res as { rows?: unknown[] }).rows?.length ?? 0;
      if (updated > 0) saved++; else skipped++;
    }
    revalidatePath('/platforms');
    return { ok: true, saved, skipped };
  } catch (e) {
    return { ok: false, saved, skipped, error: (e as Error).message };
  }
}

// clearOverride: delete 1 row (UI revert tới inherited scope).
export async function clearOverride(opts: {
  scopeKind: ScopeKind;
  scopeKey: string;
  pageKind: string;
  fieldName: string;
}): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.delete(selectorOverrides).where(and(
    eq(selectorOverrides.tenantId, TENANT),
    inArray(selectorOverrides.scopeKind, scopeKindMatch(opts.scopeKind)),
    eq(selectorOverrides.scopeKey, opts.scopeKey),
    eq(selectorOverrides.pageKind, opts.pageKind),
    eq(selectorOverrides.fieldName, opts.fieldName),
  ));
  revalidatePath('/platforms');
  return { ok: true };
}

// promoteToScope: move 1 field từ scope hẹp → rộng hơn (vd habitat → platform).
// Use case: 1 habitat fix selector ngon, muốn share cho mọi habitat cùng platform.
export async function promoteToScope(opts: {
  fromScope: ScopeKind;
  fromKey: string;
  toScope: ScopeKind;
  toKey: string;
  pageKind: string;
  fieldName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const [row] = await db
    .select({ spec: selectorOverrides.spec })
    .from(selectorOverrides)
    .where(and(
      eq(selectorOverrides.tenantId, TENANT),
      inArray(selectorOverrides.scopeKind, scopeKindMatch(opts.fromScope)),
      eq(selectorOverrides.scopeKey, opts.fromKey),
      eq(selectorOverrides.pageKind, opts.pageKind),
      eq(selectorOverrides.fieldName, opts.fieldName),
    ))
    .limit(1);
  if (!row) return { ok: false, error: 'source row not found' };
  await setOverride({
    scopeKind: opts.toScope,
    scopeKey: opts.toKey,
    pageKind: opts.pageKind,
    fieldName: opts.fieldName,
    spec: row.spec as SelectorSpec,
    source: 'promoted',
  });
  await clearOverride({
    scopeKind: opts.fromScope,
    scopeKey: opts.fromKey,
    pageKind: opts.pageKind,
    fieldName: opts.fieldName,
  });
  return { ok: true };
}

// listScope: lấy mọi field-scope cho 1 (scope, key, page) — UI list edit.
export async function listScope(opts: {
  scopeKind: ScopeKind;
  scopeKey: string;
  pageKind: string;
}): Promise<Array<{ field: string; spec: SelectorSpec; source: string; updatedAt: string }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      field: selectorOverrides.fieldName,
      spec: selectorOverrides.spec,
      source: selectorOverrides.source,
      updatedAt: selectorOverrides.updatedAt,
    })
    .from(selectorOverrides)
    .where(and(
      eq(selectorOverrides.tenantId, TENANT),
      inArray(selectorOverrides.scopeKind, scopeKindMatch(opts.scopeKind)),
      eq(selectorOverrides.scopeKey, opts.scopeKey),
      eq(selectorOverrides.pageKind, opts.pageKind),
    ))
    .orderBy(selectorOverrides.fieldName);
  return rows.map((r) => ({
    field: r.field,
    spec: r.spec as SelectorSpec,
    source: r.source,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  }));
}

// ── Duplicate detection + merge (catch what slips past write-time guards) ──
// A duplicate = ≥2 fields at the same (scope, page_kind) that resolve to the
// SAME element: identical css, OR field names that canonicalize to the same
// key. Surfaced on /technologies for one-click merge so dups never pile up silently.
export interface DupGroup {
  scopeKind: string;
  scopeKey: string;
  pageKind: string;
  reason: 'same-css' | 'same-canon';
  /** key the group collides on (the css string, or the canonical field). */
  on: string;
  fields: Array<{ field: string; css: string; source: string; updatedAt: string }>;
  /** suggested keeper = most-specific/newest (callers may override). */
  suggestedKeep: string;
}

export async function findDuplicateSelectors(opts?: {
  scopeKind?: ScopeKind;
  scopeKey?: string;
}): Promise<DupGroup[]> {
  const db = getDb();
  if (!db) return [];
  const conds = [eq(selectorOverrides.tenantId, TENANT)];
  // Legacy-aware: filtering by 'technology' must also catch un-migrated 'engine' rows.
  if (opts?.scopeKind) conds.push(inArray(selectorOverrides.scopeKind, scopeKindMatch(opts.scopeKind)));
  if (opts?.scopeKey) conds.push(eq(selectorOverrides.scopeKey, opts.scopeKey));
  const rows = await db
    .select({
      scopeKind: selectorOverrides.scopeKind,
      scopeKey: selectorOverrides.scopeKey,
      pageKind: selectorOverrides.pageKind,
      field: selectorOverrides.fieldName,
      spec: selectorOverrides.spec,
      source: selectorOverrides.source,
      updatedAt: selectorOverrides.updatedAt,
    })
    .from(selectorOverrides)
    .where(and(...conds));

  type Row = (typeof rows)[number] & { css: string };
  // Normalize legacy 'engine' scope to 'technology' so dup groups + the merge
  // call downstream operate on the canonical value.
  const norm = rows.map((r) => ({ ...r, scopeKind: normScopeKind(r.scopeKind), css: ((r.spec as SelectorSpec)?.css ?? '').trim() })) as Row[];
  const groups: DupGroup[] = [];
  // bucket per (scope, key, page) → then by css and by canon-field
  const byScope = new Map<string, Row[]>();
  for (const r of norm) {
    const k = `${r.scopeKind} ${r.scopeKey} ${r.pageKind}`;
    (byScope.get(k) ?? byScope.set(k, []).get(k)!).push(r);
  }
  const tsStr = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d));
  const mkField = (r: Row) => ({ field: r.field, css: r.css, source: r.source, updatedAt: tsStr(r.updatedAt) });
  // keeper = manual beats llm, then newest, then longest (most specific) css
  const pickKeep = (fs: Row[]) => ([...fs].sort((a, b) => {
    if ((a.source === 'manual') !== (b.source === 'manual')) return a.source === 'manual' ? -1 : 1;
    const t = tsStr(b.updatedAt).localeCompare(tsStr(a.updatedAt));
    if (t !== 0) return t;
    return b.css.length - a.css.length;
  })[0]!).field;

  for (const list of byScope.values()) {
    const seen = new Set<string>();
    // same-css groups
    const byCss = new Map<string, Row[]>();
    for (const r of list) { if (r.css) (byCss.get(r.css) ?? byCss.set(r.css, []).get(r.css)!).push(r); }
    for (const [css, fs] of byCss) {
      const head = fs[0];
      if (fs.length < 2 || !head) continue;
      fs.forEach((f) => seen.add(f.field));
      groups.push({
        scopeKind: head.scopeKind, scopeKey: head.scopeKey, pageKind: head.pageKind,
        reason: 'same-css', on: css, fields: fs.map(mkField), suggestedKeep: pickKeep(fs),
      });
    }
    // same-canon groups (different css but names fold together) — skip rows
    // already flagged by css to avoid double-report.
    const byCanon = new Map<string, Row[]>();
    for (const r of list) {
      if (seen.has(r.field)) continue;
      const c = canonField(r.field, r.pageKind);
      (byCanon.get(c) ?? byCanon.set(c, []).get(c)!).push(r);
    }
    for (const [canon, fs] of byCanon) {
      const head = fs[0];
      if (fs.length < 2 || !head) continue;
      groups.push({
        scopeKind: head.scopeKind, scopeKey: head.scopeKey, pageKind: head.pageKind,
        reason: 'same-canon', on: canon, fields: fs.map(mkField), suggestedKeep: pickKeep(fs),
      });
    }
  }
  return groups;
}

// mergeSelectorField: keep one field, drop the others in a dup group.
// Selectors only (persona is not touched here). Returns rows removed.
export async function mergeSelectorField(opts: {
  scopeKind: ScopeKind;
  scopeKey: string;
  pageKind: string;
  keep: string;
  drop: string[];
}): Promise<{ ok: boolean; removed: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, removed: 0, error: 'DB unavailable' };
  const drop = opts.drop.filter((d) => d && d !== opts.keep);
  if (drop.length === 0) return { ok: true, removed: 0 };
  try {
    const res = await db.delete(selectorOverrides).where(and(
      eq(selectorOverrides.tenantId, TENANT),
      inArray(selectorOverrides.scopeKind, scopeKindMatch(opts.scopeKind)),
      eq(selectorOverrides.scopeKey, opts.scopeKey),
      eq(selectorOverrides.pageKind, opts.pageKind),
      inArray(selectorOverrides.fieldName, drop),
    ));
    revalidatePath('/technologies');
    revalidatePath('/platforms');
    const removed = (res as { rowCount?: number }).rowCount ?? drop.length;
    return { ok: true, removed };
  } catch (e) {
    return { ok: false, removed: 0, error: (e as Error).message };
  }
}

// listFieldSamples — đọc giá trị thực tế đã scrape từ habitats khác cho
// từng field, dùng làm hover preview trong HabitatSelectorsSection để
// admin biết selector này đang trả data gì ở các habitat thật.
// Trả 4 unique non-empty values gần nhất per field + tên habitat nguồn.
const FIELD_TO_HABITAT_COL: Record<string, string> = {
  title: 'title',
  members: 'members',
  weekly_visitors: 'weekly_visitors',
  weekly_contributions: 'weekly_contributions',
  privacy: 'privacy',
  created_at: 'created_at_source',
  description: 'description',
  icon_url: 'icon_url',
  language: 'language',
  status: 'status',
  community_type: 'community_type',
  url: 'url',
  name: 'name',
};

export async function listFieldSamples(opts: {
  pageKind: string;
  platformKey?: string | null;
  fields: string[];
}): Promise<Record<string, Array<{ value: string; habitat: string }>>> {
  const db = getDb();
  if (!db) return {};
  const out: Record<string, Array<{ value: string; habitat: string }>> = {};
  for (const f of opts.fields) {
    const col = FIELD_TO_HABITAT_COL[f];
    if (!col) { out[f] = []; continue; }
    try {
      const platformFilter = opts.platformKey
        ? sql`AND platform_key = ${opts.platformKey}`
        : sql``;
      const rs = await db.execute(sql`
        SELECT ${sql.raw(col)}::text AS value, name AS habitat
        FROM habitats
        WHERE tenant_id = ${TENANT}
          AND ${sql.raw(col)} IS NOT NULL
          AND ${sql.raw(col)}::text <> ''
          AND ${sql.raw(col)}::text <> '0'
          ${platformFilter}
        ORDER BY last_sync_at DESC NULLS LAST
        LIMIT 12
      `);
      const rows = rs as unknown as Array<{ value: string; habitat: string }>;
      const seen = new Set<string>();
      const uniq: Array<{ value: string; habitat: string }> = [];
      for (const r of rows) {
        const v = (r.value ?? '').toString().trim();
        if (!v || seen.has(v)) continue;
        seen.add(v);
        uniq.push({ value: v, habitat: r.habitat });
        if (uniq.length >= 4) break;
      }
      out[f] = uniq;
    } catch (e) {
      console.warn('[listFieldSamples]', f, (e as Error).message);
      out[f] = [];
    }
  }
  return out;
}
