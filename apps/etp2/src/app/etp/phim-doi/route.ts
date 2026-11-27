// GET /etp/phim-doi → phim đội có camp, nhà chưa có (khối đầu tab Camp › Theo phim — anh 27/11/2026); lib/etp-phim-doi.
import { getCurrentUser } from '@/lib/auth';
import { dsPhimDoi } from '@/lib/etp-phim-doi';
export const dynamic = 'force-dynamic';
export async function GET() {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return Response.json({ loi: 'chỉ admin' }, { status: 401 });
  try { return Response.json({ ds: await dsPhimDoi() }); }
  catch (e) { return Response.json({ loi: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
