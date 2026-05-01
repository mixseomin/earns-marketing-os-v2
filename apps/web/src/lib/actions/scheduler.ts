'use server';

import { revalidatePath } from 'next/cache';
import {
  listCronJobs as _listCronJobs,
  listCronRuns as _listCronRuns,
  updateCronJob as _updateCronJob,
  triggerJobNow as _triggerJobNow,
  type CronJob,
  type CronRun,
} from '@/lib/scheduler';

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
