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
// Lưu ĐỦ để tháng sau đánh giá được cách làm, không chỉ để tick xong: nguyên văn mình viết, BÀI GỐC
// mình bình luận dưới (link + trích + số liệu bài lúc đó), và mốc số liệu đầu tiên của chính comment.
// Thiếu bài gốc thì cái link comment trần không nói được vì sao lượt đó đáng làm; thiếu số liệu mốc 0
// thì lần đo sau không so được với cái gì. Đo tiếp về sau: POST /api/ext/plan/track.
//
// Body: { pieceId, url, text?, cardId?, mode?, parent?: {url,text,reactions,comments,shares}, account? }
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const b = await req.json().catch(() => ({})) as {
    pieceId?: number; url?: string; text?: string; cardId?: number; mode?: string; account?: string;
    parent?: { url?: string; text?: string; reactions?: number; comments?: number; shares?: number };
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
  const p = b.parent ?? {};
  const parentStats = [p.reactions, p.comments, p.shares].some((n) => typeof n === 'number')
    ? `${p.reactions ?? '?'} cảm xúc · ${p.comments ?? '?'} bình luận · ${p.shares ?? '?'} chia sẻ`
    : '';
  const parentBlock = p.url || p.text
    ? `\n\nDƯỚI BÀI: ${String(p.text ?? '').trim().slice(0, 400) || '(không bắt được nội dung bài)'}`
      + (parentStats ? `\n(bài lúc mình vào: ${parentStats})` : '')
      + (p.url ? `\n${p.url}` : '')
    : '';
  const block = `\n\n— ĐÃ ${b.mode === 'engage' ? 'TƯƠNG TÁC' : 'COMMENT'} (${stamp}${b.account ? `, bằng ${b.account}` : ''}):\n${text || '(không bắt được nguyên văn)'}${parentBlock}`;
  const bodyOut = String(row.body_md ?? '') + block;

  const note = {
    kind: 'plan-result', at: new Date().toISOString(), url,
    mode: b.mode === 'engage' ? 'engage' : 'comment',
    ...(b.account ? { account: String(b.account) } : {}),
    ...(b.cardId ? { cardId: Number(b.cardId) } : {}),
    ...(text ? { text, chars: text.length } : {}),
    ...(p.url || p.text ? {
      parent: {
        ...(p.url ? { url: String(p.url) } : {}),
        ...(p.text ? { text: String(p.text).slice(0, 1000) } : {}),
        ...(typeof p.reactions === 'number' ? { reactions: p.reactions } : {}),
        ...(typeof p.comments === 'number' ? { comments: p.comments } : {}),
        ...(typeof p.shares === 'number' ? { shares: p.shares } : {}),
      },
    } : {}),
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
