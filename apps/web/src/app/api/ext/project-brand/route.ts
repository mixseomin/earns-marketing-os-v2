import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, projects } from '@mos2/db';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { resolveProjectViaTask, listLiveTasks } from '@/lib/resolve-project-via-task';

export const dynamic = 'force-dynamic';

// Brand/context fields drive bài GỐC (ai-post) khi không có habitat + là SCOPE value cho field trên
// LAUNCH page (Name/Tagline/Description/Website/tags). GET đọc để diff (no-silent-override). POST ghi.
// projectId có thể resolve qua TASK account (account cá nhân launch nhiều SP) — dùng chung resolveProjectViaTask.
const FIELDS = ['name', 'persona', 'bio', 'oneLiner', 'hashtags', 'website', 'contentStrategy'] as const;
type Field = typeof FIELDS[number];

export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const sp = new URL(req.url).searchParams;
  const accountId = sp.get('accountId') ? Number(sp.get('accountId')) : null;
  const platform = (sp.get('platform') ?? '').trim();
  const { projectId, taskTitle, via, accountType } = await resolveProjectViaTask(db, {
    homeProjectId: (sp.get('projectId') ?? '').trim(),
    accountId,
    launchName: (sp.get('launchName') ?? '').trim(),
    platform,
    pinnedProjectId: (sp.get('pinnedProjectId') ?? '').trim(),
    launchPage: sp.get('launchPage') === '1',
    host: (sp.get('host') ?? '').trim(),
    pinForce: sp.get('pinForce') === '1',
  });
  // Task ứng viên cho task-picker ở pill (pick = ghim project của task; task chưa gán acc → gán acc này).
  const tasks = await listLiveTasks(db, { accountId, platform, host: (sp.get('host') ?? '').trim(), projectId: projectId || (sp.get('pinnedProjectId') ?? '').trim() || (sp.get('projectId') ?? '').trim() });
  // personal/seeding chưa pin/không task → không neo brand: trả preview để ext hiện "cần chọn project" (ko 400).
  if (!projectId) return NextResponse.json({ ok: true, project: null, projectId: '', taskTitle, via, accountType, tasks });
  const [p] = await db
    .select({ id: projects.id, name: projects.name, emoji: projects.emoji, persona: projects.persona, bio: projects.bio, oneLiner: projects.oneLiner, hashtags: projects.hashtags, website: projects.website, contentStrategy: projects.contentStrategy })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return errorResponse('project not found', 404);
  return NextResponse.json({ ok: true, project: p, projectId, taskTitle, via, accountType, tasks });
}

export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json()) as { projectId?: string; accountId?: number; launchName?: string; platform?: string; pinnedProjectId?: string; launchPage?: boolean; host?: string; pinForce?: boolean } & Partial<Record<Field, string>>;
  const { projectId, taskTitle } = await resolveProjectViaTask(db, {
    homeProjectId: (body.projectId ?? '').trim(), accountId: body.accountId ?? null, launchName: (body.launchName ?? '').trim(), platform: (body.platform ?? '').trim(), pinnedProjectId: (body.pinnedProjectId ?? '').trim(), launchPage: !!body.launchPage, host: (body.host ?? '').trim(), pinForce: !!body.pinForce,
  });
  if (!projectId) return errorResponse('projectId required', 400);
  const patch: Record<string, string> = {};
  for (const f of FIELDS) { if (typeof body[f] === 'string') patch[f] = body[f] as string; }
  if (!Object.keys(patch).length) return errorResponse('no fields', 400);
  await db.update(projects).set(patch).where(eq(projects.id, projectId));
  return NextResponse.json({ ok: true, projectId, taskTitle, updated: Object.keys(patch) });
}
