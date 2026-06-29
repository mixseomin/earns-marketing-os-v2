import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { normalizeParentUrl } from '@/lib/parent-url';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/admin/backfill-thread-key
// Backfill thread_key = normalizeParentUrl(parent_url) cho card cũ — dùng ĐÚNG
// hàm canonical (KHÔNG replicate logic SQL). Idempotent: chỉ update khi lệch.
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb();
  if (!db) return errorResponse('db unavailable', 503);

  const rows = await db.execute(sql`
    SELECT id, parent_url, thread_key FROM cards WHERE parent_url IS NOT NULL`);
  const list = rows as unknown as Array<{ id: number; parent_url: string; thread_key: string | null }>;
  let updated = 0;
  for (const r of list) {
    const tk = normalizeParentUrl(r.parent_url);
    if (tk !== r.thread_key) {
      await db.execute(sql`UPDATE cards SET thread_key = ${tk} WHERE id = ${r.id}`);
      updated++;
    }
  }
  return NextResponse.json({ ok: true, scanned: list.length, updated });
}
