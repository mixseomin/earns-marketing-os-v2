import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../../_auth';
import { setBacklinkBlocker, setTaskResume } from '@/lib/actions/architecture';
import { toResume } from '@/lib/task-resume';

export const dynamic = 'force-dynamic';

// Trần số hàng của prep_payload.items — đủ cho mọi danh sách thật (450 URL, 338 khu vực) mà không
// biến một cột jsonb thành kho chứa. Danh sách lớn hơn thì thứ đáng lưu là đường tới file, không
// phải chính file.
const ITEMS_MAX = 2000;

// GET /api/ext/tasks/[id] — chi tiết 1 task cho Crew ext (bung inline trong console Tasks tab).
// Trả hd (instructions) + cách đặt (mechanism) + bài đăng đã sinh (ai_content.result) để nhân sự
// LÀM NGAY trong widget, khỏi mở drawer MOS2. Static route /assign được ưu tiên hơn [id] nên ko đụng.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const rows = await db.execute(sql`
    SELECT ht.id, ht.title, ht.instructions, ht.status, ht.publish_url, ht.platform_key, ht.project_id,
           ht.prep_payload->>'source_url' AS source_url,
           ht.prep_payload->>'mechanism' AS mechanism,
           ht.prep_payload->>'anchor' AS anchor,
           ht.prep_payload->>'target_url' AS target_url,
           ht.prep_payload->>'draft' AS draft,
           ht.prep_payload->>'draft_short' AS draft_short,
           (ht.prep_payload->'site_status') ->> ht.project_id AS site_status,
           (ht.prep_payload->'site_url')    ->> ht.project_id AS site_url,
           (ht.prep_payload->'site_submitted_at') ->> ht.project_id AS site_submitted_at,
           (ht.prep_payload->'site_scheduled_at') ->> ht.project_id AS site_scheduled_at,
           ht.sla_due_at,
           ht.prep_payload->'blocker'->>'reason' AS blocker,
           ht.prep_payload->'checklist' AS checklist,
           ht.prep_payload->'grounded' AS grounded,
           ht.prep_payload->'fill_fields' AS fill_fields,
           ht.prep_payload->'inputs' AS inputs,
           ht.prep_payload->>'done_when' AS done_when,
           ht.prep_payload->'depends_on' AS depends_on,
           p.name AS project_name, p.website AS project_website
    FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id
    WHERE ht.id = ${taskId} LIMIT 1`);
  const t = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // draft/draft_short (prep_payload) = bài đăng CHUẨN BỊ SẴN dạng MARKDOWN NGUỒN (drawer 📋 Draft hiện chỗ
  // này) → trả RAW để ext tự đổi format (md/html/bbcode/plain) + link-mode giống drawer. ai_content = mảnh
  // AI sinh on-demand (email/comment…) đã final → trả riêng ở `content`.
  const ac = await db.execute(sql`
    SELECT id, kind, result FROM ai_content
    WHERE task_id = ${taskId} AND status = 'done' AND result IS NOT NULL AND result <> ''
    ORDER BY created_at DESC`);

  return NextResponse.json({
    ok: true,
    task: {
      id: Number(t.id),
      title: String(t.title || ''),
      instructions: String(t.instructions || ''),
      status: String(t.status || ''),
      publishUrl: String(t.publish_url || ''),
      platformKey: String(t.platform_key || ''),
      siteKey: String(t.project_id || ''),          // = project slug = key trong site_status
      siteStatus: String(t.site_status || ''),       // pending|claimed|submitted|completed|verified|broken
      siteUrl: String(t.site_url || ''),             // link đã đặt (nếu có)
      sourceUrl: String(t.source_url || ''),
      mechanism: String(t.mechanism || ''),
      anchor: String(t.anchor || ''),
      targetUrl: String(t.target_url || ''),
      projectName: String(t.project_name || ''),
      projectWebsite: String(t.project_website || ''),
      draft: String(t.draft || '').trim(),           // markdown nguồn bản dài
      draftShort: String(t.draft_short || '').trim(), // markdown nguồn bản ngắn
      // #5: lịch/deadline (cột sla_due_at) + blocker text + checklist progress (prep_payload).
      slaDueAt: t.sla_due_at ? new Date(t.sla_due_at as string | number | Date).toISOString() : '',
      submittedAt: t.site_submitted_at ? new Date(t.site_submitted_at as string | number | Date).toISOString() : '',   // ngày nộp (stamp khi status→submitted) → ext hiện "đã nộp X · đợi N ngày"
      scheduledAt: String(t.site_scheduled_at || ''),   // 🗓 follow/check-back date (submitted → +7d) → surface "đến hạn kiểm tra duyệt" cạnh submittedAt
      blocker: String(t.blocker || ''),
      checklist: (t.checklist && typeof t.checklist === 'object') ? (t.checklist as Record<string, unknown>) : {},
      // grounded (prep_payload) = instructions đã Chuẩn hoá dựa trên DOM thật — ext hiện badge để biết bản mới nhất.
      grounded: (t.grounded && typeof t.grounded === 'object' && !Array.isArray(t.grounded)) ? (t.grounded as Record<string, unknown>) : null,
      // fill_fields (prep_payload) = ✨ Chuẩn bị điền: identity THẬT từ account + content AI. Ext auto-fill (P2).
      // Password source='account-password' value='' → ext điền từ creds an toàn, KHÔNG có plaintext ở đây.
      fillFields: (t.fill_fields && typeof t.fill_fields === 'object' && Array.isArray((t.fill_fields as { items?: unknown }).items))
        ? (t.fill_fields as { at?: string; items: Array<{ key: string; label: string; type: string; value: string; source: string; confidence: string }> }) : null,
      // BÀN GIAO — inputs (link) · done_when (tiêu chí xong) · depends_on (card cần trước). Đây là thứ 1 chat
      // KHÁC đọc để nối task pending mà không đoán. `play show <id>` in ra đúng object này.
      resume: toResume(t.inputs, t.done_when, t.depends_on),
      content: (ac as unknown as Array<Record<string, unknown>>).map((x) => ({
        id: Number(x.id), kind: String(x.kind || 'nội dung (AI)'), result: String(x.result || ''),
      })),
    },
  });
}

// PATCH /api/ext/tasks/[id] — #5: người-làm cập nhật NGAY trong ext (khỏi mở drawer MOS2):
//   { slaDueAt }   → lịch/deadline (cột sla_due_at). '' / null = xoá hẹn.
//   { blocker }    → prep_payload.blocker (text "mắc gì ở bước này"). (ảnh chụp = phase sau, cần upload infra.)
//   { checklist }  → prep_payload.checklist merge {stepKey: done} (tick bước reg/đặt link).
//   { items }      → prep_payload.items = { label, rows[] }: DANH SÁCH THỰC THỂ card đang nói tới.
//        Card ghi "đẩy 450 URL" hay "338 khu vực" thì con số đó phải mở ra xem được ngay tại chỗ,
//        chứ không phải đi lục file trên máy nào đó — nếu không thì tháng sau không ai kiểm lại được
//        card đã động vào ĐÚNG những gì. rows = mảng object phẳng (mọi hàng dùng chung bộ khoá) hoặc
//        mảng chuỗi; drawer tự dựng cột từ khoá của hàng đầu.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { slaDueAt?: string | null; blocker?: string; checklist?: Record<string, boolean>; resume?: { inputs?: unknown; doneWhen?: unknown; dependsOn?: unknown }; items?: { label?: string; rows?: unknown[] } | null };

  if (body.slaDueAt !== undefined) {
    const iso = body.slaDueAt ? new Date(body.slaDueAt).toISOString() : null;
    await db.execute(sql`UPDATE human_tasks SET sla_due_at = ${iso}::timestamptz, updated_at = now() WHERE id = ${taskId}`);
  }
  if (body.blocker !== undefined) {
    // DÙNG CHUNG server action với drawer MOS2 → ghi ĐÚNG shape {reason,at,shot?} (drawer đọc .reason) +
    // auto-pause sibling + clear→resolved. Trước đây ghi string thô → drawer rỗng + task rớt worklist (bug #5a).
    await setBacklinkBlocker(taskId, String(body.blocker).slice(0, 2000));
  }
  if (body.checklist && typeof body.checklist === 'object') {
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body.checklist)) clean[String(k).slice(0, 60)] = !!v;
    await db.execute(sql`UPDATE human_tasks SET prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{checklist}', COALESCE(prep_payload->'checklist', '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb, true), updated_at = now() WHERE id = ${taskId}`);
  }
  let itemsSaved: { saved: number; sent: number } | null = null;
  if (body.items !== undefined) {
    if (body.items === null) {
      await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb) - 'items', updated_at = now() WHERE id = ${taskId}`);
    } else {
      // Trần 2000 hàng: đủ cho mọi danh sách thật (450 URL, 338 khu vực) mà không biến một cột jsonb
      // thành kho chứa. Danh sách lớn hơn thì thứ cần lưu là đường tới file, không phải chính file.
      const all = Array.isArray(body.items.rows) ? body.items.rows : [];
      const rows = all.slice(0, ITEMS_MAX);
      const payload = { label: String(body.items.label ?? '').slice(0, 120), rows, at: new Date().toISOString(), ...(all.length > rows.length ? { truncatedFrom: all.length } : {}) };
      await db.execute(sql`UPDATE human_tasks SET prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{items}', ${JSON.stringify(payload)}::jsonb, true), updated_at = now() WHERE id = ${taskId}`);
      // Trả về số ĐÃ LƯU, không phải số đã gửi: người gọi in ra con số này, mà cắt bớt trong im lặng
      // thì bản in nói "nạp 3000 mục" trong khi thẻ chỉ giữ 2000 — sai ngay ở chỗ dùng để đối chiếu.
      itemsSaved = { saved: rows.length, sent: all.length };
    }
  }
  // Bàn giao: inputs/done_when/depends_on (merge qua setTaskResume — dùng chung drawer MOS2).
  if (body.resume !== undefined) await setTaskResume(taskId, body.resume || {});
  return NextResponse.json({ ok: true, ...(itemsSaved ? { items: itemsSaved } : {}) });
}
