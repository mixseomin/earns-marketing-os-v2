// Proxy BỘ LUẬT ĐIỀU HÀNH camp — tab "Luật camp" trên trang chủ đọc + sửa cấu hình nằm bên
// be.adfond (nguồn duy nhất: luat-camp.ts + bảng luat_cau_hinh). MOS2 không giữ bản sao nào:
// mỗi lượt mở đọc lại, mỗi lần lưu đi qua kiemLuat() bên kia. Khuôn trao-doi: trình duyệt gọi
// same-origin (phiên MOS2 gác), server cầm ADFOND_EXT_KEY — khoá không ra trình duyệt.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GOC = () => process.env.ADFOND_EXT_URL || 'http://127.0.0.1:3832';
const dau = () => ({ Authorization: `Bearer ${process.env.ADFOND_EXT_KEY ?? ''}` });

async function chuyen(method: 'GET' | 'PUT' | 'DELETE', qs: string, body?: unknown) {
  const r = await fetch(`${GOC()}/api/ext/luat${qs}`, {
    method, headers: { ...dau(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({ error: `adfond trả ${r.status}` })), { status: r.status });
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!process.env.ADFOND_EXT_KEY) return NextResponse.json({ error: 'Chưa có ADFOND_EXT_KEY trong env.' }, { status: 503 });
  return chuyen('GET', new URL(req.url).search);
}

// Sửa luật = đổi cách máy tiêu tiền → admin. Chặn ở đây vì đây là điểm thắt duy nhất cầm
// khoá adfond (cửa ext bên kia không biết vai trò MOS2).
async function ghi(req: Request, method: 'PUT' | 'DELETE') {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (me.role !== 'admin') return NextResponse.json({ error: 'Sửa bộ luật là quyền admin.' }, { status: 403 });
  if (!process.env.ADFOND_EXT_KEY) return NextResponse.json({ error: 'Chưa có ADFOND_EXT_KEY trong env.' }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return chuyen(method, '', { ...b, nguoi: me.displayName || me.name || me.email });
}
export async function PUT(req: Request) { return ghi(req, 'PUT'); }
export async function DELETE(req: Request) { return ghi(req, 'DELETE'); }
