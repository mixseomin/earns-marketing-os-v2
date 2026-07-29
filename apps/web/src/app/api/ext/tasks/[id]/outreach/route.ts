import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../../_auth';
import { linkTaskToOutreachCore, readProspectState } from '@/lib/outreach/link-task';

export const dynamic = 'force-dynamic';

// GET /api/ext/tasks/[id]/outreach
// Live state of the outreach prospect for this backlink task (saved pitch + status + follow-ups), so
// the ext shows the real email that will send and where it stands — no MOS2 deep-link needed.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const state = await readProspectState(db, taskId);
  return NextResponse.json({ ok: true, exists: !!state, ...(state || {}) });
}

// POST /api/ext/tasks/[id]/outreach
// Link a direct-contact backlink task (email the site owner/maintainer) to the outreach system:
// ensure the project's backlink campaign + a prospect (with AI pitch) carrying task_id, so status
// syncs both ways + the cron auto-sends when there's a recipient email. Returns the live state.
//   body {regenerate:true}      → force a fresh AI pitch (correct signer, no "[Your Name]")
//   body {save:true,subject,body} → persist the operator-edited email (survives send + reopen)
//   {} → ensure + backfill a pitch only if none yet (the "push into engine" action)
// Token-authed (ext), reuse linkTaskToOutreachCore (dùng CHUNG với server-action admin).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { regenerate?: boolean; save?: boolean; subject?: string; body?: string };
  const opts = body.save
    ? { saveSubject: String(body.subject ?? ''), saveBody: String(body.body ?? '') }
    : body.regenerate ? { regenerate: true } : undefined;
  const r = await linkTaskToOutreachCore(db, taskId, opts);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
