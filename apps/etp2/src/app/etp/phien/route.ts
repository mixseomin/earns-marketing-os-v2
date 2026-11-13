// GET /etp/phien[?ng=] → mã phiên bản dữ liệu trang etp2 (lib/etp-phien). Trang hỏi mỗi phút, khác mã đang cầm mới router.refresh.
// ĐANG ĐỒNG BỘ → trả 'dang' (#1582 anh 13/11/2026 "load chậm quá"): dong-bo.py ghi kho dần trong ~5 phút của mỗi 10 phút, mã băm đổi từng phút
// → trang tải lại ~940 KB mỗi phút (đo 05:51–06:51: 40 lượt / 60 phút), điện thoại đứng ~10 giây mỗi lượt. Giờ chờ lượt xong mới làm mới một lần, và bỏ docEtp lúc đó.
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { dangDongBo } from '@/lib/etp-phien';
import { duTrang } from '@/lib/etp-du-kho';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const me = await getCurrentUser();
  const q = await quyenEtp(me);
  if (!me || !q || me.role !== 'admin') return new Response('', { status: 401 });
  const ng = new URL(req.url).searchParams.get('ng') ?? undefined;
  const ma = (await dangDongBo()) ? 'dang' : (await duTrang(q, ng)).phien;   // chung lượt đọc với trang + /etp/du (lib/etp-du-kho)
  return new Response(ma, { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}
