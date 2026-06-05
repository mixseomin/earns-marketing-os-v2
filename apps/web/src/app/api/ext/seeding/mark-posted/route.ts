import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { confirmCardPosted } from '@/lib/actions/seeding';

// POST /api/ext/seeding/mark-posted
// Body: { cardId, postUrl, note? }
// Ext sau khi user copy + paste vào Reddit + đăng thành công → POST đây.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    cardId?: number;
    postUrl?: string;
    note?: string;
    bodyFinal?: string;   // bản user ĐÃ SỬA trước khi gửi → lưu lại để tracking đúng thực tế
  };
  const cardId = Number(body.cardId ?? 0);
  const postUrl = String(body.postUrl ?? '').trim();
  if (!cardId || !postUrl) {
    return NextResponse.json({ ok: false, error: 'cardId + postUrl required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // Lưu bản cuối (đã sửa tay) vào body_target → card phản ánh đúng cái đã đăng.
  const bf = (body.bodyFinal ?? '').trim();
  if (bf) {
    await db.execute(sql`UPDATE cards SET body_target = ${bf.slice(0, 8000)}, updated_at = NOW() WHERE id = ${cardId}`);
  }

  // Lookup project_id + brief_id từ card
  const rows = await db.execute(sql`
    SELECT project_id, brief_id FROM cards WHERE id = ${cardId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return NextResponse.json({ ok: false, error: 'Card not found' }, { status: 404 });

  const projectId = String(r.project_id);
  const briefId = r.brief_id ? Number(r.brief_id) : 0;
  if (!briefId) {
    return NextResponse.json({ ok: false, error: 'Card không thuộc brief nào' }, { status: 400 });
  }

  const res = await confirmCardPosted(projectId, briefId, cardId, {
    postUrl,
    postNote: body.note ?? null,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
