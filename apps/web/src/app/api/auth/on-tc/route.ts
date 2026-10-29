// Cửa đổi "đã qua cổng Google .on.tc" → phiên MOS2. Phải là Route Handler chứ không phải trang:
// Next CẤM ghi cookie khi đang render Server Component, mà cấp phiên thì phải đặt cookie.
// Vào đây từ hai đường: trang /login thấy có cookie cổng, và cổng trả người dùng về sau khi
// đăng nhập Google xong.
import { loginWithOnTcSso, duongVe } from '@/lib/auth';
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
  // Khách một trang (users.chi_host) luôn về đúng trang của họ — next trỏ host khác thì phiên ở đó không sống, sẽ vòng lại /login mãi
  const dest = r.ok
    ? (r.chiHost ? `https://${r.chiHost}/` : next)
    : '/login?error=' + encodeURIComponent(r.error || 'Cổng SSO chưa nhận ra tài khoản — đăng nhập bằng mật khẩu.');
  return NextResponse.redirect(duongVe(dest, req.url));
}
