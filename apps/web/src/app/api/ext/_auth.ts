import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

// 2 cách xác thực ext:
//   1. Shared key MOS2_EXT_KEY  → full access (server/admin/legacy ext).
//   2. Per-user token (ext_tokens) → staff: resolve user + bump last_seen (heartbeat) + CHẶN route nhạy cảm.
//
// ponytail: per-user dùng DENY-list các route gây hại thật (reveal/delete/train/persona/admin);
//           siết thành ALLOW-list khi flow ext bản nhân sự chốt + test được.
const STAFF_DENY = [
  '/admin/', 'train-selector', 'learn-selectors', 'save-selector', 'clear-selector',
  'suggest-selector', 'adapter/', 'selectors/set', 'selectors/verify',
  'crew-capabilities', 'vision/', 'brief/update', 'project-brand', 'profile-fields/rename', 'media/generate',
];

function deniedForStaff(req: Request): boolean {
  const u = new URL(req.url);
  if (u.searchParams.get('reveal') === '1') return true; // lộ password/identity plaintext
  if (req.method === 'DELETE') return true;              // xoá account/...
  return STAFF_DENY.some((d) => u.pathname.includes(d));
}

// Resolve token → ai. admin = shared key · staff = per-user token (ext_tokens). null = invalid.
export async function resolveExtUser(req: Request): Promise<{ mode: 'admin' } | { mode: 'staff'; userId: number } | null> {
  const key = process.env.MOS2_EXT_KEY;
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!bearer) return null;
  if (key && bearer === key) return { mode: 'admin' };
  const db = getDb();
  if (db) {
    const hash = createHash('sha256').update(bearer).digest('hex');
    const rows = await db.execute(sql`SELECT user_id FROM ext_tokens WHERE token_hash = ${hash} AND revoked_at IS NULL LIMIT 1`);
    const arr = rows as unknown as Array<{ user_id: number }>;
    if (arr.length) return { mode: 'staff', userId: Number(arr[0]!.user_id) };
  }
  return null;
}

export async function checkAuth(req: Request): Promise<NextResponse | null> {
  const key = process.env.MOS2_EXT_KEY;
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) Shared admin key.
  if (key && bearer === key) return null;

  // 2) Per-user staff token: 1 UPDATE vừa validate (revoked_at IS NULL) vừa heartbeat (last_seen_at).
  const db = getDb();
  if (db) {
    const hash = createHash('sha256').update(bearer).digest('hex');
    const rows = await db.execute(sql`
      UPDATE ext_tokens SET last_seen_at = now()
      WHERE token_hash = ${hash} AND revoked_at IS NULL
      RETURNING user_id`);
    if ((rows as unknown as unknown[]).length) {
      return deniedForStaff(req)
        ? NextResponse.json({ error: 'Forbidden — staff token cannot access this route' }, { status: 403 })
        : null;
    }
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
