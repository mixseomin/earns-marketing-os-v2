import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// Versions của gen-post (composer) cho 1 account — sống qua F5 (đọc lại từ content_pieces).
// GET ?accountId=&projectId=  → bản mới nhất trước.
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const url = new URL(req.url);
  const accountId = Number(url.searchParams.get('accountId') || 0);
  const projectId = (url.searchParams.get('projectId') ?? '').trim();
  if (!accountId) return errorResponse('accountId required', 400);

  // ai_notes là array [{kind:'ext-post-gen', accountId, model, ...}] → containment lọc đúng account.
  const filter = sql`ai_notes @> ${JSON.stringify([{ kind: 'ext-post-gen', accountId }])}::jsonb`;
  const projFilter = projectId ? sql`AND project_id = ${projectId}` : sql``;
  const rows = await db.execute(sql`
    SELECT id, title, body_md, ai_notes, created_at
    FROM content_pieces
    WHERE ${filter} ${projFilter} AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT 15
  `);
  const versions = (rows as unknown as Array<Record<string, unknown>>).map((r) => {
    const notes = Array.isArray(r.ai_notes) ? (r.ai_notes as Array<Record<string, unknown>>) : [];
    const n0 = notes[0] || {};
    return {
      id: Number(r.id),
      body: String(r.body_md ?? ''),
      title: String(r.title ?? ''),
      model: n0.model ? String(n0.model) : '',
      cost: n0.costUsd != null ? Number(n0.costUsd) : null,
      pillarId: n0.pillarId != null ? Number(n0.pillarId) : null,
      createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    };
  });
  return NextResponse.json({ ok: true, versions });
}
