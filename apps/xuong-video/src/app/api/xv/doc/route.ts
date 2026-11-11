// Đường đọc song song cho các hàm trong lib/doc-ham.ts (POST thường — không xếp hàng như server action). Lỗi trả 500 kèm câu lỗi.
import { HAM_DOC } from '@/lib/doc-ham';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const { ham, args } = (await req.json().catch(() => ({}))) as { ham?: string; args?: unknown[] };
  const f = ham && Object.hasOwn(HAM_DOC, ham) ? (HAM_DOC as Record<string, (...a: unknown[]) => Promise<unknown>>)[ham] : null;
  if (!f) return Response.json({ loi: `không có hàm đọc '${ham}'` }, { status: 400 });
  try { return Response.json({ kq: (await f(...(Array.isArray(args) ? args : []))) ?? null }, { headers: { 'cache-control': 'no-store' } }); }
  catch (e) { return Response.json({ loi: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
