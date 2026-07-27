// Generic cross-project REVIEW queue. A review request = a human_tasks row with
// prep_payload.kind = 'review' (no new table — reuse the existing task queue).
// Flexible for any project: set `project` + `target*` + `screenshotUrl`.
//   POST  /api/review           create a review request
//   GET   /api/review?...       list review requests (filters: project, status, assignedTo)
// Auth: x-agent-token (machines: a project's control-plane, or the AI) OR a logged-in
// MOS2 session (staff via user.on.tc). Humans and machines both allowed.
import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function actor(req: NextRequest): Promise<{ kind: 'machine' | 'human'; name: string } | null> {
  const tok = process.env.MOS2_AGENT_TOKEN;
  if (tok && req.headers.get('x-agent-token') === tok) return { kind: 'machine', name: req.headers.get('x-agent-name') || 'agent' };
  const u = await getCurrentUser();
  if (u) return { kind: 'human', name: u.displayName || u.name || u.email };
  return null;
}

export async function POST(req: NextRequest) {
  const who = await actor(req);
  if (!who) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db not configured' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  if (!b.project || !b.title) return NextResponse.json({ ok: false, error: 'project + title required' }, { status: 400 });

  const payload = {
    kind: 'review',
    targetType: b.targetType ?? null,     // 'course-scene', 'landing-section', …
    targetRef: b.targetRef ?? {},         // { courseId, lectureId, sceneIdx } etc.
    targetUrl: b.targetUrl ?? null,       // deep link back to the thing
    dimension: b.dimension ?? null,       // content | presentation | language | …
    assignedTo: b.assignedTo === 'ai' ? 'ai' : 'human',
    reporter: who.name,
    reporterKind: who.kind,
    thread: [],
  };
  const rows = await db.execute(sql`
    INSERT INTO human_tasks (project_id, title, instructions, screenshot_url, prep_payload, status)
    VALUES (${b.project}, ${b.title}, ${b.detail ?? ''}, ${b.screenshotUrl ?? null},
            ${JSON.stringify(payload)}::jsonb, 'pending')
    RETURNING id
  `);
  const id = (rows as unknown as Array<{ id: number }>)[0]?.id;
  return NextResponse.json({ ok: true, id });
}

export async function GET(req: NextRequest) {
  const who = await actor(req);
  if (!who) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db not configured' }, { status: 503 });
  const u = new URL(req.url);
  const project = u.searchParams.get('project');
  const status = u.searchParams.get('status');            // pending | in_progress | done | rejected
  const assignedTo = u.searchParams.get('assignedTo');    // human | ai
  const limit = Math.min(Number(u.searchParams.get('limit') ?? '100'), 500);

  const rows = await db.execute(sql`
    SELECT id, project_id, title, instructions, screenshot_url, prep_payload,
           status, claimed_by, notes, verify_result, created_at, updated_at, completed_at
    FROM human_tasks
    WHERE prep_payload->>'kind' = 'review'
      ${project ? sql`AND project_id = ${project}` : sql``}
      ${status ? sql`AND status = ${status}` : sql``}
      ${assignedTo ? sql`AND prep_payload->>'assignedTo' = ${assignedTo}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return NextResponse.json({ ok: true, items: rows });
}
