// Act on a review request (claim / comment / resolve / reject). Appends to the thread so
// the flag → read → handle → feedback loop is captured. Same auth as /api/review.
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const who = await actor(req);
  if (!who) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db not configured' }, { status: 503 });
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const action = b.action as 'claim' | 'comment' | 'resolve' | 'reject';
  if (!['claim', 'comment', 'resolve', 'reject'].includes(action))
    return NextResponse.json({ ok: false, error: 'bad action' }, { status: 400 });

  const entry = JSON.stringify({ by: who.name, kind: who.kind, action, note: b.note ?? b.feedback ?? '', at: new Date().toISOString() });
  // append to prep_payload.thread (init to [] if missing)
  const appendThread = sql`prep_payload = jsonb_set(prep_payload, '{thread}', COALESCE(prep_payload->'thread', '[]'::jsonb) || ${entry}::jsonb)`;

  let statusUpd = sql``;
  if (action === 'claim') statusUpd = sql`, status = 'in_progress', claimed_by = ${who.name}, claimed_at = NOW()`;
  else if (action === 'resolve') statusUpd = sql`, status = 'done', completed_at = NOW(), notes = ${b.feedback ?? b.note ?? ''}, verify_result = ${JSON.stringify({ resolution: b.feedback ?? b.note ?? '', by: who.name })}::jsonb`;
  else if (action === 'reject') statusUpd = sql`, status = 'rejected', completed_at = NOW(), notes = ${b.feedback ?? b.note ?? ''}`;

  const rows = await db.execute(sql`
    UPDATE human_tasks
    SET ${appendThread}${statusUpd}, updated_at = NOW()
    WHERE id = ${Number(id)} AND prep_payload->>'kind' = 'review'
    RETURNING id, status
  `);
  const r = (rows as unknown as Array<{ id: number; status: string }>)[0];
  if (!r) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: r.id, status: r.status });
}
