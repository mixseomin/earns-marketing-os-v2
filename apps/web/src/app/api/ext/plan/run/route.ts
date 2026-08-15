import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, firstRow } from '@/lib/ext-route';
import { pickThread, pickToEngage, type ThreadCandidate } from '@/lib/ai/pick-thread';
import { composeCommentCard } from '@/lib/actions/quick-comment';
import { tagVal } from '@/lib/content-channels';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/ext/plan/run — CHẠY một kế hoạch đã lên lịch.
//
// Vòng đầy đủ (chuẩn từ 2026-08-15):
//   lịch: card kế hoạch, KHÔNG có nội dung — chỉ nói "đến giờ vào <nhóm>, đọc xem đang bàn gì"
//   → ext quét bài đang có trên trang, gọi route này
//   → ở đây: chọn thread (pickThread) → soạn comment bám đúng bài đó (composeCommentCard, cùng
//     đường với nút soạn tay nên prompt/voice/persona không trôi hai bản)
//   → ext điền sẵn vào ô soạn ĐÚNG bài đó, người duyệt/sửa trong form
//   → ext bấm đăng, bắt URL + nguyên văn thật → /api/ext/plan/result ghi ngược vào card kế hoạch
//
// Body: { pieceId, threads: [{url,title,snippet,author,ageH,replies,likes}], projectId?, habitatId?, briefId? }
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const body = await req.json().catch(() => ({})) as {
    pieceId?: number; threads?: ThreadCandidate[];
    projectId?: string; habitatId?: number; briefId?: number | null;
    modelId?: string; maxChars?: number;
  };
  const pieceId = Number(body.pieceId ?? 0);
  const threads = Array.isArray(body.threads) ? body.threads.filter((t) => t && t.url) : [];
  if (!pieceId) return errorResponse('pieceId required', 400);
  if (!threads.length) return errorResponse('Không quét được bài nào trên trang — mở đúng trang nhóm rồi chạy lại', 400);

  const pieceRow = firstRow(await db.execute(sql`
    SELECT id, project_id, title, body_md, tags, status, publish_url
    FROM content_pieces WHERE id = ${pieceId} LIMIT 1
  `));
  if (!pieceRow) return errorResponse(`Không thấy card kế hoạch #${pieceId}`, 404);
  if (pieceRow.publish_url) return errorResponse('Kế hoạch này đã có kết quả rồi — không chạy lại', 409);

  const tags = Array.isArray(pieceRow.tags) ? (pieceRow.tags as string[]) : [];
  const kind = tagVal(tags, 'format') || 'comment';
  const place = tagVal(tags, 'place');
  const plan = String(pieceRow.body_md ?? '');
  const projectId = String(body.projectId || pieceRow.project_id || '');

  // TƯƠNG TÁC: luật rõ ràng (ít like + còn mới) thì tính bằng code, đừng đốt một lượt gọi model.
  if (kind === 'engage') {
    const picks = pickToEngage(threads);
    await noteRun(db, pieceId, { kind: 'plan-run', mode: 'engage', at: new Date().toISOString(), picked: picks.length });
    return NextResponse.json({
      ok: true, mode: 'engage', place,
      targets: picks,
      why: picks.length
        ? `${picks.length} bài ít tương tác nhất còn trong 24h — thả cảm xúc ở đây thì tên mình nằm trong nhóm vài người đầu tiên`
        : 'không có bài nào vừa mới vừa ít tương tác — bỏ lượt này',
    });
  }

  // Ngữ cảnh dự án: để model biết cái gì mới là đóng góp thật, không phải quảng cáo.
  const ctxRow = firstRow(await db.execute(sql`
    SELECT name, coalesce(one_liner, '') AS one_liner FROM projects WHERE id = ${projectId} LIMIT 1
  `));
  const pick = await pickThread({
    plan, place,
    context: ctxRow ? `${ctxRow.name}${ctxRow.one_liner ? ` — ${ctxRow.one_liner}` : ''}` : undefined,
    threads,
  });
  if (!pick.ok) return errorResponse(pick.error || 'không chọn được bài', 502);
  if (pick.index == null) {
    await noteRun(db, pieceId, { kind: 'plan-run', mode: 'skip', at: new Date().toISOString(), why: pick.why });
    return NextResponse.json({ ok: true, mode: 'skip', why: pick.why || 'không bài nào đáng comment lúc này' });
  }
  const chosen = threads[pick.index]!;

  // habitatId: ext gửi khi crew bar đã nhận diện được cộng đồng; chưa nhận ra thì tra bằng chính
  // NƠI ĐĂNG ghi trên kế hoạch (place). Không có bước này thì chạy kế hoạch ở trang mà detector
  // chưa kịp gắn habitat sẽ hỏng với lỗi "habitatId required" — trong khi dữ liệu vẫn đủ.
  let habitatId = Number(body.habitatId ?? 0) || 0;
  if (!habitatId && place) {
    const hostPath = place.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    const hit = firstRow(await db.execute(sql`
      SELECT id FROM habitats
       WHERE project_id = ${projectId}
         AND regexp_replace(regexp_replace(coalesce(url,''), '^https?://(www\.)?', ''), '/+$', '') = ${hostPath}
       LIMIT 1`));
    if (hit) habitatId = Number(hit.id);
  }
  if (!habitatId) return errorResponse(`Kế hoạch #${pieceId} chưa gắn được cộng đồng nào trong MOS2 (place: ${place || 'trống'})`, 400);

  // Soạn nháp bám ĐÚNG bài vừa chọn — cùng đường với nút soạn tay (composeCommentCard).
  const composed = await composeCommentCard({
    habitatId, projectId, briefId: body.briefId ?? null,
    contentType: 'comment',
    parentUrl: chosen.url, parentTitle: chosen.title, parentBody: chosen.snippet, parentAuthor: chosen.author,
    modelId: body.modelId, maxChars: body.maxChars,
  });
  if (!composed.ok) return errorResponse(composed.error, composed.status);

  await noteRun(db, pieceId, {
    kind: 'plan-run', mode: 'comment', at: new Date().toISOString(),
    threadUrl: chosen.url, threadTitle: chosen.title ?? '', why: pick.why, cardId: composed.cardId,
  });

  return NextResponse.json({
    ok: true, mode: 'comment', place,
    threadUrl: chosen.url, threadTitle: chosen.title ?? '', why: pick.why,
    cardId: composed.cardId, draft: composed.bodyTarget, draftReview: composed.bodyReview,
    targetLang: composed.targetLang, contextUsed: composed.contextUsed,
  });
}

/** Ghi lại LƯỢT CHẠY vào ai_notes (mảng object có `kind`, cùng quy ước với ext-post-gen).
 *  Bỏ lượt cũng ghi — sau này nhìn lại phải biết hôm đó máy vào nhóm và quyết định không nói gì. */
async function noteRun(db: NonNullable<ReturnType<typeof getDb>>, pieceId: number, note: Record<string, unknown>) {
  await db.execute(sql`
    UPDATE content_pieces
       SET ai_notes = coalesce(ai_notes, '[]'::jsonb) || ${JSON.stringify([note])}::jsonb,
           updated_at = now()
     WHERE id = ${pieceId}
  `);
}
