// POST /api/apps/register — đăng ký một app đo (Bearer MOS2_EXT_KEY). Body {key, ten, bundle_id?, project?}.
// Trả token để điền ANALYTICS_TOKEN trong app.env của title (token công khai, chỉ lọc rác — không phải bí mật).
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../ext/_auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db' }, { status: 503 });
  const b = (await req.json()) as { key?: string; ten?: string; bundle_id?: string; project?: string };
  const key = String(b.key ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  if (!key || !b.ten) return NextResponse.json({ ok: false, error: 'thiếu key/ten' }, { status: 400 });
  const r = await db.execute(sql`
    INSERT INTO app_ung_dung (key, ten, bundle_id, project_id) VALUES (${key}, ${b.ten}, ${b.bundle_id ?? null}, ${b.project ?? null})
    ON CONFLICT (key) DO UPDATE SET ten = EXCLUDED.ten, bundle_id = COALESCE(EXCLUDED.bundle_id, app_ung_dung.bundle_id),
      project_id = COALESCE(EXCLUDED.project_id, app_ung_dung.project_id)
    RETURNING key, token`);
  const row = (r as unknown as Array<{ key: string; token: string }>)[0];
  if (!row) return NextResponse.json({ ok: false, error: 'insert' }, { status: 500 });
  return NextResponse.json({ ok: true, key: row.key, token: row.token });
}
