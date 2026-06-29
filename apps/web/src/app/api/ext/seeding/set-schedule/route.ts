import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { firstRow, errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/seeding/set-schedule
// Body: { cardId: number, scheduledAt: string|null }  (ISO timestamp, hoặc null = bỏ lịch)
// Post-queue (0094): đặt giờ DỰ ĐỊNH đăng cho 1 draft. Surface qua list-drafts.scheduledAt → ext queue
// hiện "⏰ {giờ}" / "due". KHÔNG auto-post server-side (X đăng qua ext/manual) — đây là lớp data + nhắc.
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json().catch(() => ({}))) as { cardId?: number; scheduledAt?: string | null };
  const cardId = Number(body.cardId ?? 0);
  if (!cardId) return errorResponse('cardId required', 400);

  let when: string | null = null;
  if (body.scheduledAt != null && String(body.scheduledAt).trim()) {
    const d = new Date(String(body.scheduledAt));
    if (isNaN(d.getTime())) return errorResponse('scheduledAt invalid (ISO)', 400);
    when = d.toISOString();
  }

  const r = await db.execute(sql`UPDATE cards SET scheduled_at = ${when}, updated_at = NOW() WHERE id = ${cardId} RETURNING id`);
  const row = firstRow(r);
  if (!row) return errorResponse('card_not_found', 404);
  return NextResponse.json({ ok: true, cardId, scheduledAt: when });
}
