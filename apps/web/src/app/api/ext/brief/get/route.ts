import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { firstRow, errorResponse } from '@/lib/ext-route';

// GET /api/ext/brief/get?briefId=X
// Trả nội dung 5 field text của brief để ext side panel render textarea
// editable cho user fine-tune "tại thực địa" trước khi gen draft.
//
// Lưu ý: KHÔNG mutate DB từ đây — edit chỉ tồn tại trong ext memory + gửi
// kèm briefOverride khi POST sang quick-comment/astrolas-answer.

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const briefId = Number(url.searchParams.get('briefId') ?? 0);
  if (!briefId) {
    return errorResponse('briefId required', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const rows = await db.execute(sql`
    SELECT
      b.id, b.tone, b.approach_md, b.do_md, b.dont_md, b.narrative_md,
      b.current_phase, b.habitat_id,
      h.name AS habitat_name
    FROM community_briefs b
    LEFT JOIN habitats h ON h.id = b.habitat_id
    WHERE b.id = ${briefId}
    LIMIT 1
  `);
  const r = firstRow(rows);
  if (!r) {
    return errorResponse('Brief not found', 404);
  }

  return NextResponse.json({
    ok: true,
    brief: {
      id: Number(r.id),
      habitatId: r.habitat_id ? Number(r.habitat_id) : null,
      habitatName: r.habitat_name ? String(r.habitat_name) : null,
      currentPhase: String(r.current_phase ?? ''),
      tone: String(r.tone ?? ''),
      approach_md: String(r.approach_md ?? ''),
      do_md: String(r.do_md ?? ''),
      dont_md: String(r.dont_md ?? ''),
      narrative_md: String(r.narrative_md ?? ''),
    },
  });
}
