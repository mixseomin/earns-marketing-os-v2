// Cửa đổi "đã qua cổng Google .on.tc" → phiên MOS2. Phải là Route Handler chứ không phải trang:
// Next CẤM ghi cookie khi đang render Server Component, mà cấp phiên thì phải đặt cookie.
// Vào đây từ hai đường: trang /login thấy có cookie cổng, và cổng trả người dùng về sau khi
// đăng nhập Google xong.
import { loginWithOnTcSso } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/api/auth/on-tc')) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' && (u.hostname === 'on.tc' || u.hostname.endsWith('.on.tc'))) return u.toString();
  } catch { /* rơi về / */ }
  return '/';
}

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const r = await loginWithOnTcSso();
  const dest = r.ok
    ? next
    : '/login?error=' + encodeURIComponent(r.error || 'Cổng SSO chưa nhận ra tài khoản — đăng nhập bằng mật khẩu.');
  return NextResponse.redirect(dest.startsWith('http') ? dest : new URL(dest, req.url));
}
