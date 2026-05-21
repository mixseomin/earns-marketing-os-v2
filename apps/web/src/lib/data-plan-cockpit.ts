// Data layer for Plan Cockpit. Server-side reads via raw SQL (db.execute).
// All queries snake_case → mapped to camelCase here.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export interface PlanRow {
  id: number;
  slug: string;
  name: string;
  status: string;
  niche: string | null;
  targetMrrUsd: number;
  currentMrrUsd: number;
  description: string | null;
  startedAt: string | null;
  targetDate: string | null;
  projectId: string | null;
}

export interface ProjectBrandRow {
  id: string;
  name: string;
  emoji: string;
  color: string;
  modeId: string;
  website: string;
  oneLiner: string;
  bio: string;
  persona: string;
  hashtags: string;
  revenue: string;
  kpi: string;
  alerts: number;
  health: number;
}

export interface PlatformAccountRow {
  id: number;
  platformKey: string;
  handle: string;
  status: string;
  url: string | null;
}

export interface GoalRow {
  id: number;
  parentGoalId: number | null;
  name: string;
  description: string | null;
  targetValue: number | null;
  targetUnit: string | null;
  currentValue: number;
  deadline: string | null;
  status: string;
  orderIndex: number;
}

export interface StepRow {
  id: number;
  goalId: number;
  name: string;
  description: string | null;
  channel: string | null;
  channelTarget: string | null;
  dueDate: string | null;
  owner: string | null;
  status: string;
  targetMetric: Record<string, unknown>;
  actualMetric: Record<string, unknown>;
  draftContent: string | null;
  evidenceUrl: string | null;
  notes: string | null;
  orderIndex: number;
  aiGenerated: boolean;
  timeEstimate: string | null;
  cadence: string | null;
}

export interface RiskRow {
  id: number;
  goalId: number | null;
  name: string;
  probability: string;
  impact: string;
  mitigation: string | null;
  status: string;
}

export interface AiContextRow {
  snapshot: Record<string, unknown>;
  refreshedAt: string;
  aiBrief: string | null;
}

export interface ActivityLogRow {
  id: number;
  entityType: string;
  entityId: number | null;
  action: string;
  payload: Record<string, unknown>;
  actor: string;
  createdAt: string;
}

export async function getPlanBySlug(slug: string): Promise<PlanRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = (await db.execute(sql`
    SELECT id, slug, name, status, niche, target_mrr_usd, current_mrr_usd, description,
           to_char(started_at, 'YYYY-MM-DD') AS started_at,
           to_char(target_date, 'YYYY-MM-DD') AS target_date,
           project_id
    FROM plans WHERE tenant_id = ${TENANT} AND slug = ${slug} LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    status: String(r.status),
    niche: r.niche as string | null,
    targetMrrUsd: Number(r.target_mrr_usd),
    currentMrrUsd: Number(r.current_mrr_usd),
    description: r.description as string | null,
    startedAt: r.started_at as string | null,
    targetDate: r.target_date as string | null,
    projectId: r.project_id as string | null,
  };
}

export async function getProjectBrand(projectId: string): Promise<ProjectBrandRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = (await db.execute(sql`
    SELECT id, name, emoji, color, mode_id, website, one_liner, bio, persona, hashtags,
           revenue, kpi, alerts, health
    FROM projects WHERE id = ${projectId} AND tenant_id = ${TENANT} LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0];
  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    emoji: String(r.emoji),
    color: String(r.color),
    modeId: String(r.mode_id),
    website: String(r.website || ''),
    oneLiner: String(r.one_liner || ''),
    bio: String(r.bio || ''),
    persona: String(r.persona || ''),
    hashtags: String(r.hashtags || ''),
    revenue: String(r.revenue || ''),
    kpi: String(r.kpi || ''),
    alerts: Number(r.alerts || 0),
    health: Number(r.health || 0),
  };
}

