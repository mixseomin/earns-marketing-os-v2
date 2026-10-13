// Ảnh nhỏ của kho studio (lib/xuong-video/anh-nho.ts): bảo đảm có bản nhỏ trên R2 (anh-nho-may.ts) → 302 tới bản đó, trình duyệt nhớ
// chuyển hướng 1 năm (ảnh gốc trên R2 không bao giờ đổi nội dung ở cùng url). Hỏng thì chuyển về ảnh gốc, không nhớ.
import { getCurrentUser } from '@/lib/auth';
import { CO_NHO, type CoNho } from '@/lib/xuong-video/anh-nho';
import { damBaoNho, laAnhKho } from '@/lib/xuong-video/anh-nho-may';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new Response('cần đăng nhập', { status: 401 });
  const q = new URL(req.url).searchParams;
  const u = q.get('u') || ''; const w = Number(q.get('w')) as CoNho;
  if (!laAnhKho(u) || !CO_NHO.includes(w)) return new Response('chỉ ảnh của studio, rộng 160/320/640', { status: 400 });
  const nho = await damBaoNho(u, w);
  if (!nho) { console.error('[ảnh nhỏ] không thu nhỏ được — trả ảnh gốc', u); return Response.redirect(u, 302); }
  return new Response(null, { status: 302, headers: { location: nho, 'cache-control': 'public, max-age=31536000, immutable' } });
}
