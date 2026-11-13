// GET /etp/du?p=<mã phiên bản>&phan=chinh|phu[&ng=] → số liệu trang etp2, nén sẵn (brotli nếu trình duyệt nhận và đã nén xong, không thì gzip) — lib/etp-du-kho.
// Kho trong tiến trình chưa có mã (vừa khởi động lại / quá 20 phút) → đọc lại kho etp ngay, trả bản mới nhất; header x-phien = mã của bản trả về,
// x-tho = cỡ JSON chưa nén (trình duyệt tính % đã tải — anh 13/11/2026 "Ko load nổi": mạng iPhone ~20 KB/giây, cần thấy trang đang chạy).
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { catDu, duTrang, layDu, type PhanDu } from '@/lib/etp-du-kho';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const me = await getCurrentUser();
  const q = await quyenEtp(me);
  if (!me || !q || me.role !== 'admin') return new Response('chưa đăng nhập hoặc không có quyền etp2', { status: 401 });
  const u = new URL(req.url), p = u.searchParams.get('p') ?? '', ng = u.searchParams.get('ng') ?? undefined;
  const phan: PhanDu = u.searchParams.get('phan') === 'phu' ? 'phu' : 'chinh';
  let ma = p, b = p ? layDu(q, p, phan) : null;
  if (!b) { const { du, phien } = await duTrang(q, ng); ma = await catDu(q, du, phien); b = layDu(q, ma, phan); }
  if (!b) return new Response('không dựng được số liệu trang', { status: 500 });
  const br = !!b.br && /\bbr\b/.test(req.headers.get('accept-encoding') ?? '');
  const than = br ? b.br! : b.gz;
  return new Response(new Uint8Array(than), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-encoding': br ? 'br' : 'gzip', 'content-length': String(than.length),
    'x-phien': ma, 'x-tho': String(b.tho), vary: 'Accept-Encoding',
    // đúng mã đã hỏi = nội dung cố định theo mã → trình duyệt giữ 20 phút, mở lại trang khi số chưa đổi không tải lại; bản đọc lại (mã khác) thì không giữ
    'cache-control': ma === p ? 'private, max-age=1200, immutable' : 'no-store' } });
}
