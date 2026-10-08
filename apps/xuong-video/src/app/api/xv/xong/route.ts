// Worker xv-worker báo kết quả một việc ảnh về đây (POST, header x-xv-secret). Không qua SSO: khoá bí mật chung là cổng.
import { timingSafeEqual } from 'node:crypto';
import { hoanTatViec } from '@/lib/xuong-video/hoan-tat';
import type { KqViec } from '@/lib/xuong-video/viec-anh';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const khoa = process.env.XV_WORKER_SECRET || '';
  const gui = req.headers.get('x-xv-secret') || '';
  if (!khoa || gui.length !== khoa.length || !timingSafeEqual(Buffer.from(gui), Buffer.from(khoa))) return new Response('forbidden', { status: 403 });
  const kq = (await req.json().catch(() => null)) as KqViec | null;
  if (!kq || typeof kq.job !== 'number') return new Response('bad request', { status: 400 });
  if (kq.job === 0) { console.log('[xuong-video] hàng đợi → Worker → studio thông:', JSON.stringify(kq)); return Response.json({ ok: true, thu: true }); }
  return Response.json({ ok: true, ghi: await hoanTatViec(kq) });
}
