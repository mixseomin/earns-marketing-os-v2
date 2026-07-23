import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../_auth';
import { errorResponse, firstRow } from '@/lib/ext-route';
import { setBacklinkSite } from '@/lib/actions/architecture';

export const dynamic = 'force-dynamic';

// POST /api/ext/tasks — tạo 1 backlink human_task TỪ CHÍNH TRANG đang mở (page-first / chớp cơ hội).
// Hôm nay card backlink phải có sẵn trong MOS2 rồi ext mới hiện task; endpoint này ĐẢO CHIỀU: thấy
// page phù hợp → làm ngay → tạo task+record ở đây (card sinh ngược, retroactive). Reuse setBacklinkSite
// (stamp site_status/site_url/site_done_at + roll row status→completed) nên task tạo ra render y hệt
// task tạo từ dashboard và tự đóng khi xong. platform_key LUÔN = 'backlink' (task TYPE); `platform` là
// NGUỒN đặt link (wordpress.org…) lưu mô tả. site key = project_id (slug). Idempotent per (project_id, postUrl).
interface Body {
  projectId?: string;
  platform?: string;
  postUrl?: string;
  mechanism?: string;
  placement?: string;
  anchor?: string;
  targetUrl?: string;
  sourceUrl?: string;
  title?: string;
  instructions?: string;
  accountId?: number;
  status?: string;   // 'done' (mặc định, page-first làm xong luôn) | 'pending' (tạo để làm sau)
}

export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json().catch(() => ({}))) as Body;

  const projectId = String(body.projectId ?? '').trim();
  const platform = String(body.platform ?? '').trim();
  const postUrl = String(body.postUrl ?? '').trim();
  if (!projectId || !platform || !postUrl) return errorResponse('projectId, platform, postUrl required', 400);
  // site key = project_id → phải hợp lệ với rule của setBacklinkSite, else stamp âm thầm fail.
  if (!/^[a-z0-9_-]+$/.test(projectId)) return errorResponse('projectId must be a slug [a-z0-9_-]', 400);

  const done = String(body.status ?? 'done') !== 'pending';

  // Idempotency: project này ĐÃ có đúng URL đã đặt → trả lại row cũ (không tạo trùng).
  const exist = await db.execute(sql`
    SELECT id FROM human_tasks
    WHERE platform_key = 'backlink' AND project_id = ${projectId}
      AND (prep_payload->'site_url') ->> project_id = ${postUrl} LIMIT 1`);
  const ex = firstRow<{ id: number }>(exist);
  if (ex) return NextResponse.json({ ok: true, id: Number(ex.id), existed: true, siteKey: projectId });

  const mechanism = String(body.mechanism ?? '').trim();
  const anchor = String(body.anchor ?? '').trim();
  const targetUrl = String(body.targetUrl ?? '').trim();
  const sourceUrl = String(body.sourceUrl ?? '').trim() || postUrl;
  const placement = String(body.placement ?? '').trim();
  const title = String(body.title ?? '').trim() || `${platform}${mechanism ? ' · ' + mechanism.slice(0, 40) : ''}`;
  const instructions = String(body.instructions ?? '').trim();
  const accountId = body.accountId != null ? Number(body.accountId) : null;

  // prep_payload keys khớp CHÍNH XÁC những gì GET /tasks/[id] đọc (source_url/mechanism/anchor/target_url).
  const pp: Record<string, unknown> = { source_url: sourceUrl, source_platform: platform };
  if (mechanism) pp.mechanism = mechanism;
  if (anchor) pp.anchor = anchor;
  if (targetUrl) pp.target_url = targetUrl;
  if (placement) pp.placement = placement;   // write-only hiện tại (GET chưa đọc) — cho page-first drawer sau

  let id: number;
  try {
    // column list = architecture.ts:498 (splitBacklinkTask) + publish_url (cột có sẵn, GET đọc ht.publish_url).
    const ins = await db.execute(sql`
      INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, account_id, assigned_user_id, status, publish_url)
      VALUES ('self', ${projectId}, ${title}, ${instructions}, ${JSON.stringify(pp)}::jsonb, 'backlink', ${accountId}, NULL, 'pending', ${postUrl})
      RETURNING id`);
    id = Number((ins as unknown as Array<{ id: number }>)[0]?.id);
    if (!id) return errorResponse('insert failed', 500);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'insert error', 500);
  }

  // Stamp per-site status/url qua ĐÚNG path drawer + /site-status dùng — roll row → completed+completed_at
  // khi done. KHÔNG tự tay set site_done_at/completed_at (tránh drift vs drawer).
  const r = await setBacklinkSite(id, projectId, done ? 'completed' : 'pending', postUrl);
  if (!r.ok) {
    return NextResponse.json({ ok: true, id, existed: false, status: 'pending', siteKey: projectId, warn: 'stamp failed: ' + r.error });
  }

  return NextResponse.json({ ok: true, id, existed: false, status: done ? 'completed' : 'pending', siteKey: projectId });
}
