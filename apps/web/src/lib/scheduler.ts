// scheduler.ts — server-only module for cron job tracking.
// NOT 'use server' — imported by both route handlers and server actions.
// Server actions live in lib/actions/scheduler.ts.

import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export interface CronJob {
  id: string;
  label: string;
  description: string | null;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string;
  nextRunAt: string | null;
  lastReport: Record<string, unknown>;
}

export interface CronRun {
  id: number;
  jobId: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  status: string;
  report: Record<string, unknown>;
  errorMsg: string | null;
}

export interface JobRun {
  runId: number;
  skipped: boolean;
}

const toIso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return new Date(v).toISOString();
  return null;
};

// Called at START of each cron handler.
// Returns { skipped: true } if job is disabled or ran too recently.
// Returns { runId } to pass to finishRun() on completion.
export async function startRun(jobId: string): Promise<JobRun> {
  const db = getDb();
  if (!db) return { runId: -1, skipped: true };

  // Check job exists, enabled, and next_run_at
  const rows = await db.execute(sql`
    SELECT id, enabled, next_run_at, interval_minutes
    FROM cron_jobs
    WHERE id = ${jobId}
  `);

  const job = (rows as unknown as Array<{
    id: string;
    enabled: boolean;
    next_run_at: unknown;
    interval_minutes: number;
  }>)[0];

  if (!job || !job.enabled) return { runId: -1, skipped: true };

  // Check if too early
  const nextRunAt = job.next_run_at ? new Date(job.next_run_at as string) : null;
  if (nextRunAt && nextRunAt > new Date()) return { runId: -1, skipped: true };

  // Insert cron_run record (status='running')
  const runRows = await db.execute(sql`
    INSERT INTO cron_runs (job_id, status, started_at, report)
    VALUES (${jobId}, 'running', NOW(), '{}'::jsonb)
    RETURNING id
  `);
  const runId = Number((runRows as unknown as Array<{ id: number | string }>)[0]?.id ?? -1);

  // Update cron_jobs: set last_status='running', advance next_run_at
  await db.execute(sql`
    UPDATE cron_jobs
    SET last_status = 'running',
        last_run_at = NOW(),
        next_run_at = NOW() + (${job.interval_minutes} * INTERVAL '1 minute'),
        updated_at = NOW()
    WHERE id = ${jobId}
  `);

  return { runId, skipped: false };
}

// Called at END of each cron handler with the result.
export async function finishRun(
  runId: number,
  status: 'ok' | 'error',
  report: Record<string, unknown>,
  errorMsg?: string,
): Promise<void> {
  const db = getDb();
  if (!db || runId < 0) return;

  const reportJson = JSON.stringify(report);
  const errorVal = errorMsg ?? null;

  // Update cron_run
  await db.execute(sql`
    UPDATE cron_runs
    SET status = ${status},
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::int * 1000,
        report = ${reportJson}::jsonb,
        error_msg = ${errorVal}
    WHERE id = ${runId}
  `);

  // Update cron_jobs last_status and last_report
  await db.execute(sql`
    UPDATE cron_jobs
    SET last_status = ${status},
        last_report = ${reportJson}::jsonb,
        updated_at = NOW()
    WHERE id = (SELECT job_id FROM cron_runs WHERE id = ${runId})
  `);
}

// List all cron_jobs (for UI)
export async function listCronJobs(): Promise<CronJob[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT id, label, description, interval_minutes, enabled,
           last_run_at, last_status, next_run_at, last_report
    FROM cron_jobs
    ORDER BY id ASC
  `);

  return (rows as unknown as Array<{
    id: string;
    label: string;
    description: string | null;
    interval_minutes: number;
    enabled: boolean;
    last_run_at: unknown;
    last_status: string | null;
    next_run_at: unknown;
    last_report: Record<string, unknown> | null;
  }>).map((r) => ({
    id: r.id,
    label: r.label,
    description: r.description,
    intervalMinutes: r.interval_minutes,
    enabled: r.enabled,
    lastRunAt: toIso(r.last_run_at),
    lastStatus: r.last_status ?? 'never',
    nextRunAt: toIso(r.next_run_at),
    lastReport: r.last_report ?? {},
  }));
}

// List recent cron_runs for a specific job
export async function listCronRuns(jobId: string, limit = 20): Promise<CronRun[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT id, job_id, started_at, completed_at, duration_ms, status, report, error_msg
    FROM cron_runs
    WHERE job_id = ${jobId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as Array<{
    id: number | string;
    job_id: string;
    started_at: unknown;
    completed_at: unknown;
    duration_ms: number | null;
    status: string;
    report: Record<string, unknown> | null;
    error_msg: string | null;
  }>).map((r) => ({
    id: Number(r.id),
    jobId: r.job_id,
    startedAt: toIso(r.started_at) ?? new Date().toISOString(),
    completedAt: toIso(r.completed_at),
    durationMs: r.duration_ms,
    status: r.status,
    report: r.report ?? {},
    errorMsg: r.error_msg,
  }));
}

// Update interval and/or enabled state
export async function updateCronJob(
  jobId: string,
  patch: { intervalMinutes?: number; enabled?: boolean },
): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };

  const { intervalMinutes, enabled } = patch;

  if (intervalMinutes !== undefined && enabled !== undefined) {
    await db.execute(sql`
      UPDATE cron_jobs
      SET interval_minutes = ${intervalMinutes},
          enabled = ${enabled},
          next_run_at = CASE WHEN ${enabled} THEN NOW() ELSE next_run_at END,
          updated_at = NOW()
      WHERE id = ${jobId}
    `);
  } else if (intervalMinutes !== undefined) {
    await db.execute(sql`
      UPDATE cron_jobs
      SET interval_minutes = ${intervalMinutes},
          updated_at = NOW()
      WHERE id = ${jobId}
    `);
  } else if (enabled !== undefined) {
    await db.execute(sql`
      UPDATE cron_jobs
      SET enabled = ${enabled},
          next_run_at = CASE WHEN ${enabled} THEN NOW() ELSE next_run_at END,
          updated_at = NOW()
      WHERE id = ${jobId}
    `);
  }

  return { ok: true };
}

// Trigger a job immediately (reset next_run_at to NOW())
export async function triggerJobNow(jobId: string): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };

  await db.execute(sql`
    UPDATE cron_jobs
    SET next_run_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId}
  `);

  return { ok: true };
}
