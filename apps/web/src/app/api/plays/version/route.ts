import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Dấu vân tay của bảng Plays (task + bài): số dòng + mốc sửa mới nhất. Trang Plays poll cái này (≈100 byte) mỗi 10s
// và chỉ router.refresh() khi dấu đổi — trước đây refresh mù mỗi 10s = kéo lại 3,6 MB payload, điện thoại nóng
// (đo 20/09/2026: 7 lần/40s). ?project=<id> giới hạn theo dự án; bỏ trống = mọi dự án.
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return new NextResponse(null, { status: 401 });
  const project = new URL(req.url).searchParams.get('project') || null;
  const db = getDb();
  if (!db) return NextResponse.json({ v: 'nodb' }, { headers: { 'cache-control': 'no-store' } });
  const w = project ? sql`WHERE project_id = ${project}` : sql``;
  const r = await db.execute(sql`
    SELECT (SELECT count(*)::int FROM human_tasks ${w}) AS tc, (SELECT max(updated_at) FROM human_tasks ${w}) AS tu,
           (SELECT count(*)::int FROM content_pieces ${w}) AS pc, (SELECT max(updated_at) FROM content_pieces ${w}) AS pu`);
  const row = (r as unknown as Record<string, unknown>[])[0] ?? {};   // db.execute trả mảng dòng (như lib/tien-do.ts)
  const v = `${row.tc}:${String(row.tu ?? '')}:${row.pc}:${String(row.pu ?? '')}`;
  return NextResponse.json({ v }, { headers: { 'cache-control': 'no-store' } });
}
