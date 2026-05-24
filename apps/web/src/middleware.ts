import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/icon.svg',
  '/favicon.ico',
];

// API routes that have their own auth (cron secret, ext key, etc.) — pass through
const PUBLIC_API_PREFIXES = [
  '/api/cron/',
  '/api/health',
  '/api/ext/',
];

const SESSION_COOKIE = 'mos2-session';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Ext-Version, X-Page-URL',
    'Access-Control-Max-Age': '86400',
  };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CORS preflight for /api/ext/* (called from browser extension cross-origin)
  if (pathname.startsWith('/api/ext/') && req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    if (pathname.startsWith('/api/ext/')) {
      Object.entries(corsHeaders()).forEach(([k, v]) => res.headers.set(k, v));
    }
    return res;
  }
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
