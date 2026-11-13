// GET /etp/du?p=<mã phiên bản>[&ng=] → số liệu trang etp2 (JSON nén gzip) — lib/etp-du-kho. Trang chỉ mang mã, khung khach tải số ở đây (anh 13/11/2026 iPhone tự tải lại vì trang 11 MB).
// Kho trong tiến trình chưa có mã (vừa khởi động lại / quá 20 phút) → đọc lại kho etp ngay, trả bản mới nhất; header x-phien = mã của bản trả về.
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { catDu, duTrang, layDu } from '@/lib/etp-du-kho';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const me = await getCurrentUser();
  const q = await quyenEtp(me);
  if (!me || !q || me.role !== 'admin') return new Response('chưa đăng nhập hoặc không có quyền etp2', { status: 401 });
  const u = new URL(req.url), p = u.searchParams.get('p') ?? '', ng = u.searchParams.get('ng') ?? undefined;
  let ma = p, gz = p ? layDu(q, p) : null;
  if (!gz) { const { du, phien } = await duTrang(q, ng); ma = await catDu(q, du, phien); gz = layDu(q, ma); }
  if (!gz) return new Response('không dựng được số liệu trang', { status: 500 });
  return new Response(new Uint8Array(gz), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-encoding': 'gzip', 'x-phien': ma, 'cache-control': 'no-store' } });
}
