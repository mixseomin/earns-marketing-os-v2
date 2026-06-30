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
  const site = String(body.site ?? '').trim();
  if (!taskId) return NextResponse.json({ ok: false, error: 'taskId thiếu' }, { status: 400 });
  const db = getDb(); if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  // Per-site completion (backlink = shared entity, 1 source → N sites). Mark THIS site
  // completed + store its live URL; only finish the whole row when every site is done.
  if (site) {
    if (!/^[a-z0-9_-]+$/.test(site)) return NextResponse.json({ ok: false, error: 'bad site' }, { status: 400 });
    const r = await db.execute(sql`
      UPDATE human_tasks SET prep_payload =
        COALESCE(prep_payload, '{}'::jsonb)
        || jsonb_build_object('site_status', COALESCE(prep_payload->'site_status', '{}'::jsonb) || jsonb_build_object(${site}::text, to_jsonb('completed'::text)))
        || jsonb_build_object('site_url',    COALESCE(prep_payload->'site_url',    '{}'::jsonb) || jsonb_build_object(${site}::text, to_jsonb(${url}::text))),
        updated_at = now()
      WHERE id = ${taskId} AND assigned_user_id = ${who.userId} AND tenant_id = ${TENANT} AND platform_key = 'backlink'
      RETURNING (prep_payload->'site_status') AS ss`);
    const list = r as unknown as Array<{ ss: Record<string, string> }>;
    const first = list[0];
    if (!first) return NextResponse.json({ ok: false, error: 'task không thuộc bạn' }, { status: 403 });
    const ss = first.ss || {};
    const allDone = Object.values(ss).every((v) => v === 'completed' || v === 'verified');
    if (allDone) {
      await db.execute(sql`
        UPDATE human_tasks SET status = 'completed', completed_at = now(),
          publish_url = COALESCE(publish_url, ${url || null}), updated_at = now()
        WHERE id = ${taskId} AND assigned_user_id = ${who.userId} AND tenant_id = ${TENANT}`);
    }
    return NextResponse.json({ ok: true, allDone });
  }

  // Default: whole-row completion (non-backlink tasks).
  const r = await db.execute(sql`
    UPDATE human_tasks
    SET status = 'completed', completed_at = now(), publish_url = ${url || null}, updated_at = now()
    WHERE id = ${taskId} AND assigned_user_id = ${who.userId} AND tenant_id = ${TENANT}
    RETURNING id`);
  if (!(r as unknown as unknown[]).length) return NextResponse.json({ ok: false, error: 'task không thuộc bạn' }, { status: 403 });
  return NextResponse.json({ ok: true, allDone: true });
}
