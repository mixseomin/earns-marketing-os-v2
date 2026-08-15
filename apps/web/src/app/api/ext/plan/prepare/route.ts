import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, firstRow } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/plan/prepare — chốt BÀI ĐÃ CHỌN lên card NGAY khi chọn xong, trước lúc gửi.
//
// Hai lý do, cả hai đều đã cắn:
//  · Browser thoát/hết phiên giữa chừng là mất sạch phần đã đọc và đã soạn — chỉ còn cái thẻ trống.
//    Ghi trước thì lượt sau mở card ra là đọc tiếp được, không phải dò lại từ đầu.
//  · Muốn duyệt được "comment này có bám bài không" thì phải thấy Ý CHÍNH bài gốc + nguồn nó dẫn,
//    đặt cạnh câu mình định viết. Chỉ có cái link bài gốc thì người duyệt phải tự mở ra đọc.
//
// KHÔNG đụng publish_url/status: đây mới là chuẩn bị. Đóng card vẫn phải qua /plan/result với link
// thật. Gọi lại nhiều lần thì ghi đè đúng khối CHUẨN BỊ, không nối chồng.
//
// Body: { pieceId, parent: {url,text,reactions,comments,shares}, points?: string[], source?, draft? }
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const b = await req.json().catch(() => ({})) as {
    pieceId?: number; points?: string[]; source?: string; draft?: string;
    parent?: { url?: string; text?: string; reactions?: number; comments?: number; shares?: number };
  };
  const pieceId = Number(b.pieceId ?? 0);
  if (!pieceId) return errorResponse('pieceId required', 400);
  const p = b.parent ?? {};
  if (!p.url && !p.text) return errorResponse('parent.url hoặc parent.text required — chuẩn bị mà không nói chọn bài nào thì vô nghĩa', 400);

  const row = firstRow(await db.execute(sql`
    SELECT id, body_md FROM content_pieces WHERE id = ${pieceId} LIMIT 1
  `));
  if (!row) return errorResponse(`Không thấy card kế hoạch #${pieceId}`, 404);

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const stats = [p.reactions, p.comments, p.shares].some((n) => typeof n === 'number')
    ? `(bài lúc mình vào: ${p.reactions ?? '?'} cảm xúc · ${p.comments ?? '?'} bình luận · ${p.shares ?? '?'} chia sẻ)`
    : '';
  const points = (b.points ?? []).map((s) => String(s).trim()).filter(Boolean);
  const draft = String(b.draft ?? '').trim();
  const block = [
    `CHUẨN BỊ (${stamp}):`,
    `BÀI GỐC: ${String(p.text ?? '').trim().slice(0, 600) || '(không bắt được nội dung bài)'}`,
    stats,
    p.url ?? '',
    b.source ? `NGUỒN: ${String(b.source).trim()}` : '',
    points.length ? `Ý CHÍNH BÀI GỐC:\n${points.map((s) => `- ${s}`).join('\n')}` : '',
    draft ? `DỰ ĐỊNH VIẾT:\n${draft}` : '',
  ].filter(Boolean).join('\n');

  // Khối CHUẨN BỊ nằm giữa phần kế hoạch và phần đã-làm; ghi lại thì thay đúng nó, giữ nguyên hai đầu.
  const body = String(row.body_md ?? '');
  const iPrep = body.indexOf('CHUẨN BỊ (');
  const iDone = body.search(/—\s*ĐÃ (COMMENT|TƯƠNG TÁC)/);
  const head = (iPrep >= 0 ? body.slice(0, iPrep) : (iDone >= 0 ? body.slice(0, iDone) : body)).replace(/\s+$/, '');
  const tail = iDone >= 0 ? `\n\n${body.slice(iDone)}` : '';
  const bodyOut = `${head}\n\n${block}${tail}`.replace(/^\n+/, '');

  const note = {
    kind: 'plan-prepare', at: new Date().toISOString(),
    ...(p.url ? { parentUrl: String(p.url) } : {}),
    ...(b.source ? { source: String(b.source) } : {}),
    ...(points.length ? { points } : {}),
    ...(draft ? { draft } : {}),
  };
  await db.execute(sql`
    UPDATE content_pieces
       SET body_md = ${bodyOut},
           ai_notes = coalesce(ai_notes, '[]'::jsonb) || ${JSON.stringify([note])}::jsonb,
           updated_at = now()
     WHERE id = ${pieceId}
  `);
  return NextResponse.json({ ok: true, pieceId, points: points.length, hasDraft: !!draft });
}
