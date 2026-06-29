import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth, resolveExtUser } from '../../_auth';

export const dynamic = 'force-dynamic';
const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// Staff đánh dấu đã đăng + dán URL minh chứng. Chỉ sửa được task của chính mình.
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const who = await resolveExtUser(req);
  if (!who || who.mode !== 'staff') return NextResponse.json({ ok: false, error: 'staff only' }, { status: 403 });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const taskId = Number(body.taskId);
  const url = String(body.url ?? '').trim();
  if (!taskId) return NextResponse.json({ ok: false, error: 'taskId thiếu' }, { status: 400 });
  const db = getDb(); if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const r = await db.execute(sql`
    UPDATE human_tasks
    SET status = 'completed', completed_at = now(), publish_url = ${url || null}, updated_at = now()
    WHERE id = ${taskId} AND assigned_user_id = ${who.userId} AND tenant_id = ${TENANT}
    RETURNING id`);
  if (!(r as unknown as unknown[]).length) return NextResponse.json({ ok: false, error: 'task không thuộc bạn' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
