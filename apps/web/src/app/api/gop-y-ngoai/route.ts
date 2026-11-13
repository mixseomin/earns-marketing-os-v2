// GÓP Ý TỪ TRANG TĨNH (castle.on.tc …): trang không phải Next nên không gọi được server action guiGopYMos2.
// Trang POST same-origin tới /api/gop-y trên host của nó → nginx host đó chuyển vào đây kèm cookie phiên mos2 (SSO .on.tc).
// Card rơi CHUNG hòm mos2 (cùng khuôn etp), nhận ra bằng source_url = https://<host>/… → lệnh /tasks-castle lọc GOPY_TRANG=castle.on.tc.
import { NextResponse } from 'next/server';
import { guiGopYMos2 } from '@/lib/actions/gop-y-mos2';
import { uploadImage } from '@/lib/actions/uploads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Host trang tĩnh được gửi góp ý vào hòm mos2. Thêm trang mới = thêm một dòng + location /api/gop-y trong vhost của nó. */
const TRANG_NGOAI = ['castle.on.tc'];

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { noiDung?: string; loai?: string; trang?: string; nguCanh?: string; anh?: string };
  let host = '';
  try { host = new URL(String(b.trang || '')).hostname; } catch { /* trang hỏng → chặn dưới */ }
  if (!TRANG_NGOAI.includes(host)) return NextResponse.json({ ok: false, error: 'Trang này chưa được mở hòm góp ý.' }, { status: 400 });
  const anhUrls: string[] = [];
  if (typeof b.anh === 'string' && b.anh.startsWith('data:image/')) {
    const up = await uploadImage(b.anh, 'gop-y');
    if (up.ok && up.url) anhUrls.push(up.url);
    else console.warn('[gop-y-ngoai] ảnh không lên được:', up.error);
  }
  const r = await guiGopYMos2({ loai: b.loai === 'cau_hoi' ? 'cau_hoi' : 'loi', noiDung: String(b.noiDung || ''), trang: String(b.trang), anhUrls, nguCanh: String(b.nguCanh || ''), hom: 'mos2' });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === 'not found' ? 403 : 400 });
}
