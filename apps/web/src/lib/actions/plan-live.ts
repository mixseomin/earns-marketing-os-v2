'use server';

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

// Mốc SỐNG của các lượt tại chỗ: runner ghi qua /api/ext/plan/status, dock trên /plays đọc bằng
// hàm này mỗi ít giây. Chỉ lấy mốc trong 20 phút gần nhất — quá đó coi như lượt đã chết hoặc đã
// xong, hiện tiếp thì thành trạng thái ma. Mốc 'xong'/rỗng cũng bị bỏ, đó là tín hiệu gỡ.
export type PlanLive = { pieceId: number; stage: string; note: string; at: string; place: string; title: string; projectId: string; date: string };

/** projectId rỗng = MỌI project. /plays gộp mọi project cũng phải thấy lượt đang chạy, nếu không
 *  thì đứng ở màn hình đó nhìn xuống lịch hôm nay chẳng có gì — trong khi việc chạy ở ngày hôm qua. */
export async function getPlanLive(projectId?: string): Promise<PlanLive[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT p.id, p.title, p.tags, p.project_id, to_char(p.scheduled_at, 'YYYY-MM-DD') AS date, n.note
      FROM content_pieces p
      CROSS JOIN LATERAL (
        SELECT x AS note
          FROM jsonb_array_elements(coalesce(p.ai_notes, '[]'::jsonb)) x
         WHERE x->>'kind' = 'plan-live'
         ORDER BY (x->>'at') DESC
         LIMIT 1
      ) n
     WHERE p.archived_at IS NULL
       ${projectId ? sql`AND p.project_id = ${projectId}` : sql``}
       AND (n.note->>'at')::timestamptz > now() - interval '20 minutes'
       AND coalesce(n.note->>'stage', '') NOT IN ('', 'xong')
     ORDER BY (n.note->>'at') DESC
     LIMIT 5
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => {
    const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
    const note = (r.note ?? {}) as Record<string, string>;
    return {
      pieceId: Number(r.id),
      stage: String(note.stage ?? ''),
      note: String(note.note ?? ''),
      at: String(note.at ?? ''),
      place: (tags.find((t) => t.startsWith('place:')) ?? '').slice(6),
      title: String(r.title ?? ''),
      projectId: String(r.project_id ?? ''),
      date: String(r.date ?? ''),
    };
  });
}
