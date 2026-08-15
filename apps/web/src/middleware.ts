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
  '/api/auth/', // /api/auth/verify runs its own session check (204/401) for nginx auth_request SSO — must not be redirected
  '/api/review', // generic review queue — does its own auth (agent token OR session)
  // Cửa CÔNG KHAI duy nhất: trang landing gửi email + phản hồi người đọc vào đây. Chỉ NHẬN (POST),
  // không trả dữ liệu nào ra; tự chặn theo IP + bẫy bot. Xem app/api/public/lead/route.ts.
  '/api/public/',
  // Favicon của platform: ẢNH công khai, không đọc/ghi dữ liệu nào của tenant (chỉ tra platforms.key
  // → bytes icon). Để sau tường đăng nhập thì <img> trả 307 về /login, icon không hiện và trình duyệt
  // cũng không cache được — tức là hỏng đúng cái nó sinh ra để làm.
  '/api/platform-icon/',
];

// Nền tảng network affiliate ở SUBDOMAIN RIÊNG, mỗi host một vai — đúng nếp net VN (pub.* cho
// publisher, backend admin ở host khác). Cùng một app, khoá theo host: publisher vào nhầm cửa
// admin thì không phải "thấy nút mà bấm không được", mà là không tới được trang đó.
const PUB_PORTAL_HOST = 'pub.on.tc';     // portal publisher
const NET_ADMIN_HOST = 'nadm.on.tc';     // backend admin của network
function allowedOnNetHost(pathname: string, admin: boolean): boolean {
  // /c/* và /t/* (redirect) phải sống trên MỌI host: link publisher đã phát ra ngoài rồi, đổi host là gãy.
  if (pathname.startsWith('/c/') || pathname.startsWith('/t/')) return true;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/static/')
      || pathname === '/login' || pathname.startsWith('/api/auth')
      || pathname === '/icon.svg' || pathname === '/favicon.ico') return true;
  return pathname.startsWith(admin ? '/network' : '/pub');
}

// user.on.tc = staff review portal. Confine that host to the review queue only (need-to-know):
// staff can't reach the rest of MOS2 there even though the .on.tc session is shared.
const STAFF_PORTAL_HOST = 'user.on.tc';
function allowedOnStaffPortal(pathname: string): boolean {
  return pathname.startsWith('/review') || pathname.startsWith('/api/review')
    || pathname.startsWith('/api/auth') || pathname === '/login'
    || pathname.startsWith('/_next/') || pathname.startsWith('/static/')
    || pathname === '/icon.svg' || pathname === '/favicon.ico';
}

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

  // Staff portal host is confined to the review queue (need-to-know).
  const host = (req.headers.get('host') || '').split(':')[0];
  if (host === STAFF_PORTAL_HOST && !allowedOnStaffPortal(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/review';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (host === PUB_PORTAL_HOST || host === NET_ADMIN_HOST) {
    const admin = host === NET_ADMIN_HOST;
    if (!allowedOnNetHost(pathname, admin)) {
      const url = req.nextUrl.clone();
      url.pathname = admin ? '/network' : '/pub';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // Cổng redirect: khách của publisher bấm vào, không thể bắt họ đăng nhập. Route tự lo phần
  // kiểm tra (chiến dịch còn chạy + publisher đã được duyệt) nên đây chỉ cần cho qua.
  if (pathname.startsWith('/c/') || pathname.startsWith('/t/')) return NextResponse.next();

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
