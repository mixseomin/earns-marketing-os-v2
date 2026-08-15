import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, firstRow } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/plan/track — đo lại một comment/lượt tương tác ĐÃ đăng, nhiều lần theo thời gian.
//
// Đăng xong chưa biết cách làm ổn chưa. Cái trả lời được câu đó là comment ấy có ai thả cảm xúc,
// có ai trả lời, có ai vào trang mình hay không — và mấy con số ấy chỉ có nghĩa khi đo LẶP LẠI
// (1 ngày, 1 tuần). Nên mỗi lần đo là một mốc nối thêm vào ai_notes, không đè lên mốc cũ: đọc lại
// là thấy đường đi của lượt đó, so được lượt này với lượt khác để bỏ kiểu comment không ai đọc.
//
// Body: { pieceId, likes?, replies?, note?, dead? }   dead=true khi comment bị xoá/ẩn.
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const b = await req.json().catch(() => ({})) as {
    pieceId?: number; likes?: number; replies?: number; note?: string; dead?: boolean;
  };
  const pieceId = Number(b.pieceId ?? 0);
  if (!pieceId) return errorResponse('pieceId required', 400);

  const row = firstRow(await db.execute(sql`
    SELECT id, publish_url, body_md FROM content_pieces WHERE id = ${pieceId} LIMIT 1
  `));
  if (!row) return errorResponse(`Không thấy card #${pieceId}`, 404);
  if (!row.publish_url) return errorResponse(`Card #${pieceId} chưa có link đã đăng — chưa có gì để đo`, 400);

  const note = {
    kind: 'plan-metric', at: new Date().toISOString(),
    ...(typeof b.likes === 'number' ? { likes: b.likes } : {}),
    ...(typeof b.replies === 'number' ? { replies: b.replies } : {}),
    ...(b.dead ? { dead: true } : {}),
    ...(b.note ? { note: String(b.note).slice(0, 500) } : {}),
  };
  // Mốc đo cũng nối một dòng vào body_md: thẻ trên lịch chỉ đọc body, không đọc ai_notes — ghi ở đây
  // thì mở thẻ ra là thấy lượt đó nhận được gì, khỏi phải thêm cột chỉ để hiện một con số.
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const bits = [
    typeof b.likes === 'number' ? `${b.likes} cảm xúc` : '',
    typeof b.replies === 'number' ? `${b.replies} trả lời` : '',
    b.dead ? 'KHÔNG CÒN (bị xoá/ẩn)' : '',
    b.note ? String(b.note).slice(0, 200) : '',
  ].filter(Boolean).join(' · ');
  const line = `\n· đo ${stamp}: ${bits || '(không có số)'}`;
  const bodyOut = String(row.body_md ?? '') + line;
  await db.execute(sql`
    UPDATE content_pieces
       SET ai_notes = coalesce(ai_notes, '[]'::jsonb) || ${JSON.stringify([note])}::jsonb,
           body_md = ${bodyOut},
           updated_at = now()
     WHERE id = ${pieceId}
  `);
  return NextResponse.json({ ok: true, pieceId, metric: note });
}
