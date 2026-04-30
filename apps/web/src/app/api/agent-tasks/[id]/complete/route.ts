// POST /api/agent-tasks/{id}/complete — finalize agent_run, advance card column.
// Body: { run_id, output, artifacts?, tools_used?, tokens_in?, tokens_out?,
//         cost_usd_cents?, status?: 'completed'|'failed', next_col? }

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
  const body = await req.json() as {
    run_id: number;
    output?: Record<string, unknown> | string;
    artifacts?: Array<Record<string, unknown>>;
    tools_used?: Array<Record<string, unknown>>;
    tokens_in?: number; tokens_out?: number; cost_usd_cents?: number;
    status?: 'completed' | 'failed';
    next_col?: string;
    error?: string;
  };
  if (!body.run_id) return NextResponse.json({ ok: false, error: 'run_id required' }, { status: 400 });

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db' }, { status: 503 });

  const status = body.status ?? 'completed';
  const nextCol = body.next_col ?? (status === 'completed' ? 'doing' : 'needs');
  const outputJson = typeof body.output === 'string' ? { text: body.output } : (body.output ?? {});

  await db.execute(sql`
    UPDATE agent_runs SET
      status = ${status},
      completed_at = NOW(),
      duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      output = ${JSON.stringify(outputJson)}::jsonb,
      artifacts = ${JSON.stringify(body.artifacts ?? [])}::jsonb,
      tools_used = ${JSON.stringify(body.tools_used ?? [])}::jsonb,
      tokens_in = ${body.tokens_in ?? 0},
      tokens_out = ${body.tokens_out ?? 0},
      cost_usd_cents = ${body.cost_usd_cents ?? 0},
      error = ${body.error ?? null},
      updated_at = NOW()
    WHERE id = ${body.run_id} AND card_id = ${cardId}
  `);
  await db.execute(sql`UPDATE cards SET col = ${nextCol}, updated_at = NOW() WHERE id = ${cardId}`);
  return NextResponse.json({ ok: true });
}
