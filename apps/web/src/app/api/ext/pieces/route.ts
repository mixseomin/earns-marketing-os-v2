import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../_auth';
import { errorResponse, okResponse, firstRow, rows } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/pieces — tạo/cập nhật 1 content_piece (bài đăng) từ ngoài dashboard.
// Vì sao có: Content Studio đã có lịch tháng + lọc kênh, nhưng đường ghi DUY NHẤT là form
// "+ New piece" gõ tay từng bài. Lên lịch 1 tháng = ~80 bài → không ai ngồi gõ 80 lần, nên
// lịch đẹp mà rỗng. Endpoint này là bản song sinh của /api/ext/tasks cho BÀI (tasks = VIỆC).
// Idempotent per (project_id, slug) — chạy lại cùng script chỉ cập nhật, không đẻ trùng.
interface Body {
  projectId?: string;
  slug?: string;
  title?: string;
  channel?: string;      // fb-post | fb-group | reddit | email | blog … (lib/content-channels)
  subject?: string;      // hook — dòng đầu người đọc thấy
  bodyMd?: string;
  status?: string;       // draft|approved|scheduled|published|archived
  scheduledAt?: string;  // 'YYYY-MM-DD' hoặc ISO — ngày đăng, thứ vẽ nên lịch
  publishUrl?: string;
  tags?: string[];       // 'angle:ranking', 'src:S1', 'cta:/bah' — ô search của studio lọc được
  metrics?: Record<string, string | number>;
}

const STATUSES = new Set(['draft', 'approved', 'scheduled', 'published', 'archived']);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const b = (await req.json().catch(() => ({}))) as Body;

  const projectId = String(b.projectId ?? '').trim();
  const title = String(b.title ?? '').trim();
  if (!projectId || !title) return errorResponse('projectId + title required');

  const slug = (b.slug?.trim() || slugify(title)) || `piece-${Date.now()}`;
  const channel = String(b.channel ?? 'fb-post').trim();
  const status = STATUSES.has(String(b.status)) ? String(b.status) : 'draft';
  // Ngày trần 'YYYY-MM-DD' = ý NGÀY ĐỊA PHƯƠNG. Neo 09:00 để đổi sang timestamptz không
  // rơi về hôm trước ở múi giờ âm (lịch lệch 1 ô là lỗi khó thấy nhất).
  const when = String(b.scheduledAt ?? '').trim();
  const scheduledAt = when ? (/^\d{4}-\d{2}-\d{2}$/.test(when) ? `${when}T09:00:00` : when) : null;

  const res = await db.execute(sql`
    INSERT INTO content_pieces (tenant_id, project_id, slug, title, channel, subject, body_md, status, scheduled_at, publish_url, tags, metrics)
    VALUES ('self', ${projectId}, ${slug}, ${title}, ${channel}, ${b.subject ?? null}, ${b.bodyMd ?? ''}, ${status},
            ${scheduledAt}::timestamptz, ${b.publishUrl ?? null}, ${JSON.stringify(b.tags ?? [])}::jsonb, ${JSON.stringify(b.metrics ?? {})}::jsonb)
    ON CONFLICT (project_id, slug) DO UPDATE SET
      title = EXCLUDED.title, channel = EXCLUDED.channel, subject = EXCLUDED.subject,
      body_md = CASE WHEN EXCLUDED.body_md = '' THEN content_pieces.body_md ELSE EXCLUDED.body_md END,
      status = EXCLUDED.status, scheduled_at = EXCLUDED.scheduled_at,
      publish_url = COALESCE(EXCLUDED.publish_url, content_pieces.publish_url),
      tags = EXCLUDED.tags, updated_at = now()
    RETURNING id, slug, (xmax = 0) AS created
  `);
  const row = firstRow<{ id: number; slug: string; created: boolean }>(res);
  return okResponse({ id: row?.id, slug: row?.slug, created: !!row?.created });
}

// GET /api/ext/pieces?projectId=x[&channel=fb-post][&from=YYYY-MM-DD][&to=YYYY-MM-DD]
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const u = new URL(req.url);
  const projectId = (u.searchParams.get('projectId') ?? '').trim();
  if (!projectId) return errorResponse('projectId required');
  const channel = (u.searchParams.get('channel') ?? '').trim();
  const from = (u.searchParams.get('from') ?? '').trim();
  const to = (u.searchParams.get('to') ?? '').trim();

  const res = await db.execute(sql`
    SELECT id, slug, title, channel, subject, status, publish_url,
           to_char(scheduled_at, 'YYYY-MM-DD') AS date, tags
    FROM content_pieces
    WHERE project_id = ${projectId} AND archived_at IS NULL
      AND (${channel} = '' OR channel = ${channel})
      AND (${from} = '' OR scheduled_at >= ${from || null}::timestamptz)
      AND (${to} = '' OR scheduled_at < (${to || null}::timestamptz + interval '1 day'))
    ORDER BY scheduled_at NULLS LAST, id
  `);
  return okResponse({ pieces: rows(res) });
}
