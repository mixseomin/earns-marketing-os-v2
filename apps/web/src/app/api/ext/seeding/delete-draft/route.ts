import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

// POST /api/ext/seeding/delete-draft
// Body: { cardId }
// Soft-archive card (set archived_at = NOW()). Card vẫn nằm trong DB
// nhưng /list-drafts filter archived_at IS NULL → ẩn khỏi history dropdown.
//
// Restriction: chỉ xóa được card CHƯA POST (post_url IS NULL). Card đã đăng
// rồi phải dùng flow khác (un-post / detach) tránh xóa nhầm record posted.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as { cardId?: number };
  const cardId = Number(body.cardId ?? 0);
  if (!cardId) {
    return NextResponse.json({ ok: false, error: 'cardId required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  const rows = await db.execute(sql`
    SELECT id, post_url, archived_at FROM cards WHERE id = ${cardId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return NextResponse.json({ ok: false, error: 'Card not found' }, { status: 404 });

  if (r.post_url) {
    return NextResponse.json({
      ok: false,
      error: 'Card đã post — không thể xóa draft. Dùng flow detach/un-post nếu cần.',
    }, { status: 400 });
  }

  if (r.archived_at) {
    return NextResponse.json({ ok: true, alreadyArchived: true });
  }

  await db.execute(sql`
    UPDATE cards SET archived_at = NOW(), updated_at = NOW() WHERE id = ${cardId}
  `);

  return NextResponse.json({ ok: true, cardId });
}
