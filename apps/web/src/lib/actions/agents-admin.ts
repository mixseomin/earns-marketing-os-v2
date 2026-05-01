'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resetBreaker, listPausedKinds } from '@/lib/circuit-breaker';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export interface AgentKindStats {
  agentKind: string;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  timedOutRuns: number;
  rejectedRuns: number;
  avgCostCents: number;
  totalCostCents: number;
  avgDurationMs: number;
  paused: boolean;
  pausedUntil: string | null;
  recentFailures: number;       // last 10 min
}

export async function listAgentKindStats(): Promise<AgentKindStats[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT
      agent_kind,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'timed_out')::int AS timed_out,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
      COALESCE(AVG(cost_usd_cents)::int, 0) AS avg_cost,
      COALESCE(SUM(cost_usd_cents)::int, 0) AS total_cost,
      COALESCE(AVG(duration_ms)::int, 0) AS avg_duration,
      COUNT(*) FILTER (WHERE status IN ('failed','timed_out') AND created_at > NOW() - INTERVAL '10 minutes')::int AS recent_failures
    FROM agent_runs
    WHERE tenant_id = ${TENANT}
      AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY agent_kind
    ORDER BY total DESC
  `);

  const paused = listPausedKinds();
  const pausedMap = new Map(paused.map((p) => [p.agentKind, p.pausedUntil]));

  return (rows as unknown as Array<{
    agent_kind: string; total: number; completed: number; failed: number;
    timed_out: number; rejected: number; avg_cost: number; total_cost: number;
    avg_duration: number; recent_failures: number;
  }>).map((r) => ({
    agentKind: r.agent_kind,
    totalRuns: r.total,
    completedRuns: r.completed,
    failedRuns: r.failed,
    timedOutRuns: r.timed_out,
    rejectedRuns: r.rejected,
    avgCostCents: r.avg_cost,
    totalCostCents: r.total_cost,
    avgDurationMs: r.avg_duration,
    paused: pausedMap.has(r.agent_kind),
    pausedUntil: pausedMap.get(r.agent_kind)?.toISOString() ?? null,
    recentFailures: r.recent_failures,
  }));
}

export interface RecentAgentRun {
  id: number;
  agentKind: string;
  agentRef: string | null;
  projectId: string | null;
  cardId: number | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  costUsdCents: number;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
}

export interface CardRunDetail {
  id: number;
  agentKind: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  costUsdCents: number;
  tokensIn: number;
  tokensOut: number;
  outputText: string;
  toolsUsed: Array<{ toolId?: string; ok?: boolean }>;
  peerReviewDecision: string | null;
  error: string | null;
  knowledgeIdsSaved: number[];     // IDs from save-knowledge tool calls
  // Inline knowledge content cho UI hiển thị mà không cần mở /resources.
  knowledgeEntries: Array<{ id: number; title: string; kind: string; content: string }>;
  // Media generated bởi image-gen tool (DALL-E etc).
  mediaEntries: Array<{ id: number; filename: string; url: string; width: number | null; height: number | null }>;
}

export async function listCardAgentRuns(projectId: string, cardRef: string): Promise<CardRunDetail[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT ar.id, ar.agent_kind, ar.status, ar.started_at, ar.completed_at, ar.duration_ms,
           ar.cost_usd_cents, ar.tokens_in, ar.tokens_out, ar.output, ar.tools_used, ar.peer_review, ar.error
    FROM agent_runs ar
    INNER JOIN cards c ON c.id = ar.card_id
    WHERE ar.tenant_id = ${TENANT} AND ar.project_id = ${projectId} AND c.card_ref = ${cardRef}
    ORDER BY ar.id DESC
    LIMIT 10
  `);

  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return new Date(v).toISOString();
    return null;
  };

  const baseRows = (rows as unknown as Array<{
    id: number; agent_kind: string; status: string;
    started_at: unknown; completed_at: unknown; duration_ms: number | null;
    cost_usd_cents: number; tokens_in: number; tokens_out: number;
    output: { text?: string; reason?: string } | null;
    tools_used: Array<{ toolId?: string; output?: { id?: number; mediaAssetId?: number }; ok?: boolean }> | null;
    peer_review: { decision?: string } | null;
    error: string | null;
  }>).map((r) => {
    const tools = r.tools_used ?? [];
    const knowledgeIds = tools
      .filter((t) => t.toolId === 'save-knowledge' && t.output && typeof t.output === 'object' && typeof t.output.id === 'number')
      .map((t) => t.output!.id!);
    const mediaIds = tools
      .filter((t) => (t.toolId === 'image-gen' || t.toolId === 'image-gen-dalle') && t.output && typeof t.output === 'object' && typeof t.output.mediaAssetId === 'number')
      .map((t) => t.output!.mediaAssetId!);
    return {
      id: r.id,
      agentKind: r.agent_kind,
      status: r.status,
      startedAt: toIso(r.started_at),
      completedAt: toIso(r.completed_at),
      durationMs: r.duration_ms,
      costUsdCents: r.cost_usd_cents,
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      outputText: r.output?.text ?? '',
      toolsUsed: tools.map((t) => ({ toolId: t.toolId, ok: t.ok })),
      peerReviewDecision: r.peer_review?.decision ?? null,
      error: r.error,
      knowledgeIdsSaved: knowledgeIds,
      knowledgeEntries: [] as Array<{ id: number; title: string; kind: string; content: string }>,
      mediaIdsSaved: mediaIds,
      mediaEntries: [] as Array<{ id: number; filename: string; url: string; width: number | null; height: number | null }>,
    };
  });

  // Fetch knowledge content cho mọi knowledge IDs đã save trong các runs.
  const allKIds = baseRows.flatMap((r) => r.knowledgeIdsSaved);
  if (allKIds.length > 0) {
    const kRows = await db.execute(sql`
      SELECT id, title, kind, content FROM knowledge_items
      WHERE id IN (${sql.raw(allKIds.map((i) => Number(i)).join(','))})
    `);
    const kMap = new Map<number, { id: number; title: string; kind: string; content: string }>();
    for (const k of (kRows as unknown as Array<{ id: number | string; title: string; kind: string; content: string }>)) {
      kMap.set(Number(k.id), { id: Number(k.id), title: k.title, kind: k.kind, content: k.content });
    }
    for (const run of baseRows) {
      run.knowledgeEntries = run.knowledgeIdsSaved
        .map((id) => kMap.get(Number(id)))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    }
  }

  // Fetch media assets generated bởi image-gen tool.
  const allMIds = baseRows.flatMap((r) => r.mediaIdsSaved);
  if (allMIds.length > 0) {
    const mRows = await db.execute(sql`
      SELECT id, filename, url, width, height FROM media_assets
      WHERE id IN (${sql.raw(allMIds.map((i) => Number(i)).join(','))})
    `);
    const mMap = new Map<number, { id: number; filename: string; url: string; width: number | null; height: number | null }>();
    for (const m of (mRows as unknown as Array<{ id: number | string; filename: string; url: string; width: number | null; height: number | null }>)) {
      mMap.set(Number(m.id), { id: Number(m.id), filename: m.filename, url: m.url, width: m.width, height: m.height });
    }
    for (const run of baseRows) {
      run.mediaEntries = run.mediaIdsSaved
        .map((id) => mMap.get(Number(id)))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    }
  }

  // Strip mediaIdsSaved from final return (internal only).
  return baseRows.map(({ mediaIdsSaved: _, ...rest }) => rest as CardRunDetail);
}

