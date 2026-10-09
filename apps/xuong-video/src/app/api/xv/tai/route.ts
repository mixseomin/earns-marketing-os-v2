// Tải tệp của studio (clip, bản xuất, ảnh, âm) về máy mà KHÔNG mở trang khác: proxy cùng nguồn + Content-Disposition: attachment.
// img.on.tc không trả CORS nên trình duyệt không tải blob trực tiếp được; link thẳng thì mở tab mới (anh cấm 09/10/2026).
// Chỉ cho tệp trong kho R2 của studio, chỉ người đã đăng nhập.
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const GOC = (process.env.R2_PUBLIC_BASE || 'https://img.on.tc').replace(/\/+$/, '');

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new Response('cần đăng nhập', { status: 401 });
  const u = new URL(req.url).searchParams.get('u') || '';
  if (!u.startsWith(`${GOC}/xuong-video/`)) return new Response('chỉ tải tệp của studio', { status: 400 });
  const r = await fetch(u);
  if (!r.ok || !r.body) return new Response('không tải được tệp', { status: 502 });
  const ten = decodeURIComponent(u.split('/').pop() || 'tep').replace(/[^\w.\-]/g, '_');
  return new Response(r.body, { headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'content-disposition': `attachment; filename="${ten}"`, 'cache-control': 'no-store' } });
}
