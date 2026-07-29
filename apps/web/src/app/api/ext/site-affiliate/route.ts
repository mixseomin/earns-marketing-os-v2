import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

// Affiliate-signup work items = outreach_prospects with source='affiliate' (a "register for this
// merchant's affiliate program" task, keyed by host in agent_name + website=signup URL). They are
// standalone (no task_id) so the task-keyed /tasks/[id]/outreach flow can't reach them. This route
// lets the Crew ext surface them per-host in-page: GET lists them, POST marks status.
// Kept as its own datastore (outreach) — no merge, just a surface (decision 2026-07-29).

const normHost = (h: string): string => {
  const first = String(h || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  return (first || '').trim().toLowerCase();
};

const iso = (v: unknown): string => (v ? new Date(v as string | number | Date).toISOString() : '');

function mapProspect(p: Record<string, unknown>) {
  return {
    id: Number(p.id),
    projectId: String(p.project_id || ''),
    campaignId: p.campaign_id != null ? Number(p.campaign_id) : null,
    company: String(p.company || ''),
    host: String(p.agent_name || ''),
    signupUrl: String(p.website || '') || String(p.contact_url || ''),
    email: String(p.email || ''),
    channel: p.email ? 'email' : 'form',
    status: String(p.status || ''),
    subject: String(p.email_subject || ''),
    body: String(p.email_body || ''),
    sentAt: iso(p.sent_at),
    repliedAt: iso(p.replied_at),
    notes: String(p.notes || ''),
  };
}

const COLS = sql`id, project_id, campaign_id, company, agent_name, website, contact_url, email, status, email_subject, email_body, sent_at, replied_at, notes`;

// GET /api/ext/site-affiliate?host=greenmangaming.com
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const host = normHost(new URL(req.url).searchParams.get('host') ?? '');
  if (!host) return NextResponse.json({ ok: true, prospects: [] });
  // agent_name holds the bare host (e.g. 'greenmangaming.com'). Match host-boundary, NOT a raw
  // substring — else host 'gaming.com' would wrongly match 'greenmangaming.com'. Strip www on both.
  const rows = (await db.execute(sql`
    SELECT ${COLS} FROM outreach_prospects
    WHERE tenant_id = 'self' AND source = 'affiliate'
      AND (regexp_replace(lower(agent_name), '^www\\.', '') = ${host}
           OR regexp_replace(lower(agent_name), '^www\\.', '') LIKE ${'%.' + host})
    ORDER BY id`)) as unknown as Array<Record<string, unknown>>;
  return NextResponse.json({ ok: true, prospects: rows.map(mapProspect) });
}

// POST /api/ext/site-affiliate  { id, action:'status', status }
// Marks where the affiliate signup stands. Status = the outreach_prospects enum used for affiliate:
// to_send (chưa đăng ký) → sent (đã nộp) → embedded (đã duyệt/joined) / declined (từ chối).
const AFF_STATUSES = ['to_send', 'sent', 'interested', 'embedded', 'replied', 'declined', 'no_response'];

export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { id?: number; action?: string; status?: string };
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const chk = (await db.execute(sql`SELECT id FROM outreach_prospects WHERE id = ${id} AND source = 'affiliate' AND tenant_id = 'self' LIMIT 1`)) as unknown as Array<{ id: number }>;
  if (!chk.length) return NextResponse.json({ ok: false, error: 'not an affiliate prospect' }, { status: 404 });

  if (body.action === 'status') {
    const status = String(body.status || '');
    if (!AFF_STATUSES.includes(status)) return NextResponse.json({ ok: false, error: 'bad status' }, { status: 400 });
    // stamp sent_at the first time it's marked as submitted, so "đã nộp N ngày" is meaningful.
    if (status === 'sent') await db.execute(sql`UPDATE outreach_prospects SET status = ${status}, sent_at = COALESCE(sent_at, now()), updated_at = now() WHERE id = ${id}`);
    else await db.execute(sql`UPDATE outreach_prospects SET status = ${status}, updated_at = now() WHERE id = ${id}`);
    const rows = (await db.execute(sql`SELECT ${COLS} FROM outreach_prospects WHERE id = ${id} LIMIT 1`)) as unknown as Array<Record<string, unknown>>;
    return NextResponse.json({ ok: true, prospect: rows[0] ? mapProspect(rows[0]) : null });
  }
  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
}
