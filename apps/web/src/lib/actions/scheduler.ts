'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import {
  listCronJobs as _listCronJobs,
  listCronRuns as _listCronRuns,
  updateCronJob as _updateCronJob,
  triggerJobNow as _triggerJobNow,
  type CronJob,
  type CronRun,
} from '@/lib/scheduler';

export interface WorkerNode {
  id: string;
  label: string | null;
  squadsFilter: string[];
  status: string;
  currentCardIds: number[];
  lastHeartbeat: string | null;
  lastCycleAt: string | null;
  lastCycleReport: Record<string, unknown>;
  startedAt: string | null;
}

export async function listWorkerNodes(): Promise<WorkerNode[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`
      SELECT id, label, squads_filter, status, current_card_ids,
             last_heartbeat, last_cycle_at, last_cycle_report, started_at
      FROM worker_nodes ORDER BY last_heartbeat DESC NULLS LAST
    `);
    const toIso = (v: unknown) => v instanceof Date ? v.toISOString() : (typeof v === 'string' ? new Date(v).toISOString() : null);
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      label: r.label as string | null,
      squadsFilter: Array.isArray(r.squads_filter) ? r.squads_filter as string[] : [],
      status: String(r.status ?? 'unknown'),
      currentCardIds: Array.isArray(r.current_card_ids) ? r.current_card_ids as number[] : [],
      lastHeartbeat: toIso(r.last_heartbeat),
      lastCycleAt: toIso(r.last_cycle_at),
      lastCycleReport: (r.last_cycle_report as Record<string, unknown>) ?? {},
      startedAt: toIso(r.started_at),
    }));
  } catch { return []; }
}

export type { CronJob, CronRun };

export async function listCronJobsAction(): Promise<CronJob[]> {
  return _listCronJobs();
}

export async function listCronRunsAction(jobId: string, limit?: number): Promise<CronRun[]> {
  return _listCronRuns(jobId, limit);
}

export async function updateCronJobAction(
  jobId: string,
  patch: { intervalMinutes?: number; enabled?: boolean },
): Promise<{ ok: boolean }> {
  const result = await _updateCronJob(jobId, patch);
  revalidatePath('/scheduler');
  return result;
}

export async function triggerJobNowAction(jobId: string): Promise<{ ok: boolean }> {
  const result = await _triggerJobNow(jobId);
  revalidatePath('/scheduler');
  return result;
}
