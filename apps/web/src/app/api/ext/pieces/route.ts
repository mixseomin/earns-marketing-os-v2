import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../_auth';
import { errorResponse, okResponse, firstRow, rows } from '@/lib/ext-route';
import { bigintArray, textArray } from '@/lib/sql-array';
import { publishedNeedsUrl, PUBLISHED_NEEDS_URL_MSG, scheduleTooFar, SCHEDULE_TOO_FAR_MSG } from '@/lib/content-channels';

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
  // Cùng luật với form: 'đã đăng' phải kèm link bài. Chặn ở ĐÂY nữa vì script ngoài (piece add
  // --status published) không đi qua form, và đó chính là đường dữ liệu diễn tập lọt vào lịch thật.
  if (publishedNeedsUrl(channel, status, b.publishUrl)) return errorResponse(PUBLISHED_NEEDS_URL_MSG);
  // Ngày trần 'YYYY-MM-DD' = ý NGÀY ĐỊA PHƯƠNG. Neo 09:00 để đổi sang timestamptz không
  // rơi về hôm trước ở múi giờ âm (lịch lệch 1 ô là lỗi khó thấy nhất).
  const when = String(b.scheduledAt ?? '').trim();
  const scheduledAt = when ? (/^\d{4}-\d{2}-\d{2}$/.test(when) ? `${when}T09:00:00` : when) : null;
  // Cùng luật với form: lịch chỉ lên trước một tuần. Đường này mới là đường đẻ ra lịch cả tháng
  // (agent/script gọi hàng loạt), nên thiếu chốt ở đây thì chốt ở form là vô nghĩa.
  if (scheduleTooFar(scheduledAt, (b.tags ?? []) as string[])) return errorResponse(SCHEDULE_TOO_FAR_MSG);

  // Không gửi `tags` = KHÔNG đụng tới tags. Trước đây upsert luôn lấy EXCLUDED.tags, nên sửa mỗi
  // cái caption bằng `piece add` là quét sạch acct/place/asset/time của bài — bài còn đó mà mất hết
  // chỗ đăng lẫn video, mất im lặng. (Khai ngoài câu SQL: template lồng backtick làm SWC vỡ lúc
  // build, dù tsc vẫn qua.)
  const tagsSet = Array.isArray(b.tags) ? sql`EXCLUDED.tags` : sql`content_pieces.tags`;
  const res = await db.execute(sql`
    INSERT INTO content_pieces (tenant_id, project_id, slug, title, channel, subject, body_md, status, scheduled_at, publish_url, tags, metrics)
    VALUES ('self', ${projectId}, ${slug}, ${title}, ${channel}, ${b.subject ?? null}, ${b.bodyMd ?? ''}, ${status},
            ${scheduledAt}::timestamptz, ${b.publishUrl ?? null}, ${JSON.stringify(b.tags ?? [])}::jsonb, ${JSON.stringify(b.metrics ?? {})}::jsonb)
    ON CONFLICT (project_id, slug) DO UPDATE SET
      title = EXCLUDED.title, channel = EXCLUDED.channel, subject = EXCLUDED.subject,
      body_md = CASE WHEN EXCLUDED.body_md = '' THEN content_pieces.body_md ELSE EXCLUDED.body_md END,
      status = EXCLUDED.status, scheduled_at = EXCLUDED.scheduled_at,
      publish_url = COALESCE(EXCLUDED.publish_url, content_pieces.publish_url),
      tags = ${tagsSet}, updated_at = now()
    RETURNING id, slug, (xmax = 0) AS created
  `);
  const row = firstRow<{ id: number; slug: string; created: boolean }>(res);
  return okResponse({ id: row?.id, slug: row?.slug, created: !!row?.created });
}

