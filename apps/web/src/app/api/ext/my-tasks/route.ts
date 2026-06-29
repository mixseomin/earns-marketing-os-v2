import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth, resolveExtUser } from '../_auth';

export const dynamic = 'force-dynamic';
const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// Hàng việc của staff: human_tasks assigned cho user của token (nội dung đã dọn sẵn ở prep_payload).
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const who = await resolveExtUser(req);
  if (!who || who.mode !== 'staff') return NextResponse.json({ ok: true, tasks: [] }); // admin ko có hàng đợi cá nhân
  const db = getDb(); if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const rows = await db.execute(sql`
    SELECT ht.id, ht.title, ht.instructions, ht.prep_payload, ht.platform_key, ht.status,
           ht.sla_due_at, ht.project_id, p.name AS project_name, ht.publish_url
    FROM human_tasks ht
    LEFT JOIN projects p ON p.id = ht.project_id
    WHERE ht.tenant_id = ${TENANT} AND ht.assigned_user_id = ${who.userId}
      AND ht.status IN ('pending','claimed','in_progress')
    ORDER BY ht.sla_due_at ASC NULLS LAST, ht.id ASC
    LIMIT 50`);
  return NextResponse.json({ ok: true, tasks: rows });
}
