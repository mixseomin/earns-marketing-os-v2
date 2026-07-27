// SSO trampoline for *.on.tc subdomains. nginx (course.on.tc, user.on.tc …) redirects
// unauthenticated hits here. If the user has a valid MOS2 session (its cookie is sent to
// mos2.on.tc), re-issue the cookie widened to `.on.tc` so sibling subdomains see it, then
// bounce back to `next`. Otherwise send them to /login. This avoids the host-only-cookie
// redirect loop for sessions created before the domain was widened.
import { getCurrentUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROD = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'mos2-session';

// Only allow *.on.tc absolute URLs or same-origin relative paths (no open redirect).
function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' && (u.hostname === 'on.tc' || u.hostname.endsWith('.on.tc'))) return u.toString();
  } catch { /* fall through */ }
  return '/';
}

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=' + encodeURIComponent(next), req.url));
  }
  const dest = next.startsWith('http') ? next : new URL(next, req.url).toString();
  const res = NextResponse.redirect(dest);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    res.cookies.set(SESSION_COOKIE, token, {
      path: '/',
      domain: PROD ? '.on.tc' : undefined,
      maxAge: 30 * 86400,
      httpOnly: true,
      sameSite: 'lax',
      secure: PROD,
    });
  }
  return res;
}
