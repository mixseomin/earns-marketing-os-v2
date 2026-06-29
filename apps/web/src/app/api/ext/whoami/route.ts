import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Ext hỏi "tôi là loại token nào" → để bật staff mode (ẩn nút nhạy cảm) phía ext.
// admin = shared key MOS2_EXT_KEY · staff = per-user token (ext_tokens).
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!bearer) return NextResponse.json({ ok: false }, { status: 401 });

  if (process.env.MOS2_EXT_KEY && bearer === process.env.MOS2_EXT_KEY) {
    return NextResponse.json({ ok: true, mode: 'admin' });
  }
  const db = getDb();
  if (db) {
    const hash = createHash('sha256').update(bearer).digest('hex');
    const rows = await db.execute(sql`SELECT user_id FROM ext_tokens WHERE token_hash = ${hash} AND revoked_at IS NULL LIMIT 1`);
    const arr = rows as unknown as Array<{ user_id: number }>;
    if (arr.length) return NextResponse.json({ ok: true, mode: 'staff', userId: arr[0]!.user_id });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
