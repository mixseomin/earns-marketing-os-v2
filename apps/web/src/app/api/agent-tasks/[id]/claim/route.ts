// POST /api/agent-tasks/{id}/claim — mark agent_runs row started.
// Body: { agent_kind, agent_ref?, idempotency_key? }
// Returns: { ok, run_id }

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const expected = process.env.MOS2_AGENT_TOKEN;
  if (!expected || req.headers.get('x-agent-token') !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const cardId = Number(id);
  if (!Number.isInteger(cardId)) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { agent_kind?: string; agent_ref?: string | null; idempotency_key?: string | null };

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db' }, { status: 503 });

  const cardRows = await db.execute(sql`SELECT project_id, idempotency_key FROM cards WHERE id = ${cardId} LIMIT 1`);
  const card = (cardRows as unknown as Array<{ project_id: string; idempotency_key: string | null }>)[0];
  if (!card) return NextResponse.json({ ok: false, error: 'card not found' }, { status: 404 });

  const insertRows = await db.execute(sql`
    INSERT INTO agent_runs (
      tenant_id, project_id, card_id, agent_kind, agent_ref, status,
      started_at, timeout_at, idempotency_key, attempt
    ) VALUES (
      'self', ${card.project_id}, ${cardId},
      ${body.agent_kind ?? 'claude-code'}, ${body.agent_ref ?? null}, 'running',
      NOW(), NOW() + INTERVAL '60 minutes',
      ${body.idempotency_key ?? card.idempotency_key ?? `card-${cardId}`}, 1
    ) RETURNING id
  `);
  const run = (insertRows as unknown as Array<{ id: number }>)[0]!;
  return NextResponse.json({ ok: true, run_id: run.id });
}
