'use server';

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

// Các lượt tại chỗ ĐANG DANG DỞ. Hai nguồn, vì một mình nhịp tim là không đủ:
//   · mốc sống runner ghi qua /api/ext/plan/status (mở nhóm, đang soạn, chờ duyệt…) — cửa sổ 6 giờ,
//     không phải 20 phút: thẻ chờ người duyệt có thể nằm đó cả buổi, cửa sổ ngắn thì nó biến mất
//     khỏi màn hình đúng lúc đang cần nhìn nhất (đã xảy ra: 23 phút là mất dấu).
//   · thẻ ĐÃ CHỐT BÀI (có khối chuẩn bị) mà chưa có link đăng — trạng thái này nằm ở DỮ LIỆU, không
//     phụ thuộc runner còn sống hay không. Máy tắt giữa chừng thì việc vẫn phải nổi lên.
// Có mốc 'xong' hoặc đã có publish_url = xong, biến mất khỏi danh sách.
export type PlanLive = { pieceId: number; stage: string; note: string; at: string; place: string; title: string; projectId: string; date: string };

/** projectId rỗng = MỌI project. /plays gộp mọi project cũng phải thấy lượt đang chạy, nếu không
 *  thì đứng ở màn hình đó nhìn xuống lịch hôm nay chẳng có gì — trong khi việc chạy ở ngày hôm qua. */
export async function getPlanLive(projectId?: string): Promise<PlanLive[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT p.id, p.title, p.tags, p.project_id, to_char(p.scheduled_at, 'YYYY-MM-DD') AS date,
           n.note,
           (SELECT max(x->>'at') FROM jsonb_array_elements(coalesce(p.ai_notes, '[]'::jsonb)) x
             WHERE x->>'kind' = 'plan-prepare') AS prep_at
      FROM content_pieces p
      LEFT JOIN LATERAL (
        SELECT x AS note
          FROM jsonb_array_elements(coalesce(p.ai_notes, '[]'::jsonb)) x
         WHERE x->>'kind' = 'plan-live'
           AND (x->>'at')::timestamptz > now() - interval '6 hours'
           AND coalesce(x->>'stage', '') NOT IN ('', 'xong')
         ORDER BY (x->>'at') DESC
         LIMIT 1
      ) n ON true
     WHERE p.archived_at IS NULL
       AND p.publish_url IS NULL
       ${projectId ? sql`AND p.project_id = ${projectId}` : sql``}
       AND (n.note IS NOT NULL
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p.ai_notes, '[]'::jsonb)) x
                        WHERE x->>'kind' = 'plan-prepare'))
     ORDER BY coalesce(n.note->>'at', (SELECT max(x->>'at') FROM jsonb_array_elements(coalesce(p.ai_notes, '[]'::jsonb)) x
                                        WHERE x->>'kind' = 'plan-prepare')) DESC
     LIMIT 6
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => {
    const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
    const note = (r.note ?? {}) as Record<string, string>;
    return {
      pieceId: Number(r.id),
      // Không còn nhịp tim nhưng đã chốt bài = "đã soạn, chờ đăng": nói đúng cái đang chờ ai làm gì.
      stage: String(note.stage || 'đã chốt bài, chờ đăng'),
      note: String(note.note ?? ''),
      at: String(note.at || r.prep_at || ''),
      place: (tags.find((t) => t.startsWith('place:')) ?? '').slice(6),
      title: String(r.title ?? ''),
      projectId: String(r.project_id ?? ''),
      date: String(r.date ?? ''),
    };
  });
}