// PATCH /api/ext/pieces  { projectId, ids, scheduledAt?, status?, addTags? }
// Sửa MỘT VÀI trường trên nhiều bài, không đụng phần còn lại. Vì sao tách khỏi POST: POST là upsert
// cả bài (title, body, tags), dùng nó để đổi mỗi cái ngày là phải gửi lại nguyên bài — sai một
// trường là mất tag/thân bài thật. Ba việc dọn dẹp hay dùng:
//   scheduledAt: null   trả bài về kho (bài còn nguyên, chỉ rời lịch)
//   status: 'archived'  gộp bản trùng (archive giữ được, khác hẳn xoá)
//   addTags: [...]      gắn thêm tag (vd 'format:text') mà KHÔNG chạm tag đang có
// Trường nào VẮNG trong body thì không được đụng tới — đó là điểm khác POST.
export async function PATCH(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const b = (await req.json().catch(() => ({}))) as
    { projectId?: string; ids?: number[]; scheduledAt?: string | null; status?: string; addTags?: string[] };
  const projectId = String(b.projectId ?? '').trim();
  const ids = (b.ids ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!projectId || ids.length === 0) return errorResponse('projectId + ids required');

  const sets = [sql`updated_at = now()`];
  const conds = [sql`project_id = ${projectId}`, sql`id = ANY(${bigintArray(ids)})`,
    // Bài ĐÃ ĐĂNG không đổi ngày, không đổi trạng thái: chuyện đã xảy ra, không phải kế hoạch.
    sql`status <> 'published'`, sql`archived_at IS NULL`];

  let tooFar = false;
  if ('scheduledAt' in b) {
    const when = String(b.scheduledAt ?? '').trim();
    const scheduledAt = when ? (/^\d{4}-\d{2}-\d{2}$/.test(when) ? `${when}T09:00:00` : when) : null;
    // Ngày vượt cửa sổ 7 ngày thì KHÔNG chặn cả lệnh: bài gắn 'milestone' (payday, ngày công bố số)
    // vốn được đặt xa. Lọc trong WHERE — bài thường bị bỏ qua, bài mốc vẫn dời được, và `skipped`
    // nói ra đã bỏ qua mấy bài thay vì im lặng.
    tooFar = scheduleTooFar(scheduledAt, []);
    if (tooFar) conds.push(sql`tags @> '["milestone"]'::jsonb`);
    sets.push(sql`scheduled_at = ${scheduledAt}::timestamptz`);
  }
  if (b.status) {
    if (!STATUSES.has(b.status)) return errorResponse(`status không hợp lệ: ${b.status}`);
    if (b.status === 'published') return errorResponse('đánh dấu đã đăng thì dùng POST kèm publishUrl');
    sets.push(sql`status = ${b.status}`);
    // 'archived' đọc từ HAI chỗ (cột archived_at và status) — đặt một chỗ thôi thì nơi kia vẫn
    // coi là bài sống, và bài "đã bỏ" vẫn nằm nguyên trong lịch.
    if (b.status === 'archived') sets.push(sql`archived_at = now()`);
  }
  const addTags = (b.addTags ?? []).map(String).filter(Boolean);
  if (addTags.length) {
    // Hợp nhất, không ghi đè: tag cũ giữ nguyên, tag mới chỉ thêm nếu chưa có.
    sets.push(sql`tags = (SELECT to_jsonb(array_agg(DISTINCT v)) FROM (
      SELECT jsonb_array_elements_text(tags) AS v UNION SELECT unnest(${textArray(addTags)}) AS v) u)`);
  }
  if (sets.length === 1) return errorResponse('không có gì để sửa (scheduledAt / status / addTags)');

  const res = await db.execute(sql`
    UPDATE content_pieces SET ${sql.join(sets, sql`, `)}
    WHERE ${sql.join(conds, sql` AND `)}
    RETURNING id
  `);
  const updated = rows(res).length;
  return okResponse({ updated, skipped: ids.length - updated, ...(tooFar && updated < ids.length ? { note: SCHEDULE_TOO_FAR_MSG } : {}) });
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

  // Điều kiện dựng trong JS: bộ lọc vắng thì KHÔNG có mệnh đề, thay vì mẹo `${x} = '' OR …`
  // (mẹo đó đẩy chuỗi rỗng xuống DB rồi ép kiểu null — planner không dùng index, và mỗi lần
  // thêm bộ lọc lại phải chép lại mẹo).
  const conds = [sql`project_id = ${projectId}`, sql`archived_at IS NULL`];
  if (channel) conds.push(sql`channel = ${channel}`);
  if (from) conds.push(sql`scheduled_at >= ${from}::timestamptz`);
  if (to) conds.push(sql`scheduled_at < ${to}::timestamptz + interval '1 day'`);
  // body=1 → kèm cả thân bài. Mặc định KHÔNG kèm (danh sách 80 bài × thân dài = payload vô ích),
  // nhưng script dựng card cần chữ thật của bài, không thể đoán từ tiêu đề.
  const withBody = u.searchParams.get('body') === '1';
  const res = await db.execute(sql`
    SELECT id, slug, title, channel, subject, status, publish_url,
           to_char(scheduled_at, 'YYYY-MM-DD') AS date, tags
           ${withBody ? sql`, body_md AS body` : sql``}
    FROM content_pieces
    WHERE ${sql.join(conds, sql` AND `)}
    ORDER BY scheduled_at NULLS LAST, id
  `);
  return okResponse({ pieces: rows(res) });
}
