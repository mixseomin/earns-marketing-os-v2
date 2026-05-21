'use server';

// Server actions for Plan Cockpit inline editing + AI stubs.
// All mutations write activity log entry. AI stubs return placeholder text;
// real Anthropic call wired in Phase 3 (post-MVP).

import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

async function logActivity(planId: number, entityType: string, entityId: number | null, action: string, payload: Record<string, unknown>, actor = 'user') {
  const db = getDb();
  if (!db) return;
  await db.execute(sql`
    INSERT INTO plan_activity_log (plan_id, entity_type, entity_id, action, payload, actor)
    VALUES (${planId}, ${entityType}, ${entityId}, ${action}, ${JSON.stringify(payload)}::jsonb, ${actor})
  `);
}

interface PlanCtx { planId: number; projectId: string | null; slug: string }

async function planCtxForStep(stepId: number): Promise<PlanCtx | null> {
  const db = getDb();
  if (!db) return null;
  const r = (await db.execute(sql`
    SELECT p.id AS plan_id, p.project_id, p.slug
    FROM plan_steps s JOIN plan_goals g ON g.id = s.goal_id JOIN plans p ON p.id = g.plan_id
    WHERE s.id = ${stepId}
  `)) as unknown as Array<{ plan_id: string | number; project_id: string | null; slug: string }>;
  const first = r[0];
  return first ? { planId: Number(first.plan_id), projectId: first.project_id, slug: first.slug } : null;
}

async function planCtxForGoal(goalId: number): Promise<PlanCtx | null> {
  const db = getDb();
  if (!db) return null;
  const r = (await db.execute(sql`
    SELECT p.id AS plan_id, p.project_id, p.slug FROM plan_goals g JOIN plans p ON p.id = g.plan_id WHERE g.id = ${goalId}
  `)) as unknown as Array<{ plan_id: string | number; project_id: string | null; slug: string }>;
  const first = r[0];
  return first ? { planId: Number(first.plan_id), projectId: first.project_id, slug: first.slug } : null;
}

function actorOf(meId: number | null | undefined): string {
  return meId == null ? 'user' : String(meId);
}

function revalidatePlanPaths(ctx: PlanCtx | null, planSlug?: string) {
  const slug = ctx?.slug || planSlug;
  if (!slug) return;
  if (ctx?.projectId) revalidatePath(`/p/${ctx.projectId}/plans/${slug}`);
}

export async function updateStepStatus(stepId: number, status: string, planSlug: string) {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not configured' };
  const me = await getCurrentUser();
  await db.execute(sql`UPDATE plan_steps SET status = ${status}, updated_at = NOW() WHERE id = ${stepId}`);
  const ctx = await planCtxForStep(stepId);
  if (ctx) await logActivity(ctx.planId, 'step', stepId, 'status_changed', { to: status }, actorOf(me?.id));
  revalidatePlanPaths(ctx, planSlug);
  return { ok: true };
}

