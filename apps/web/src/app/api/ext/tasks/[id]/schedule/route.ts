import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../../../_auth';
import { setBacklinkSchedule } from '@/lib/actions/architecture';

export const dynamic = 'force-dynamic';

// POST /api/ext/tasks/[id]/schedule  { date: 'YYYY-MM-DD' | '' }
// Set/clear the FOLLOW date for a backlink task (prep_payload.site_scheduled_at[project]). Renders as
// the 🗓 follow marker on the plays calendar and is how "come back and check" (e.g. awaiting moderation
// approval) is tracked on the board. Empty date clears it. Reuses setBacklinkSchedule (same as drawer).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { date?: string };
  const date = String(body.date ?? '').trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: 'date must be YYYY-MM-DD or empty' }, { status: 400 });

  const rows = await db.execute(sql`SELECT project_id FROM human_tasks WHERE id = ${taskId} AND platform_key = 'backlink' LIMIT 1`);
  const t = (rows as unknown as Array<{ project_id: string }>)[0];
  if (!t) return NextResponse.json({ ok: false, error: 'not a backlink task' }, { status: 404 });

  const r = await setBacklinkSchedule(taskId, String(t.project_id), date);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || 'lỗi' }, { status: 500 });
  return NextResponse.json({ ok: true, followDate: date || null });
}
