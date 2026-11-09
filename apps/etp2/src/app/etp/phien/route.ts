// GET /etp/phien[?ng=] → mã phiên bản dữ liệu trang etp2 (lib/etp-phien). Trang hỏi mỗi phút, khác mã đang cầm mới router.refresh.
import { getCurrentUser } from '@/lib/auth';
import { docEtp } from '@/lib/etp-doc';
import { ngCua, quyenEtp } from '@/lib/etp-quyen';
import { phienDu } from '@/lib/etp-phien';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const me = await getCurrentUser();
  const q = await quyenEtp(me);
  if (!me || !q || me.role !== 'admin') return new Response('', { status: 401 });
  const ng = new URL(req.url).searchParams.get('ng') ?? undefined;
  return new Response(phienDu(await docEtp(ngCua(q, ng), true)), { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}
