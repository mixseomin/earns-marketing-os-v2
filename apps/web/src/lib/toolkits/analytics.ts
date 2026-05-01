// Phase 12 — Analytics toolkit. REAL DB read functions cho squad Analytics.
// Side-effect 'read' (gate ALWAYS allow ở mọi trust level).
//
// 4 tools:
//   query-cards         — count + breakdown cards by col / status / agent_kind
//   query-agent-runs    — cost + success summary trong window
//   query-knowledge     — search title + content
//   query-platform-accounts — count by status / platform

import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { register, z } from './registry';

register({
  id: 'query-cards',
  schema: z.object({
    projectId: z.string().optional(),
    sinceHours: z.number().int().min(1).max(720).default(24),
  }),
  output: z.object({
    total: z.number(),
    byColumn: z.array(z.object({ col: z.string(), count: z.number() })),
    byAgentKind: z.array(z.object({ agentKind: z.string().nullable(), count: z.number() })),
    dispatchReady: z.number(),
  }),
  sideEffect: 'read',
  timeoutMs: 5_000,
  fn: async (input, ctx) => {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL not configured');
    const projectId = input.projectId ?? ctx.projectId;
    const sinceHours = input.sinceHours ?? 24;

    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE dispatch_ready = true)::int AS dispatch_ready,
        json_agg(DISTINCT jsonb_build_object('col', col, 'count', col_count))
          FILTER (WHERE col IS NOT NULL) AS by_col_raw
      FROM (
        SELECT col, agent_kind, dispatch_ready,
               COUNT(*) OVER (PARTITION BY col) AS col_count
        FROM cards
        WHERE tenant_id = 'self' AND archived_at IS NULL
          AND project_id = ${projectId}
          AND created_at > NOW() - (${sinceHours} || ' hours')::interval
      ) t
    `);
    const baseRow = (rows as unknown as Array<{ total: number; dispatch_ready: number; by_col_raw: Array<{ col: string; count: number }> | null }>)[0];

    // Separate by_kind query để cleaner.
    const kindRows = await db.execute(sql`
      SELECT agent_kind, COUNT(*)::int AS count
      FROM cards
      WHERE tenant_id = 'self' AND archived_at IS NULL
        AND project_id = ${projectId}
        AND created_at > NOW() - (${sinceHours} || ' hours')::interval
      GROUP BY agent_kind
      ORDER BY count DESC
    `);
    const byAgentKind = (kindRows as unknown as Array<{ agent_kind: string | null; count: number }>)
      .map((r) => ({ agentKind: r.agent_kind, count: Number(r.count) }));

    return {
      total: baseRow?.total ?? 0,
      byColumn: baseRow?.by_col_raw ?? [],
      byAgentKind,
      dispatchReady: baseRow?.dispatch_ready ?? 0,
    };
  },
});

register({
  id: 'query-agent-runs',
  schema: z.object({
    projectId: z.string().optional(),
    sinceHours: z.number().int().min(1).max(720).default(24),
    agentKind: z.string().optional(),
  }),
  output: z.object({
    totalRuns: z.number(),
    completedRuns: z.number(),
    failedRuns: z.number(),
    totalCostCents: z.number(),
    avgDurationMs: z.number(),
    totalTokensIn: z.number(),
    totalTokensOut: z.number(),
  }),
  sideEffect: 'read',
  timeoutMs: 5_000,
  fn: async (input, ctx) => {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL not configured');
    const projectId = input.projectId ?? ctx.projectId;
    const sinceHours = input.sinceHours ?? 24;

    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status IN ('failed', 'timed_out'))::int AS failed,
        COALESCE(SUM(cost_usd_cents)::int, 0) AS total_cost,
        COALESCE(AVG(duration_ms)::int, 0) AS avg_duration,
        COALESCE(SUM(tokens_in)::int, 0) AS tokens_in,
        COALESCE(SUM(tokens_out)::int, 0) AS tokens_out
      FROM agent_runs
      WHERE tenant_id = 'self'
        AND project_id = ${projectId}
        AND created_at > NOW() - (${sinceHours} || ' hours')::interval
        ${input.agentKind ? sql`AND agent_kind = ${input.agentKind}` : sql``}
    `);
    const r = (rows as unknown as Array<{
      total: number; completed: number; failed: number;
      total_cost: number; avg_duration: number;
      tokens_in: number; tokens_out: number;
    }>)[0]!;
    return {
      totalRuns: r.total,
      completedRuns: r.completed,
      failedRuns: r.failed,
      totalCostCents: r.total_cost,
      avgDurationMs: r.avg_duration,
      totalTokensIn: r.tokens_in,
      totalTokensOut: r.tokens_out,
    };
  },
});

register({
  id: 'query-knowledge',
  schema: z.object({
    projectId: z.string().optional(),
    search: z.string().optional(),
    kind: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  output: z.object({
    total: z.number(),
    items: z.array(z.object({
      id: z.number(),
      kind: z.string(),
      title: z.string(),
      tags: z.array(z.string()),
      preview: z.string(),
      updatedAt: z.string(),
    })),
  }),
  sideEffect: 'read',
  timeoutMs: 5_000,
  fn: async (input, ctx) => {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL not configured');
    const projectId = input.projectId ?? ctx.projectId;
    const limit = input.limit ?? 20;
    const rows = await db.execute(sql`
      SELECT id, kind, title, tags, content, updated_at
      FROM knowledge_items
      WHERE tenant_id = 'self'
        AND (project_id = ${projectId} OR project_id IS NULL)
        ${input.kind ? sql`AND kind = ${input.kind}` : sql``}
        ${input.search ? sql`AND (title ILIKE ${'%' + input.search + '%'} OR content ILIKE ${'%' + input.search + '%'})` : sql``}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `);
    const items = (rows as unknown as Array<{
      id: number | string; kind: string; title: string; tags: string[];
      content: string; updated_at: Date | string;
    }>).map((r) => ({
      id: Number(r.id),
      kind: r.kind,
      title: r.title,
      tags: r.tags ?? [],
      preview: (r.content ?? '').slice(0, 200),
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : r.updated_at.toISOString(),
    }));
    return { total: items.length, items };
  },
});

register({
  id: 'query-platform-accounts',
  schema: z.object({
    projectId: z.string().optional(),
  }),
  output: z.object({
    total: z.number(),
    byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
    byPlatform: z.array(z.object({ platformKey: z.string(), count: z.number() })),
  }),
  sideEffect: 'read',
  timeoutMs: 5_000,
  fn: async (input, ctx) => {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL not configured');
    const projectId = input.projectId ?? ctx.projectId;

    const stRows = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count
      FROM platform_accounts
      WHERE tenant_id = 'self' AND project_id = ${projectId}
      GROUP BY status ORDER BY count DESC
    `);
    const pfRows = await db.execute(sql`
      SELECT platform_key, COUNT(*)::int AS count
      FROM platform_accounts
      WHERE tenant_id = 'self' AND project_id = ${projectId}
      GROUP BY platform_key ORDER BY count DESC
    `);
    const byStatus = (stRows as unknown as Array<{ status: string; count: number }>).map((r) => ({ status: r.status, count: Number(r.count) }));
    const byPlatform = (pfRows as unknown as Array<{ platform_key: string; count: number }>).map((r) => ({ platformKey: r.platform_key, count: Number(r.count) }));
    return {
      total: byStatus.reduce((s, x) => s + x.count, 0),
      byStatus,
      byPlatform,
    };
  },
});

export const ANALYTICS_TOOLKIT_LOADED = true;