export async function listRecentAgentRuns(limit = 50): Promise<RecentAgentRun[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT id, agent_kind, agent_ref, project_id, card_id, status,
           started_at, completed_at, duration_ms, cost_usd_cents,
           tokens_in, tokens_out, error
    FROM agent_runs
    WHERE tenant_id = ${TENANT}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  // db.execute() raw queries trả timestamps as ISO strings, KHÔNG phải Date.
  // Fix: convert qua new Date() rồi toISOString để safe (handle both string + Date).
  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return new Date(v).toISOString();
    return null;
  };
  return (rows as unknown as Array<{
    id: number; agent_kind: string; agent_ref: string | null;
    project_id: string | null; card_id: number | null; status: string;
    started_at: unknown; completed_at: unknown; duration_ms: number | null;
    cost_usd_cents: number; tokens_in: number; tokens_out: number; error: string | null;
  }>).map((r) => ({
    id: r.id, agentKind: r.agent_kind, agentRef: r.agent_ref,
    projectId: r.project_id, cardId: r.card_id, status: r.status,
    startedAt: toIso(r.started_at),
    completedAt: toIso(r.completed_at),
    durationMs: r.duration_ms, costUsdCents: r.cost_usd_cents,
    tokensIn: r.tokens_in, tokensOut: r.tokens_out, error: r.error,
  }));
}

