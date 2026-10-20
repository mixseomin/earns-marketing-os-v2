// Token PlenX cho Worker ảnh xv-worker (Cloudflare — không có tệp token trên box): GET + header x-xv-secret (cùng khoá bí mật của /api/xv/xong).
// Trả access_token còn hạn (cong-plenxai.ts › layToken tự xoay). Không qua SSO: khoá bí mật chung là cổng.
import { timingSafeEqual } from 'node:crypto';
import { layToken } from '@/lib/xuong-video/cong-plenxai';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const khoa = process.env.XV_WORKER_SECRET || '';
  const gui = req.headers.get('x-xv-secret') || '';
  if (!khoa || gui.length !== khoa.length || !timingSafeEqual(Buffer.from(gui), Buffer.from(khoa))) return new Response('forbidden', { status: 403 });
  try { return Response.json({ access_token: await layToken() }); } catch (e) { return Response.json({ loi: e instanceof Error ? e.message : String(e) }, { status: 503 }); }
}
