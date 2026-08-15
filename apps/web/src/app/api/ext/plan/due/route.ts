import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/plan/due?host=facebook.com&path=/groups/123&projectId=
// Kế hoạch ĐẾN HẠN cho đúng trang runner đang mở. Ext hỏi mỗi khi vào một cộng đồng: có việc gì
// phải làm ở đây hôm nay không? Có thì hiện nút chạy, không thì im — không quấy.
//
// Khớp theo tag place: so HOST + phần đường dẫn nhận dạng (r/army, groups/123, tên page), vì
// place lưu URL đầy đủ còn runner có thể đang đứng ở URL con (một thread trong nhóm).
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DATABASE_URL not configured', 503);
  const p = new URL(req.url).searchParams;
  const host = (p.get('host') || '').replace(/^www\./, '').toLowerCase();
  const path = p.get('path') || '';
  const projectId = p.get('projectId') || '';
  if (!host) return errorResponse('host required', 400);

  // Chỉ lấy việc LÀM TẠI CHỖ (comment/engage/share) chưa có kết quả, đến hạn tới hết hôm nay.
  const rows = await db.execute(sql`
    SELECT id, project_id, title, body_md, tags,
           to_char(scheduled_at, 'HH24:MI') AS at_time,
           to_char(scheduled_at, 'YYYY-MM-DD') AS at_date
      FROM content_pieces
     WHERE archived_at IS NULL AND status <> 'archived'
       AND publish_url IS NULL
       AND scheduled_at IS NOT NULL
       AND scheduled_at < (now() + interval '1 day')
       AND scheduled_at > (now() - interval '3 days')
       AND (tags @> '["format:comment"]'::jsonb OR tags @> '["format:engage"]'::jsonb OR tags @> '["format:share"]'::jsonb)
       AND NOT (tags @> '["replyto"]'::jsonb)
       ${projectId ? sql`AND project_id = ${projectId}` : sql``}
     ORDER BY scheduled_at
     LIMIT 40
  `);

  const list = (rows as unknown as Array<Record<string, unknown>>)
    .map((r) => {
      const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
      const place = (tags.find((t) => t.startsWith('place:')) ?? '').slice(6);
      const format = (tags.find((t) => t.startsWith('format:')) ?? '').slice(7);
      // "comment đầu" dưới bài của mình có tag replyto: → không phải việc tại chỗ, bỏ.
      if (tags.some((t) => t.startsWith('replyto:'))) return null;
      return {
        id: Number(r.id), projectId: String(r.project_id), title: String(r.title ?? ''),
        plan: String(r.body_md ?? ''), place, format,
        atTime: String(r.at_time ?? ''), atDate: String(r.at_date ?? ''),
      };
    })
    .filter(Boolean) as Array<{ id: number; place: string; format: string; [k: string]: unknown }>;

  // Khớp nơi đăng với trang đang mở: cùng host + trang đó nằm trong đường dẫn kế hoạch (hoặc
  // ngược lại — runner đứng ở thread con của nhóm).
  const key = (u: string) => {
    try {
      const x = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
      return { host: x.hostname.replace(/^www\./, '').toLowerCase(), path: x.pathname.replace(/\/+$/, '').toLowerCase() };
    } catch { return { host: '', path: '' }; }
  };
  const herePath = path.replace(/\/+$/, '').toLowerCase();
  const due = list.filter((it) => {
    const k = key(it.place);
    if (!k.host || k.host !== host) return false;
    if (!k.path) return true;
    return herePath.startsWith(k.path) || k.path.startsWith(herePath);
  });

  return NextResponse.json({ ok: true, due, checked: list.length });
}
