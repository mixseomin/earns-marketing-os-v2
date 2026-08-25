// Proxy trao đổi góp ý adfond — drawer card GÓP Ý trên /plays đọc + reply luồng trao đổi
// NGAY TRONG DRAWER (khuôn ai-tasks Astrolas: mọi thứ một chỗ), không bắt người phụ trách
// nhảy sang backend adfond. Trình duyệt gọi same-origin vào đây (phiên MOS2 gác cửa);
// server cầm ADFOND_EXT_KEY gọi tiếp vào be.adfond.com — khoá không bao giờ ra trình duyệt.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GOC = () => process.env.ADFOND_EXT_URL || 'http://127.0.0.1:3832';
const dau = () => ({ Authorization: `Bearer ${process.env.ADFOND_EXT_KEY ?? ''}` });

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!process.env.ADFOND_EXT_KEY) return NextResponse.json({ error: 'Chưa có ADFOND_EXT_KEY trong env.' }, { status: 503 });
  const feedback = new URL(req.url).searchParams.get('feedback') ?? '';
  const r = await fetch(`${GOC()}/api/ext/trao-doi?feedback=${encodeURIComponent(feedback)}`, {
    headers: dau(), signal: AbortSignal.timeout(8000), cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({ error: `adfond trả ${r.status}` })), { status: r.status });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!process.env.ADFOND_EXT_KEY) return NextResponse.json({ error: 'Chưa có ADFOND_EXT_KEY trong env.' }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Duyệt = chữ ký nghiệm thu — admin-only, CHẶN Ở ĐÂY vì đây là điểm thắt duy nhất cầm
  // khoá adfond (cửa ext bên kia không biết vai trò MOS2; layout chỉ chắn trang, không
  // chắn route handler — operator/viewer POST thẳng vẫn tới được đây).
  if (b.xuLy === 'duyet' && me.role !== 'admin') {
    return NextResponse.json({ error: 'Duyệt xong là quyền admin.' }, { status: 403 });
  }
  // nguoi lấy từ PHIÊN MOS2, không tin client — reply đứng tên người đang đăng nhập.
  const body = { ...b, nguoi: me.displayName || me.name || me.email };
  const r = await fetch(`${GOC()}/api/ext/trao-doi`, {
    method: 'POST', headers: { ...dau(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  return NextResponse.json(await r.json().catch(() => ({ error: `adfond trả ${r.status}` })), { status: r.status });
}
