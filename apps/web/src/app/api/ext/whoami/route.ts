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
    const rows = await db.execute(sql`
      SELECT t.user_id, u.name, u.email, u.avatar_url,
        (SELECT COUNT(*)::int FROM human_tasks ht
         WHERE ht.assigned_user_id = t.user_id
           AND ht.status IN ('pending','claimed','in_progress')) AS open_tasks
      FROM ext_tokens t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ${hash} AND t.revoked_at IS NULL LIMIT 1`);
    const arr = rows as unknown as Array<{ user_id: number; name: string | null; email: string | null; avatar_url: string | null; open_tasks: number }>;
    if (arr.length) {
      const r = arr[0]!;
      return NextResponse.json({
        ok: true, mode: 'staff',
        userId: r.user_id,
        name: r.name || r.email || `Staff #${r.user_id}`,
        email: r.email || '',
        avatarUrl: r.avatar_url || '',
        openTasks: r.open_tasks ?? 0,
      });
    }
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
