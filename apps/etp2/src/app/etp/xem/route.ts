// GET /etp/xem?f=<content_id>/<tệp>.jpg → ảnh xem trước bản soạn creative / ảnh nhỏ khung ứng viên (máy dựng trên iMac đẩy lên box3 /var/lib/etp-xem — dung-mau.py --xem-soan).
// Chỉ admin etp2; tên tệp chỉ nhận dạng <số>/[k/]<chữ-số-gạch>.jpg (không ra ngoài thư mục).
import { readFile } from 'node:fs/promises';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
export const dynamic = 'force-dynamic';
const GOC = '/var/lib/etp-xem';
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin' || !(await quyenEtp(me))) return new Response('chưa đăng nhập hoặc không có quyền etp2', { status: 401 });
  const f = new URL(req.url).searchParams.get('f') ?? '';
  if (!/^\d+\/(k\/)?[A-Za-z0-9_-]+\.jpg$/.test(f)) return new Response('tên tệp không hợp lệ', { status: 400 });
  try {
    const b = await readFile(`${GOC}/${f}`);
    return new Response(new Uint8Array(b), { headers: { 'content-type': 'image/jpeg', 'content-length': String(b.length), 'cache-control': 'private, max-age=3600' } });
  } catch { return new Response(`chưa có ảnh ${f} trên máy chủ (máy dựng chưa đẩy lên)`, { status: 404 }); }
}
