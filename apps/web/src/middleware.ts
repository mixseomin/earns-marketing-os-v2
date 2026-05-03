import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/icon.svg',
  '/favicon.ico',
];

// API routes that have their own auth (cron secret, etc.) — pass through
const PUBLIC_API_PREFIXES = [
  '/api/cron/',
  '/api/health',
];

const SESSION_COOKIE = 'mos2-session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/_next/') || pathname.startsWith('/static/')) return NextResponse.next();

  // Check session cookie (presence only — DB validation happens in pages via getCurrentUser)
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