export interface ReasoningSquad {
  projectId: string;
  projectName: string;
  squadKey: string;
  squadName: string;
  model: string | null;
  trustLevel: number | null;
  toolsCount: number;
  useAgentLoop: boolean;       // active state
  hasConfig: boolean;          // any of: tools, skillsMd, systemPrompt, useAgentLoop touched
}

// List ALL squads có agent runtime config (tools/skills/prompt set HOẶC useAgentLoop=true).
// Show cả active + paused để admin có overview, không bị mất list khi pause-all.
export async function listReasoningSquads(): Promise<ReasoningSquad[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT s.project_id, p.name AS project_name, s.squad_key, s.name AS squad_name,
           s.config->>'model' AS model,
           (s.config->>'trustLevel')::int AS trust_level,
           jsonb_array_length(COALESCE(s.config->'tools', '[]'::jsonb))::int AS tools_count,
           COALESCE(s.config->>'useAgentLoop', 'false')::boolean AS use_agent_loop
    FROM squads s
    LEFT JOIN projects p ON p.id = s.project_id
    WHERE s.tenant_id = ${TENANT}
      AND (
        COALESCE(s.config->>'useAgentLoop', 'false') = 'true'
        OR jsonb_array_length(COALESCE(s.config->'tools', '[]'::jsonb)) > 0
        OR COALESCE(s.config->>'skillsMd', '') != ''
        OR COALESCE(s.config->>'systemPrompt', '') != ''
      )
    ORDER BY (COALESCE(s.config->>'useAgentLoop', 'false') = 'true') DESC,
             p.name, s.squad_key
  `);
  return (rows as unknown as Array<{
    project_id: string; project_name: string | null;
    squad_key: string; squad_name: string;
    model: string | null; trust_level: number | null; tools_count: number;
    use_agent_loop: boolean;
  }>).map((r) => ({
    projectId: r.project_id, projectName: r.project_name ?? r.project_id,
    squadKey: r.squad_key, squadName: r.squad_name,
    model: r.model, trustLevel: r.trust_level, toolsCount: r.tools_count,
    useAgentLoop: r.use_agent_loop,
    hasConfig: true,
  }));
}

// Toggle individual squad reasoning ON/OFF without affecting other squads.
// Khác setSoloReasoningSquad: chỉ đổi 1 squad.
export async function toggleSquadReasoning(projectId: string, squadKey: string, enable: boolean): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE squads
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{useAgentLoop}', ${enable ? 'true' : 'false'}::jsonb, true),
        updated_at = NOW()
    WHERE tenant_id = ${TENANT} AND project_id = ${projectId} AND squad_key = ${squadKey}
  `);
  revalidatePath('/agents');
  return { ok: true };
}

// Reset breaker for an agent_kind (clears in-memory pause).
export async function resetAgentBreaker(agentKind: string): Promise<{ ok: boolean }> {
  resetBreaker(agentKind);
  revalidatePath('/agents');
  return { ok: true };
}

export interface SystemFlags {
  killSwitchActive: boolean;
  cronSecretConfigured: boolean;
  agentTokenConfigured: boolean;
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
  workerHint: string;
}

// Solo-mode: activate exactly 1 squad's reasoning loop, pause everything else.
// Mục đích: pilot/test environment — đảm bảo chỉ 1 path đang chạy thật.
// Pass projectId='' + squadKey='' để PAUSE TẤT CẢ.
export async function setSoloReasoningSquad(projectId: string, squadKey: string): Promise<{ ok: boolean; activated: number; paused: number }> {
  const db = getDb();
  if (!db) return { ok: false, activated: 0, paused: 0 };
  const target = projectId && squadKey ? { projectId, squadKey } : null;

  // Pause all squads
  const pausedRows = await db.execute(sql`
    UPDATE squads
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{useAgentLoop}', 'false'::jsonb, true),
        updated_at = NOW()
    WHERE tenant_id = ${TENANT}
      AND COALESCE(config->>'useAgentLoop', 'false') = 'true'
      ${target ? sql`AND NOT (project_id = ${target.projectId} AND squad_key = ${target.squadKey})` : sql``}
    RETURNING id
  `);
  const paused = (pausedRows as unknown as Array<{ id: number }>).length;

  let activated = 0;
  if (target) {
    const actRows = await db.execute(sql`
      UPDATE squads
      SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{useAgentLoop}', 'true'::jsonb, true),
          updated_at = NOW()
      WHERE tenant_id = ${TENANT}
        AND project_id = ${target.projectId}
        AND squad_key = ${target.squadKey}
      RETURNING id
    `);
    activated = (actRows as unknown as Array<{ id: number }>).length;
  }

  revalidatePath('/agents');
  // Also revalidate squads pages of affected projects.
  return { ok: true, activated, paused };
}

