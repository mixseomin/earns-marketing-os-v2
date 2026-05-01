// GET /api/agent-tasks?agent_kind=claude-code&status=pending
// REST endpoint cho external agents (Claude Code via MCP, future workers) pull task queue.
// Auth: x-agent-token header matches MOS2_AGENT_TOKEN env (separate từ cron secret).

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authOK(req: Request): boolean {
  const expected = process.env.MOS2_AGENT_TOKEN;
  if (!expected) return false;
  return req.headers.get('x-agent-token') === expected;
}

export async function GET(req: Request) {
  if (!process.env.MOS2_AGENT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'MOS2_AGENT_TOKEN chưa cấu hình trên server' }, { status: 503 });
  }
  if (!authOK(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const agentKind = url.searchParams.get('agent_kind') ?? 'claude-code';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100);

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db not configured' }, { status: 503 });

  // Tasks = cards với dispatch_ready=true + agent_kind matches + no running run.
  const rows = await db.execute(sql`
    SELECT c.id, c.project_id, c.card_ref, c.title, c.body, c.squad_key,
           c.agent_kind, c.agent_ref, c.level AS trust_level, c.tags, c.idempotency_key,
           c.col, c.dispatch_ready,
           p.name AS project_name
    FROM cards c
    LEFT JOIN projects p ON p.id = c.project_id
    WHERE c.tenant_id = 'self'
      AND c.archived_at IS NULL
      AND c.dispatch_ready = true
      AND c.agent_kind = ${agentKind}
      AND NOT EXISTS (
        SELECT 1 FROM agent_runs ar
        WHERE ar.card_id = c.id AND ar.status IN ('running', 'completed')
          AND (c.idempotency_key IS NULL OR ar.idempotency_key = c.idempotency_key)
      )
    ORDER BY c.created_at ASC
    LIMIT ${limit}
  `);

  return NextResponse.json({ ok: true, tasks: rows });
}
