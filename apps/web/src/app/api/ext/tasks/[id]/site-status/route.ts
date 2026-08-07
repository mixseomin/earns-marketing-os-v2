import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../../../_auth';
import { setBacklinkSite } from '@/lib/actions/architecture';
import { isSiteStatus } from '@/lib/site-status';

export const dynamic = 'force-dynamic';

// POST /api/ext/tasks/[id]/site-status  { status, url? }
// Cập nhật trạng thái per-site của backlink task (site key = project_id = slug). Reuse setBacklinkSite
// (roll-up row status + stamp done/submitted). url không truyền → GIỮ url cũ (ko wipe khi chỉ đổi status).

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { status?: string; url?: string };
  const status = String(body.status || '').trim();
  if (!isSiteStatus(status)) return NextResponse.json({ ok: false, error: 'bad status' }, { status: 400 });

  const rows = await db.execute(sql`
    SELECT project_id, (prep_payload->'site_url') ->> project_id AS site_url
    FROM human_tasks WHERE id = ${taskId} AND platform_key = 'backlink' LIMIT 1`);
  const t = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!t) return NextResponse.json({ ok: false, error: 'not a backlink task' }, { status: 404 });
  const site = String(t.project_id || '');
  if (!site) return NextResponse.json({ ok: false, error: 'task chưa gắn project' }, { status: 400 });
  const url = body.url !== undefined ? String(body.url) : String(t.site_url || '');

  const r = await setBacklinkSite(taskId, site, status, url);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || 'lỗi' }, { status: 500 });
  return NextResponse.json({ ok: true, siteStatus: status, siteUrl: url });
}
