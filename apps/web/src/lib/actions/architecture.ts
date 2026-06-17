'use server';

// Architecture Studio — live instance binding + consistency checks + layout persistence.
// Reads real rows so each block can be validated against the model ("phản ánh đúng").
// Identifiers come from the trusted spec allowlist (BINDABLE_TABLES); values are parameterized.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { BINDABLE_TABLES, OBJ_BY_KEY } from '@/components/architecture/spec';

type Row = Record<string, unknown>;

export interface InstanceRef { id: string; label: string }
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
export async function listInstances(objectKey: string, projectId?: string): Promise<InstanceRef[]> {
  const obj = BINDABLE_TABLES[objectKey];
  if (!obj || !obj.table) return [];
  const db = getDb();
  if (!db) return [];
  const table = ident(obj.table);
  const pk = ident(obj.pk || 'id');
  const labelCol = ident(obj.labelCol || obj.pk || 'id');
  const scoped = obj.projectScoped && projectId;
  try {
    const res = await db.execute(sql`
      SELECT ${sql.raw(pk)}::text AS id, ${sql.raw(labelCol)}::text AS label
      FROM ${sql.raw(table)}
      ${scoped ? sql`WHERE project_id = ${projectId}` : sql``}
      ORDER BY ${sql.raw(pk)} DESC
      LIMIT 300`);
    const rows = res as unknown as Array<{ id: string; label: string | null }>;
    return rows.map((r) => ({ id: r.id, label: r.label || r.id }));
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
