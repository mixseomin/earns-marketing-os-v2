import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, firstRow } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/plan/status — runner báo ĐANG LÀM GÌ, ngay lúc đang làm.
//
// Một lượt tại chỗ mất vài phút: mở nhóm, đọc, chọn bài, soạn, chờ duyệt, gửi. Trong lúc đó lịch
// plays không nói gì cả, nhìn vào tưởng chưa ai đụng. Ghi mốc sống ở đây để dock trên /plays hiện
// "đang làm nhóm nào, tới bước nào", và để lượt sau biết lượt trước chết ở bước nào.
//
// Body: { pieceId, stage, note? }   stage='' hoặc 'xong' = gỡ mốc sống.
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const b = await req.json().catch(() => ({})) as { pieceId?: number; stage?: string; note?: string };
  const pieceId = Number(b.pieceId ?? 0);
  if (!pieceId) return errorResponse('pieceId required', 400);
  const stage = String(b.stage ?? '').trim();

  const row = firstRow(await db.execute(sql`SELECT id FROM content_pieces WHERE id = ${pieceId} LIMIT 1`));
  if (!row) return errorResponse(`Không thấy card #${pieceId}`, 404);

  const note = {
    kind: 'plan-live', at: new Date().toISOString(), stage,
    ...(b.note ? { note: String(b.note).slice(0, 200) } : {}),
  };
  await db.execute(sql`
    UPDATE content_pieces
       SET ai_notes = coalesce(ai_notes, '[]'::jsonb) || ${JSON.stringify([note])}::jsonb,
           updated_at = now()
     WHERE id = ${pieceId}
  `);
  return NextResponse.json({ ok: true, pieceId, stage });
}
