// ẢNH POSTER ETHOPEX QUA CÙNG MIỀN (anh 03/11/2026 "poster film vẫn lỗi"): trình duyệt của anh không tải được acdn.dofez.com (máy chủ tải 200) —
// đi qua etp.on.tc thì không phụ thuộc chặn tên miền lạ / chặn quảng cáo. Chỉ nhận đường ảnh tương đối của CDN Ethopex (vd 1/an36mgnys0ofpmgbat.webp).
import { NextResponse } from 'next/server';

const CDN = 'https://acdn.dofez.com';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get('p') ?? '';
  if (!/^[\w-]+(\/[\w-]+)*\.(webp|jpg|jpeg|png)$/i.test(p)) return new NextResponse('đường ảnh lạ', { status: 400 });
  const r = await fetch(`${CDN}/${p}`, { cache: 'force-cache' }).catch(() => null);
  if (!r?.ok) return new NextResponse('không tải được ảnh', { status: 502 });
  return new NextResponse(await r.arrayBuffer(), { headers: { 'content-type': r.headers.get('content-type') ?? 'image/webp', 'cache-control': 'public, max-age=604800, immutable' } });
}
