/** 14 cổng nginx *.on.tc gửi `?next=https://host$request_uri` KHÔNG mã hoá, nên `&b=2` của trang đích bị tách
 *  thành tham số riêng của /login và rơi mất. Ghép lại ở đây một lần cho mọi cổng: mọi tham số ngoài next/error
 *  là phần đuôi của next. Bài kiểm: apps/web/src/lib/login-next.test.mts. */
export function ghepNext(sp: Record<string, string | string[] | undefined>): string {
  const goc = typeof sp.next === 'string' ? sp.next : '/';
  const du = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'next' || k === 'error' || v == null) continue;
    for (const x of Array.isArray(v) ? v : [v]) du.append(k, x);
  }
  const duoi = du.toString();
  return duoi ? goc + (goc.includes('?') ? '&' : '?') + duoi : goc;
}