// Delete 1 agent_run, optional cascade vào knowledge_items.
// alsoDeleteKnowledge=true → DELETE knowledge_items WHERE imported_from
// match 'agent-run-{id}' OR 'agent-run-{id}-fallback'.
export async function deleteAgentRun(
  runId: number, alsoDeleteKnowledge: boolean,
): Promise<{ ok: boolean; deletedKnowledge: number }> {
  const db = getDb();
  if (!db) return { ok: false, deletedKnowledge: 0 };
  let deletedKnowledge = 0;
  if (alsoDeleteKnowledge) {
    const kRows = await db.execute(sql`
      DELETE FROM knowledge_items
      WHERE tenant_id = ${TENANT}
        AND (imported_from = ${`agent-run-${runId}`} OR imported_from = ${`agent-run-${runId}-fallback`})
      RETURNING id
    `);
    deletedKnowledge = (kRows as unknown as Array<{ id: number | string }>).length;
  }
  await db.execute(sql`DELETE FROM agent_runs WHERE id = ${runId} AND tenant_id = ${TENANT}`);
  revalidatePath('/agents');
  return { ok: true, deletedKnowledge };
}

// Preview cards mà worker NEXT cycle SẼ pick up — show user trước khi click Run.
// Filter logic giống worker.ts: dispatch_ready=true + agent_kind set + squad
// useAgentLoop=true + chưa có running/completed run với same idempotency_key.
export interface EligibleCard {
  cardId: number;
  cardRef: string;
  title: string;
  agentKind: string;
  squadKey: string;
  projectId: string;
  reasoningEnabled: boolean;     // squad.useAgentLoop
}

export async function listEligibleCards(): Promise<EligibleCard[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT c.id, c.card_ref, c.title, c.agent_kind, c.squad_key, c.project_id,
           COALESCE((s.config->>'useAgentLoop')::boolean, false) AS reasoning_enabled
    FROM cards c
    LEFT JOIN squads s ON s.project_id = c.project_id AND s.squad_key = c.squad_key
    WHERE c.tenant_id = ${TENANT}
      AND c.archived_at IS NULL
      AND c.dispatch_ready = true
      AND c.agent_kind IS NOT NULL
      AND c.agent_kind NOT IN ('claude-code', 'human')
      AND NOT EXISTS (
        SELECT 1 FROM agent_runs ar
        WHERE ar.card_id = c.id AND ar.status IN ('running', 'completed')
          AND (c.idempotency_key IS NULL OR ar.idempotency_key = c.idempotency_key)
      )
    ORDER BY c.created_at ASC
    LIMIT 20
  `);
  return (rows as unknown as Array<{
    id: number | string; card_ref: string; title: string;
    agent_kind: string; squad_key: string; project_id: string;
    reasoning_enabled: boolean;
  }>).map((r) => ({
    cardId: Number(r.id),
    cardRef: r.card_ref, title: r.title, agentKind: r.agent_kind,
    squadKey: r.squad_key, projectId: r.project_id,
    reasoningEnabled: r.reasoning_enabled,
  }));
}

// Trigger 1 worker cycle on-demand (UI button thay vì curl).
// Wraps runWorkerCycle với revalidation.
export async function triggerWorkerNow(maxCards: number = 5): Promise<{
  ok: boolean; processed: number; skipped: number; failed: number;
  details: Array<{ cardId: number; cardRef: string; status: string; runId?: number; reason?: string }>;
  startedAt: string; durationMs: number;
}> {
  const t0 = Date.now();
  const { runWorkerCycle } = await import('@/lib/worker');
  const report = await runWorkerCycle(maxCards);
  revalidatePath('/agents');
  return {
    ok: true, ...report,
    startedAt: new Date(t0).toISOString(),
    durationMs: Date.now() - t0,
  };
}

export async function getSystemFlags(): Promise<SystemFlags> {
  return {
    killSwitchActive: process.env.MOS2_KILL_SWITCH === '1',
    cronSecretConfigured: Boolean(process.env.MOS2_CRON_SECRET),
    agentTokenConfigured: Boolean(process.env.MOS2_AGENT_TOKEN),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    workerHint: 'Trigger via systemd timer: POST /api/cron/worker every 5 min với x-cron-secret header.',
  };
}
