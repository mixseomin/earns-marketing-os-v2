import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, firstRow } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/plan/result — ghi KẾT QUẢ THẬT về card kế hoạch sau khi đã đăng.
//
// Đây là nửa sau của vòng: kế hoạch không có nội dung, nội dung sinh tại chỗ, nên thứ duy nhất
// chứng minh lượt đó có xảy ra là URL + nguyên văn ĐÃ ĐĂNG. Ext bắt hai thứ đó ngay sau khi bấm
// đăng (postAndTrack đọc bài mới nhất của mình) rồi gọi vào đây.
//
// Body: { pieceId, url, text?, cardId?, mode? }
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const b = await req.json().catch(() => ({})) as {
    pieceId?: number; url?: string; text?: string; cardId?: number; mode?: string;
  };
  const pieceId = Number(b.pieceId ?? 0);
  const url = String(b.url ?? '').trim();
  if (!pieceId) return errorResponse('pieceId required', 400);
  if (!url) return errorResponse('url required — không có link thì không tính là đã làm', 400);

  const row = firstRow(await db.execute(sql`
    SELECT id, body_md FROM content_pieces WHERE id = ${pieceId} LIMIT 1
  `));
  if (!row) return errorResponse(`Không thấy card kế hoạch #${pieceId}`, 404);

  // Nguyên văn nối vào body_md dưới kế hoạch: mở card ra là thấy "đã định làm gì" và "đã nói gì"
  // cạnh nhau. Không có chỗ này thì tháng sau nhìn lại chỉ còn một cái link trần.
  const text = String(b.text ?? '').trim();
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const block = `\n\n— ĐÃ ${b.mode === 'engage' ? 'TƯƠNG TÁC' : 'COMMENT'} (${stamp}):\n${text || '(không bắt được nguyên văn)'}`;
  const plan = String(row.body_md ?? '');
  const bodyOut = plan.includes('— ĐÃ COMMENT') || plan.includes('— ĐÃ TƯƠNG TÁC') ? plan + block : plan + block;

  const note = {
    kind: 'plan-result', at: new Date().toISOString(), url,
    ...(b.cardId ? { cardId: Number(b.cardId) } : {}),
    ...(text ? { chars: text.length } : {}),
  };
  await db.execute(sql`
    UPDATE content_pieces
       SET publish_url = ${url},
           published_at = now(),
           status = 'published',
           body_md = ${bodyOut},
           ai_notes = coalesce(ai_notes, '[]'::jsonb) || ${JSON.stringify([note])}::jsonb,
           updated_at = now()
     WHERE id = ${pieceId}
  `);
  return NextResponse.json({ ok: true, pieceId, url });
}
