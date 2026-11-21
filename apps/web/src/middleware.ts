import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/icon.svg',
  '/favicon.ico',
  '/manifest.webmanifest',   // PWA: iPhone đọc khi "Thêm vào MH chính" — trước đăng nhập, không chứa dữ liệu
];

// API routes that have their own auth (cron secret, ext key, etc.) — pass through
const PUBLIC_API_PREFIXES = [
  '/api/cron/',
  '/api/health',
  '/api/ext/',
  '/api/shop/',       // SHOP: webhook WooCommerce (chữ ký HMAC theo cửa hàng) — tự xác thực trong route
  '/api/phu/',        // PHỦ: postback mạng affiliate (token theo nguồn) + ingest cron (Bearer MOS2_EXT_KEY) — tự xác thực trong route
  '/api/apps/',       // đo app iOS: ingest từ máy người dùng (token theo app trong body) · register/stats Bearer MOS2_EXT_KEY — tự xác thực trong route
  '/api/auth/', // /api/auth/verify runs its own session check (204/401) for nginx auth_request SSO — must not be redirected
  '/api/review', // generic review queue — does its own auth (agent token OR session)
  // Cửa CÔNG KHAI duy nhất: trang landing gửi email + phản hồi người đọc vào đây. Chỉ NHẬN (POST),
  // không trả dữ liệu nào ra; tự chặn theo IP + bẫy bot. Xem app/api/public/lead/route.ts.
  '/api/public/',
  // Favicon của platform: ẢNH công khai, không đọc/ghi dữ liệu nào của tenant (chỉ tra platforms.key
  // → bytes icon). Để sau tường đăng nhập thì <img> trả 307 về /login, icon không hiện và trình duyệt
  // cũng không cache được — tức là hỏng đúng cái nó sinh ra để làm.
  '/api/platform-icon/',
  // Nút hòm góp ý cho trang ngoài (dantranh/castle/studio2…): JS TĨNH, không đọc dữ liệu nào. Để sau tường thì
  // trình duyệt chưa đăng nhập mos2 nhận 307 → /login, <script> hỏng im lặng, bấm 💬 không ra gì (dantranh 21/11/2026).
  // Hòm thật (/nhung/gop-y) vẫn sau tường: chưa đăng nhập thì iframe hiện trang đăng nhập.
  '/api/gop-y-ngoai/nut',
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
      || pathname === '/icon.svg' || pathname === '/favicon.ico') return true;
  // Host publisher KHÔNG được chạm /login hay /api/auth của MOS2 — đó là cửa đăng nhập nội bộ, và
  // phiên nó cấp là `mos2-session` (domain .on.tc) tức là mở luôn mos2.on.tc. Publisher có cửa
  // riêng ở /pub/login, cấp cookie `pub-session` host-only.
  if (!admin) return pathname.startsWith('/pub');
  return pathname.startsWith('/network') || pathname === '/login' || pathname.startsWith('/api/auth');
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

  // Portal publisher gác bằng cookie RIÊNG (`pub-session`), trang tự kiểm trong currentPublisher().
  // Không đọc `mos2-session` ở đây: nhận nó là cho phiên nội bộ mở cửa publisher và ngược lại —
  // đúng cái vừa phải bịt.
  if (pathname.startsWith('/pub')) return NextResponse.next();

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
  if (!sessionToken && pathname.startsWith('/nhung/')) return nhungCanDangNhap();
  if (!sessionToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Trang NHÚNG (/nhung/gop-y — hòm góp ý phủ màn trên trang ngoài) mà trình duyệt chưa đăng nhập mos2: chuyển về /login NGAY TRONG
// iframe là ngõ cụt — Google không cho đăng nhập trong khung nhúng, và iframe phủ màn không có nút đóng (dantranh 21/11/2026).
// Thay bằng thẻ nhỏ: báo rõ cần đăng nhập · nút mở /login ở tab mới (cookie mos2 dùng chung *.on.tc → quay lại bấm 💬 là được) · nút Đóng
// (gửi 'gop-y:dong' — nút /api/gop-y-ngoai/nut nhận từ đúng iframe origin mos2 thì gỡ khung).
function nhungCanDangNhap() {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:rgba(0,0,0,.55);font:15px system-ui,sans-serif;color-scheme:normal}
.k{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,calc(100vw - 32px));background:#11141a;color:#e6e8ec;border:1px solid #2a2f3a;border-radius:12px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
h1{font-size:17px;margin:0 0 8px}p{margin:0 0 16px;color:#a9b0bd;line-height:1.45}.n{display:flex;gap:8px}
a,button{flex:1;padding:10px;border-radius:8px;font:600 14px system-ui,sans-serif;text-align:center;cursor:pointer;text-decoration:none}
a{background:#6aa8f7;color:#0b0d12;border:0}button{background:transparent;color:#e6e8ec;border:1px solid #3a404c}</style></head>
<body><div class="k" role="dialog" aria-labelledby="t"><h1 id="t">💬 Cần đăng nhập để góp ý</h1>
<p>Hòm góp ý gửi vào MOS2 nên cần tài khoản MOS2. Bấm Đăng nhập (mở tab mới), xong quay lại trang này bấm 💬 lần nữa.</p>
<div class="n"><a href="/login?next=%2F" target="_blank" rel="noopener">Đăng nhập</a><button id="d" type="button">Đóng</button></div></div>
<script>const d=()=>parent.postMessage({loai:'gop-y:dong'},'*');document.getElementById('d').onclick=d;document.body.onclick=(e)=>{if(e.target===document.body)d()};addEventListener('keydown',(e)=>{if(e.key==='Escape')d()});</script>
</body></html>`;
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
