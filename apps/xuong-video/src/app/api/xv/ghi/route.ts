// Đường GHI cho Studio 2 (trang tĩnh studio2.on.tc gọi các bước làm phim): POST { ham, args } → chạy hàm trong sổ lib/ghi-ham.ts, trả { kq }.
// Mỗi hàm tự kiểm quyền + cổng quy trình + cổng tiền như trên studio. Chống gọi chéo trang: chỉ nhận JSON thật (trang lạ muốn gửi JSON thì trình duyệt
// hỏi trước và bị từ chối vì ở đây không mở CORS) + nguồn phải là studio2 / studio.
import { HAM_GHI } from '@/lib/ghi-ham';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const NGUON = new Set(['https://studio2.on.tc', 'https://studio.on.tc']);

export async function POST(req: Request) {
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return Response.json({ loi: 'chỉ nhận application/json' }, { status: 415 });
  const nguon = req.headers.get('origin');
  if (nguon && !NGUON.has(nguon)) return Response.json({ loi: 'nguồn không được phép' }, { status: 403 });
  const { ham, args } = (await req.json().catch(() => ({}))) as { ham?: string; args?: unknown[] };
  const f = ham && Object.hasOwn(HAM_GHI, ham) ? (HAM_GHI as Record<string, (...a: unknown[]) => Promise<unknown>>)[ham] : null;
  if (!f) return Response.json({ loi: `không có hàm ghi '${ham}'` }, { status: 400 });
  try { return Response.json({ kq: (await f(...(Array.isArray(args) ? args : []))) ?? null }, { headers: { 'cache-control': 'no-store' } }); }
  catch (e) { console.error('[studio2 ghi]', ham, e); return Response.json({ loi: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
