// Proxy ảnh reply — nhận multipart từ drawer, chuyển nguyên file sang kho nháp adfond.
// Route handler chứ không server action: action mặc định chặn body 1MB, đúng cỡ một ảnh.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!process.env.ADFOND_EXT_KEY) return NextResponse.json({ error: 'Chưa có ADFOND_EXT_KEY trong env.' }, { status: 503 });
  const f = (await req.formData().catch(() => null))?.get('file');
  if (!(f instanceof File)) return NextResponse.json({ error: 'Thiếu file.' }, { status: 400 });
  const fd = new FormData();
  fd.set('file', f);
  const r = await fetch(`${process.env.ADFOND_EXT_URL || 'http://127.0.0.1:3832'}/api/ext/trao-doi/anh`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.ADFOND_EXT_KEY}` },
    body: fd, signal: AbortSignal.timeout(15000),
  });
  return NextResponse.json(await r.json().catch(() => ({ error: `adfond trả ${r.status}` })), { status: r.status });
}
