'use server';

// Department view: combined snapshot of humans + AI squads, what they're doing right now.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export interface DepartmentHuman {
  kind: 'human';
  userId: number;
  email: string;
  displayName: string;
  role: string;
  specialty: string;
  active: boolean;
  lastSeen: string | null;
  pendingTasks: number;
  inProgressTasks: number;
  currentTaskTitle: string | null;
  currentTaskProjectId: string | null;
  status: 'active' | 'idle' | 'offline' | 'inactive';
}

export interface DepartmentAgent {
  kind: 'agent';
  squadId: number;
  squadKey: string;
  squadName: string;
  projectId: string;
  icon: string;
  model: string;
  trustLevel: number;
  active: boolean;
  lastRunAt: string | null;
  runningCount: number;
  pendingCardsCount: number;
  recentRunStatus: string | null;
  recentRunCardTitle: string | null;
  status: 'running' | 'queued' | 'idle' | 'paused';
}

export type DepartmentEntry = DepartmentHuman | DepartmentAgent;

export async function listDepartment(filterProjectId?: string): Promise<DepartmentEntry[]> {
  const db = getDb();
  if (!db) return [];

  // Humans
  const humanRows = await db.execute(sql`
    SELECT u.id, u.email, u.name, u.last_login_at,
           m.display_name, m.role, m.specialty, m.active,
           (SELECT COUNT(*)::int FROM human_tasks WHERE assigned_user_id = u.id AND status = 'pending') AS pending,
           (SELECT COUNT(*)::int FROM human_tasks WHERE assigned_user_id = u.id AND status IN ('claimed','in_progress')) AS in_progress,
           (SELECT title FROM human_tasks WHERE assigned_user_id = u.id AND status IN ('claimed','in_progress') ORDER BY claimed_at DESC LIMIT 1) AS current_title,
           (SELECT project_id FROM human_tasks WHERE assigned_user_id = u.id AND status IN ('claimed','in_progress') ORDER BY claimed_at DESC LIMIT 1) AS current_project
    FROM users u
    LEFT JOIN members m ON m.user_id = u.id AND m.project_id IS NULL
    WHERE u.tenant_id = ${TENANT}
    ORDER BY u.id
  `);
  const toIso = (v: unknown) => v instanceof Date ? v.toISOString() : (typeof v === 'string' ? new Date(v).toISOString() : null);
  const humans: DepartmentHuman[] = (humanRows as unknown as Array<Record<string, unknown>>).map((r) => {
    const lastSeen = toIso(r.last_login_at);
    const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Infinity;
    const inProgress = Number(r.in_progress) || 0;
    const status: DepartmentHuman['status'] =
      !r.active ? 'inactive' :
      inProgress > 0 ? 'active' :
      ageMs < 24 * 3600_000 ? 'idle' : 'offline';
    return {
      kind: 'human' as const,
      userId: Number(r.id),
      email: String(r.email),
      displayName: String(r.display_name ?? r.name ?? ''),
      role: String(r.role ?? 'viewer'),
      specialty: String(r.specialty ?? 'other'),
      active: Boolean(r.active),
      lastSeen,
      pendingTasks: Number(r.pending) || 0,
      inProgressTasks: inProgress,
      currentTaskTitle: (r.current_title as string | null) ?? null,
      currentTaskProjectId: (r.current_project as string | null) ?? null,
      status,
    };
  });

  // AI squads (filter by project if provided)
  const agentRows = await db.execute(sql`
    SELECT s.id, s.squad_key, s.name, s.project_id, s.icon,
           s.config->>'model' AS model,
           (s.config->>'trustLevel')::int AS trust_level,
           COALESCE((s.config->>'useAgentLoop')::boolean, false) AS active_loop,
           (SELECT MAX(ar.created_at) FROM agent_runs ar JOIN cards c ON c.id = ar.card_id WHERE c.squad_key = s.squad_key AND c.project_id = s.project_id) AS last_run_at,
           (SELECT COUNT(*)::int FROM agent_runs ar JOIN cards c ON c.id = ar.card_id WHERE c.squad_key = s.squad_key AND c.project_id = s.project_id AND ar.status = 'running') AS running_count,
           (SELECT COUNT(*)::int FROM cards WHERE squad_key = s.squad_key AND project_id = s.project_id AND dispatch_ready = true AND archived_at IS NULL) AS pending_cards,
           (SELECT ar.status FROM agent_runs ar JOIN cards c ON c.id = ar.card_id WHERE c.squad_key = s.squad_key AND c.project_id = s.project_id ORDER BY ar.created_at DESC LIMIT 1) AS recent_status,
           (SELECT c.title FROM agent_runs ar JOIN cards c ON c.id = ar.card_id WHERE c.squad_key = s.squad_key AND c.project_id = s.project_id ORDER BY ar.created_at DESC LIMIT 1) AS recent_title
    FROM squads s
    WHERE s.tenant_id = ${TENANT}
    ${filterProjectId ? sql`AND s.project_id = ${filterProjectId}` : sql``}
    ORDER BY s.project_id, s.squad_key
  `);
  const agents: DepartmentAgent[] = (agentRows as unknown as Array<Record<string, unknown>>).map((r) => {
    const running = Number(r.running_count) || 0;
    const pending = Number(r.pending_cards) || 0;
    const status: DepartmentAgent['status'] =
      running > 0 ? 'running' :
      pending > 0 ? 'queued' :
      r.active_loop ? 'idle' : 'paused';
    return {
      kind: 'agent' as const,
      squadId: Number(r.id),
      squadKey: String(r.squad_key),
      squadName: String(r.name),
      projectId: String(r.project_id),
      icon: String(r.icon ?? '🤖'),
      model: String(r.model ?? 'gpt-4o-mini'),
      trustLevel: Number(r.trust_level) || 1,
      active: Boolean(r.active_loop),
      lastRunAt: toIso(r.last_run_at),
      runningCount: running,
      pendingCardsCount: pending,
      recentRunStatus: (r.recent_status as string | null) ?? null,
      recentRunCardTitle: (r.recent_title as string | null) ?? null,
      status,
    };
  });

  // Filter humans by project if provided
  const filteredHumans = filterProjectId
    ? humans.filter((h) => h.currentTaskProjectId === filterProjectId || h.pendingTasks > 0)
    : humans;

  return [...filteredHumans, ...agents];
}
