import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../../_auth';
import { linkTaskToOutreachCore } from '@/lib/outreach/link-task';

export const dynamic = 'force-dynamic';

// POST /api/ext/tasks/[id]/outreach
// Link a direct-contact backlink task (email the site owner/maintainer) to the outreach system:
// ensure the project's backlink campaign + a prospect (with AI pitch) carrying task_id, so status
// syncs both ways + the cron auto-sends when there's a recipient email. Returns a deep link.
// Token-authed (ext), reuse linkTaskToOutreachCore (dùng CHUNG với server-action admin).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const r = await linkTaskToOutreachCore(db, taskId);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
