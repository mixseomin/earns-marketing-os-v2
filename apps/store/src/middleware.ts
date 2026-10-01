// 1. Đường cũ của mặt tiền WordPress → đường mới (link quảng cáo / thư cũ không gãy khi chuyển tên miền sang apps/store).
// 2. Nguồn đơn: utm trên URL → cookie "nguon" (chạm cuối, 30 ngày) → sid của đơn = khoá gộp report PHỦ (@mos2/shop/sid).
import { NextResponse, type NextRequest } from 'next/server';
import { sidTuUtm } from '@mos2/shop/sid';

const CU: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/product\/([^/]+)\/?$/, (m) => `/${m[1]}`],
  [/^\/track-order\/?$/, () => '/trackings/search'],
  [/^\/(cart|shop)\/?$/, () => '/'],
  [/^\/checkout\/?$/, () => '/checkout'],
  [/^\/(refund-policy|refund_returns)\/?$/, () => '/static/exchanges-returns'],
  [/^\/shipping-policy\/?$/, () => '/static/orders-shipping'],
  [/^\/privacy-policy\/?$/, () => '/static/privacy'],
  [/^\/terms\/?$/, () => '/static/terms-of-service'],
  [/^\/contact\/$/, () => '/contact'],
];

export function middleware(req: NextRequest) {
  const u = req.nextUrl;
  for (const [re, toi] of CU) {
    const m = u.pathname.match(re);
    if (m && toi(m) !== u.pathname) { const d = u.clone(); d.pathname = toi(m); return NextResponse.redirect(d, 301); }
  }
  const res = NextResponse.next();
  const p = u.searchParams;
  if (p.get('utm_source') || p.get('utm_campaign') || p.get('gclid') || p.get('fbclid')) {
    const utm: Record<string, string> = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']) { const v = p.get(k); if (v) utm[k.replace('utm_', '')] = v.slice(0, 200); }
    utm.sid = sidTuUtm(utm.source ?? (utm.gclid ? 'google' : utm.fbclid ? 'facebook' : null), utm.campaign);
    utm.trang = u.pathname;
    res.cookies.set('nguon', JSON.stringify(utm), { maxAge: 30 * 86400, path: '/', sameSite: 'lax', httpOnly: true, secure: u.protocol === 'https:' });
  }
  return res;
}

export const config = { matcher: ['/((?!_next/|api/|favicon).*)'] };
