'use server';

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

const toIso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return new Date(v).toISOString();
  return null;
};

// Derive icon from squad_key
function iconFromKey(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('planner') || k.includes('orchestrat')) return '🧭';
  if (k.includes('writer') || k.includes('content')) return '✍️';
  if (k.includes('designer') || k.includes('creative')) return '🎨';
  if (k.includes('publisher') || k.includes('publish')) return '📤';
  if (k.includes('research')) return '🔍';
  if (k.includes('analytics') || k.includes('analyse')) return '📊';
  if (k.includes('community')) return '💬';
  if (k.includes('monitor')) return '📡';
  if (k.includes('inbox')) return '📥';
  return '🤖';
}

// Derive color from trust level
function colorFromTrust(level: number | null): string {
  switch (level) {
    case 1: return 'var(--neon-lime)';
    case 2: return 'var(--neon-cyan)';
    case 3: return 'var(--neon-amber)';
    case 4: return 'var(--neon-violet)';
    default: return 'var(--fg-3)';
  }
}

// Format squad_key → readable name fallback
function formatKey(key: string): string {
  return key
    .replace(/^wf-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FlowSquad {
  squadKey: string;
  name: string;
  icon: string;
  color: string;
  trustLevel: number;
  model: string;
  useAgentLoop: boolean;
  activeCards: number;
  totalWorkflowCards: number;
  lastActiveAt: string | null;
}

export interface FlowData {
  squads: FlowSquad[];
  inboxPending: number;
  inboxClaimed: number;
  publicationsActive: number;
  publicationsPendingReplies: number;
  knowledgeCount: number;
}

export async function getFlowData(projectId: string): Promise<FlowData> {
  const db = getDb();
  if (!db) {
    return {
      squads: [],
      inboxPending: 0,
      inboxClaimed: 0,
      publicationsActive: 0,
      publicationsPendingReplies: 0,
      knowledgeCount: 0,
    };
  }

  const [squadRows, activeCardRows, workflowCardRows, inboxRows, pubRows, knowledgeRows, lastRunRows] =
    await Promise.all([
      // All squads for project
      db.execute(sql`
        SELECT squad_key, name AS label,
          config->>'model' AS model,
          (config->>'trustLevel')::int AS trust_level,
          COALESCE((config->>'useAgentLoop')::boolean, false) AS use_agent_loop
        FROM squads
        WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
        ORDER BY squad_key
      `),

      // Active cards: dispatch_ready=true (ready for agent pickup)
      db.execute(sql`
        SELECT squad_key, COUNT(*)::int AS cnt
        FROM cards
        WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
          AND archived_at IS NULL
          AND dispatch_ready = true
        GROUP BY squad_key
      `),

      // Workflow cards total (any card with workflow_run_id set)
      db.execute(sql`
        SELECT squad_key, COUNT(*)::int AS cnt
        FROM cards
        WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
          AND archived_at IS NULL
          AND workflow_run_id IS NOT NULL
        GROUP BY squad_key
      `),

      // Inbox: pending + in_progress counts
      db.execute(sql`
        SELECT status, COUNT(*)::int AS cnt
        FROM human_tasks
        WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
          AND status IN ('pending', 'in_progress', 'claimed')
        GROUP BY status
      `),

      // Publications: active + pending_replies
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
          COUNT(*) FILTER (WHERE reply_count > 0 AND last_checked_at < NOW() - INTERVAL '6 hours')::int AS pending_replies
        FROM publications
        WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
      `),

      // Knowledge count
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM knowledge_items
        WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
      `),

      // Most recent agent_run per squad_key for this project
      db.execute(sql`
        SELECT DISTINCT ON (c.squad_key)
          c.squad_key,
          ar.created_at AS last_active_at
        FROM agent_runs ar
        JOIN cards c ON c.id = ar.card_id
        WHERE ar.tenant_id = ${TENANT} AND ar.project_id = ${projectId}
        ORDER BY c.squad_key, ar.created_at DESC
      `),
    ]);

  // Build lookup maps
  const activeMap = new Map<string, number>();
  for (const r of activeCardRows as unknown as Array<{ squad_key: string; cnt: number }>) {
    activeMap.set(r.squad_key, r.cnt);
  }

  const wfMap = new Map<string, number>();
  for (const r of workflowCardRows as unknown as Array<{ squad_key: string; cnt: number }>) {
    wfMap.set(r.squad_key, r.cnt);
  }

  const lastRunMap = new Map<string, string | null>();
  for (const r of lastRunRows as unknown as Array<{ squad_key: string; last_active_at: unknown }>) {
    lastRunMap.set(r.squad_key, toIso(r.last_active_at));
  }

  // Inbox counts
  let inboxPending = 0;
  let inboxClaimed = 0;
  for (const r of inboxRows as unknown as Array<{ status: string; cnt: number }>) {
    if (r.status === 'pending') inboxPending += r.cnt;
    if (r.status === 'claimed' || r.status === 'in_progress') inboxClaimed += r.cnt;
  }

  // Publications
  const pubRow = (pubRows as unknown as Array<{ active_count: number; pending_replies: number }>)[0];
  const publicationsActive = pubRow?.active_count ?? 0;
  const publicationsPendingReplies = pubRow?.pending_replies ?? 0;

  // Knowledge count
  const knowledgeCount = (knowledgeRows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0;

  // Build squads
  const squads: FlowSquad[] = (squadRows as unknown as Array<{
    squad_key: string;
    label: string | null;
    model: string | null;
    trust_level: number | null;
    use_agent_loop: boolean;
  }>).map((r) => {
    const trustLevel = r.trust_level ?? 1;
    return {
      squadKey: r.squad_key,
      name: r.label?.trim() || formatKey(r.squad_key),
      icon: iconFromKey(r.squad_key),
      color: colorFromTrust(trustLevel),
      trustLevel,
      model: r.model ?? 'gpt-4o-mini',
      useAgentLoop: r.use_agent_loop,
      activeCards: activeMap.get(r.squad_key) ?? 0,
      totalWorkflowCards: wfMap.get(r.squad_key) ?? 0,
      lastActiveAt: lastRunMap.get(r.squad_key) ?? null,
    };
  });

  return {
    squads,
    inboxPending,
    inboxClaimed,
    publicationsActive,
    publicationsPendingReplies,
    knowledgeCount,
  };
}