export async function updateStepField(
  stepId: number,
  field: 'name' | 'description' | 'channel' | 'channel_target' | 'due_date' | 'owner' | 'draft_content' | 'evidence_url' | 'notes' | 'time_estimate' | 'cadence',
  value: string | null,
  planSlug: string,
) {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not configured' };
  const me = await getCurrentUser();
  // Map allowed field → SQL column (whitelist to avoid injection)
  const colMap: Record<string, string> = {
    name: 'name', description: 'description', channel: 'channel', channel_target: 'channel_target',
    due_date: 'due_date', owner: 'owner', draft_content: 'draft_content', evidence_url: 'evidence_url', notes: 'notes',
    time_estimate: 'time_estimate', cadence: 'cadence',
  };
  const col = colMap[field];
  if (!col) return { ok: false, error: 'Invalid field' };
  // Use raw SQL with column name interpolated (already whitelisted)
  await db.execute(sql.raw(`UPDATE plan_steps SET ${col} = ${value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`}, updated_at = NOW() WHERE id = ${stepId}`));
  const ctx = await planCtxForStep(stepId);
  if (ctx) await logActivity(ctx.planId, 'step', stepId, 'updated', { field, value }, actorOf(me?.id));
  revalidatePlanPaths(ctx, planSlug);
  return { ok: true };
}

export async function updateGoalStatus(goalId: number, status: string, planSlug: string) {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not configured' };
  const me = await getCurrentUser();
  await db.execute(sql`UPDATE plan_goals SET status = ${status}, updated_at = NOW() WHERE id = ${goalId}`);
  const ctx = await planCtxForGoal(goalId);
  if (ctx) await logActivity(ctx.planId, 'goal', goalId, 'status_changed', { to: status }, actorOf(me?.id));
  revalidatePlanPaths(ctx, planSlug);
  return { ok: true };
}

export async function updateGoalProgress(goalId: number, currentValue: number, planSlug: string) {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not configured' };
  await db.execute(sql`UPDATE plan_goals SET current_value = ${currentValue}, updated_at = NOW() WHERE id = ${goalId}`);
  const ctx = await planCtxForGoal(goalId);
  if (ctx) await logActivity(ctx.planId, 'goal', goalId, 'updated', { current_value: currentValue });
  revalidatePlanPaths(ctx, planSlug);
  return { ok: true };
}

// ── AI stubs (Phase 3 will wire real Claude API) ────────────────

export async function aiGenerateStepDraft(stepId: number, planSlug: string): Promise<{ ok: boolean; draft?: string; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not configured' };
  const r = (await db.execute(sql`SELECT name, channel, channel_target, notes FROM plan_steps WHERE id = ${stepId}`)) as unknown as Array<Record<string, unknown>>;
  const step = r[0];
  if (!step) return { ok: false, error: 'Step not found' };
  // STUB: real impl will call Claude with subreddit rules + recent top posts + value prop
  const draft = `[AI STUB - to be wired]\n\nDraft for: ${step.name}\nChannel: ${step.channel || 'unspecified'} ${step.channel_target ? `(${step.channel_target})` : ''}\n\nWhen wired, this will:\n- Pull subreddit rules / channel best practices\n- Generate post draft following community norms\n- Apply human-voice writing skill (no AI patterns)\n- Cache in plan_step_fields with ai_generated_at timestamp\n\n${step.notes ? `Notes considered: ${step.notes}` : ''}`;
  await db.execute(sql`UPDATE plan_steps SET draft_content = ${draft}, ai_generated = true, updated_at = NOW() WHERE id = ${stepId}`);
  const ctx = await planCtxForStep(stepId);
  if (ctx) await logActivity(ctx.planId, 'step', stepId, 'ai_suggested', { kind: 'draft' }, 'ai');
  revalidatePlanPaths(ctx, planSlug);
  return { ok: true, draft };
}

export async function aiSuggestNextSteps(goalId: number, planSlug: string): Promise<{ ok: boolean; suggestions?: string[]; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not configured' };
  const ctx = await planCtxForGoal(goalId);
  if (ctx) await logActivity(ctx.planId, 'goal', goalId, 'ai_suggested', { kind: 'next_steps' }, 'ai');
  void planSlug;
  // STUB
  return {
    ok: true,
    suggestions: [
      '[AI STUB] Will analyze goal context + plan history + niche memory',
      '[AI STUB] Returns 3 prioritized next steps with channel + target metric',
      '[AI STUB] User clicks Accept → step inserted with order_index = max+1',
    ],
  };
}

export async function aiDailyBrief(planId: number): Promise<{ ok: boolean; brief?: string; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not configured' };
  // STUB
  const brief = `[AI STUB] Morning brief generator.\nWhen wired:\n- Reads last 7d activity log\n- Compares actuals vs targets\n- Surfaces 3 priority actions for today\n- Posts to Discord/email if configured`;
  await db.execute(sql`UPDATE plan_ai_context SET ai_brief = ${brief}, ai_brief_at = NOW() WHERE plan_id = ${planId}`);
  return { ok: true, brief };
}
