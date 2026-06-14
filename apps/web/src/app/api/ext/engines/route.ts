import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

// GET /api/ext/engines → SPEC của các gen engine (0095). Ext fetch để override defaults hardcode
// (endpoint/label/màu/flags) → config editable từ dashboard, ko cần rebuild ext. BEHAVIOR (payload/fmt/
// preCheck) vẫn ở ext theo key. GATING vẫn theo projects.capabilities.engines (per-project allow-list).
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ engines: [] });
  const rows = await db.execute(sql`
    SELECT key, label, endpoint, color, title, working, needs_depth, needs_vision, default_model
    FROM engines WHERE enabled = true ORDER BY sort_order, key`);
  const engines = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    key: String(r.key),
    label: String(r.label ?? ''),
    endpoint: String(r.endpoint ?? ''),
    color: String(r.color ?? ''),
    title: String(r.title ?? ''),
    working: String(r.working ?? ''),
    needsDepth: r.needs_depth === true,
    needsVision: r.needs_vision === true,
    defaultModel: r.default_model ? String(r.default_model) : null,
  }));
  return NextResponse.json({ engines });
}
