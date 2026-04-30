// Server-only helper: get last-viewed project (set client-side bởi AppShell).
// Portfolio routes (/library, /ai-log, /roadmap, /tests, /settings/api) dùng để
// giữ Sidebar context khi user navigate giữa các shared pages.

import { cookies } from 'next/headers';
import { getProject } from './data';
import type { Project } from './mock/types';

export async function getLastProject(): Promise<Project | undefined> {
  const c = await cookies();
  const id = c.get('mos2_last_project_id')?.value;
  if (!id) return undefined;
  return getProject(id);
}
