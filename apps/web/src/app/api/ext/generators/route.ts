import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

// GET /api/ext/generators → SPEC của các content generator (0095, table renamed 0102). Ext fetch để
// override defaults hardcode (endpoint/label/màu/flags) → config editable từ dashboard, ko cần rebuild ext.
// BEHAVIOR (payload/fmt/preCheck) vẫn ở ext theo key. GATING vẫn theo projects.capabilities.generators
// (per-project allow-list; legacy `capabilities.engines` vẫn đọc fallback trong transition).
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ generators: [] });
  const rows = await db.execute(sql`
    SELECT key, label, endpoint, color, title, working, needs_depth, needs_vision, default_model
    FROM generators WHERE enabled = true ORDER BY sort_order, key`);
  const generators = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
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
  return NextResponse.json({ generators });
}