export async function listAccountsForProject(projectId: string): Promise<PlatformAccountRow[]> {
  const db = getDb();
  if (!db) return [];
  // platform_accounts now multi-brand via project_accounts pivot (migration 0037)
  const rows = (await db.execute(sql`
    SELECT pa.id, pa.platform_key, pa.handle, pa.status, NULL::text AS url
    FROM platform_accounts pa
    JOIN project_accounts pjacc ON pjacc.account_id = pa.id
    WHERE pjacc.project_id = ${projectId} AND pa.tenant_id = ${TENANT}
    ORDER BY pa.platform_key, pa.handle
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    platformKey: String(r.platform_key),
    handle: String(r.handle),
    status: String(r.status),
    url: r.url as string | null,
  }));
}

export async function listGoalsByPlan(planId: number): Promise<GoalRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT id, parent_goal_id, name, description, target_value, target_unit, current_value,
           to_char(deadline, 'YYYY-MM-DD') AS deadline, status, order_index
    FROM plan_goals WHERE plan_id = ${planId}
    ORDER BY order_index ASC, id ASC
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    parentGoalId: r.parent_goal_id == null ? null : Number(r.parent_goal_id),
    name: String(r.name),
    description: r.description as string | null,
    targetValue: r.target_value == null ? null : Number(r.target_value),
    targetUnit: r.target_unit as string | null,
    currentValue: Number(r.current_value),
    deadline: r.deadline as string | null,
    status: String(r.status),
    orderIndex: Number(r.order_index),
  }));
}

export async function listStepsByPlan(planId: number): Promise<StepRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT s.id, s.goal_id, s.name, s.description, s.channel, s.channel_target,
           to_char(s.due_date, 'YYYY-MM-DD') AS due_date,
           s.owner, s.status, s.target_metric, s.actual_metric, s.draft_content,
           s.evidence_url, s.notes, s.order_index, s.ai_generated,
           s.time_estimate, s.cadence
    FROM plan_steps s
    JOIN plan_goals g ON g.id = s.goal_id
    WHERE g.plan_id = ${planId}
    ORDER BY s.order_index ASC, s.id ASC
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    goalId: Number(r.goal_id),
    name: String(r.name),
    description: r.description as string | null,
    channel: r.channel as string | null,
    channelTarget: r.channel_target as string | null,
    dueDate: r.due_date as string | null,
    owner: r.owner as string | null,
    status: String(r.status),
    targetMetric: (r.target_metric as Record<string, unknown>) || {},
    actualMetric: (r.actual_metric as Record<string, unknown>) || {},
    draftContent: r.draft_content as string | null,
    evidenceUrl: r.evidence_url as string | null,
    notes: r.notes as string | null,
    orderIndex: Number(r.order_index),
    aiGenerated: Boolean(r.ai_generated),
    timeEstimate: r.time_estimate as string | null,
    cadence: r.cadence as string | null,
  }));
}

export async function listRisksByPlan(planId: number): Promise<RiskRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT id, goal_id, name, probability, impact, mitigation, status
    FROM plan_risks WHERE plan_id = ${planId}
    ORDER BY id ASC
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    goalId: r.goal_id == null ? null : Number(r.goal_id),
    name: String(r.name),
    probability: String(r.probability),
    impact: String(r.impact),
    mitigation: r.mitigation as string | null,
    status: String(r.status),
  }));
}

export async function getAiContext(planId: number): Promise<AiContextRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = (await db.execute(sql`
    SELECT snapshot, to_char(refreshed_at, 'YYYY-MM-DD HH24:MI') AS refreshed_at, ai_brief
    FROM plan_ai_context WHERE plan_id = ${planId} LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0];
  if (!r) return null;
  return {
    snapshot: (r.snapshot as Record<string, unknown>) || {},
    refreshedAt: String(r.refreshed_at),
    aiBrief: r.ai_brief as string | null,
  };
}

export async function listRecentActivity(planId: number, limit = 10): Promise<ActivityLogRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT id, entity_type, entity_id, action, payload, actor,
           to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
    FROM plan_activity_log WHERE plan_id = ${planId}
    ORDER BY created_at DESC LIMIT ${limit}
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    entityType: String(r.entity_type),
    entityId: r.entity_id == null ? null : Number(r.entity_id),
    action: String(r.action),
    payload: (r.payload as Record<string, unknown>) || {},
    actor: String(r.actor),
    createdAt: String(r.created_at),
  }));
}

export async function listAllPlans(): Promise<PlanRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT id, slug, name, status, niche, target_mrr_usd, current_mrr_usd, description,
           to_char(started_at, 'YYYY-MM-DD') AS started_at,
           to_char(target_date, 'YYYY-MM-DD') AS target_date,
           project_id
    FROM plans WHERE tenant_id = ${TENANT} ORDER BY created_at DESC
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    status: String(r.status),
    niche: r.niche as string | null,
    targetMrrUsd: Number(r.target_mrr_usd),
    currentMrrUsd: Number(r.current_mrr_usd),
    description: r.description as string | null,
    startedAt: r.started_at as string | null,
    targetDate: r.target_date as string | null,
    projectId: r.project_id as string | null,
  }));
}
