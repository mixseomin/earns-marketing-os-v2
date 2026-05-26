'use server';

// 3-tier selector inheritance (mig 0061 selector_overrides table).
// Cascade: habitat > platform > engine. Field-level — mỗi field tự
// resolve qua chuỗi cascade, dùng row có scope cụ thể nhất.
//
// Files liên quan:
//   - apps/web/src/app/api/ext/learn-selectors/route.ts (ext entry)
//   - apps/web/src/components/habitat-selectors-section.tsx (UI)

import { getDb, selectorOverrides, habitats } from '@mos2/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type ScopeKind = 'engine' | 'platform' | 'habitat';

export interface SelectorSpec {
  css: string;
  attr?: string;
  parse?: 'number' | 'date' | 'number-suffix' | 'enum';
  enum_values?: string[];
  notes?: string;
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
  engine: 1,
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

  const conditions: Array<{ scope: ScopeKind; key: string }> = [];
  if (opts.habitatId != null) conditions.push({ scope: 'habitat', key: String(opts.habitatId) });
  if (opts.platformKey) conditions.push({ scope: 'platform', key: opts.platformKey });
  if (opts.technologyKey) conditions.push({ scope: 'engine', key: opts.technologyKey });
  if (conditions.length === 0) return {};

  // OR mỗi (scope_kind, scope_key) pair + page_kind chung.
  const rows = await db.execute(sql`
    SELECT scope_kind, scope_key, field_name, spec, source, updated_at
    FROM selector_overrides
    WHERE tenant_id = ${TENANT}
      AND page_kind = ${opts.pageKind}
      AND (
        ${sql.join(
          conditions.map((c) => sql`(scope_kind = ${c.scope} AND scope_key = ${c.key})`),
          sql` OR `,
        )}
      )
  `);

  const out: ResolvedMap = {};
  for (const r of rows as unknown as Array<{
    scope_kind: ScopeKind; scope_key: string; field_name: string;
    spec: SelectorSpec; source: 'llm' | 'manual' | 'promoted'; updated_at: Date | string;
  }>) {
    const existing = out[r.field_name];
    const newPri = SCOPE_PRIORITY[r.scope_kind] ?? 0;
    const oldPri = existing ? SCOPE_PRIORITY[existing.source.scope] ?? 0 : -1;
    if (newPri > oldPri) {
      out[r.field_name] = {
        spec: r.spec,
        source: {
          scope: r.scope_kind,
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
}): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  if (!opts.spec.css) return { ok: false, error: 'spec.css required' };
  try {
    await db.execute(sql`
      INSERT INTO selector_overrides
        (tenant_id, scope_kind, scope_key, page_kind, field_name, spec, source, updated_at)
      VALUES (${TENANT}, ${opts.scopeKind}, ${opts.scopeKey}, ${opts.pageKind},
              ${opts.fieldName}, ${JSON.stringify(opts.spec)}::jsonb,
              ${opts.source ?? 'manual'}, NOW())
      ON CONFLICT (tenant_id, scope_kind, scope_key, page_kind, field_name)
      DO UPDATE SET spec = EXCLUDED.spec, source = EXCLUDED.source, updated_at = NOW()
    `);
    revalidatePath('/platforms');
    return { ok: true };
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
  const source = opts.source ?? 'llm';
  let saved = 0;
  let skipped = 0;
  try {
    for (const [field, spec] of Object.entries(opts.selectors)) {
      if (!spec?.css) continue;
      // Skip nếu LLM cố ghi đè spec đã có source='manual'.
      // ON CONFLICT WHERE clause: chỉ update khi current source != 'manual'
      // OR new source IS 'manual' (manual luôn được set).
      const res = await db.execute(sql`
        INSERT INTO selector_overrides
          (tenant_id, scope_kind, scope_key, page_kind, field_name, spec, source, updated_at)
        VALUES (${TENANT}, ${opts.scopeKind}, ${opts.scopeKey}, ${opts.pageKind},
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
    eq(selectorOverrides.scopeKind, opts.scopeKind),
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
      eq(selectorOverrides.scopeKind, opts.fromScope),
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
      eq(selectorOverrides.scopeKind, opts.scopeKind),
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
