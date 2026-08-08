// Phục vụ BYTES của một media lưu dạng data-URI, thay vì nhét base64 vào payload trang.
//
// Vì sao có route này: `media_assets.url` cho phép chứa cả `data:image/png;base64,…`. Ảnh 1-2 MB
// nhân với việc `listMedia()` (không lọc project) chạy trên /plays → 3 ảnh astrolas đẩy HTML của
// trang plays lên 7,3 MB. Trang render ở server chỉ 0,3s nhưng trình duyệt phải tải + parse 7 MB
// → "quay mãi mới hiện". Ảnh phải đi đường ảnh: có URL riêng, cache được, tải song song, và chỉ
// tải khi thật sự hiển thị.
//
// listMedia() đổi mọi `data:` thành `/api/media/<id>/raw` — sửa MỘT chỗ, mọi trang hết nặng.
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return new NextResponse('unauthorized', { status: 401 });

  const db = getDb();
  if (!db) return new NextResponse('no-db', { status: 503 });
  const rows = await db.execute(sql`SELECT url, mime_type FROM media_assets WHERE id = ${Number(id)} LIMIT 1`);
  const row = (rows as unknown as Array<{ url: string | null; mime_type: string | null }>)[0];
  if (!row?.url) return new NextResponse('not-found', { status: 404 });

  // Không phải data-URI thì chẳng có gì để phục vụ — trả về chính nó để caller đi thẳng nguồn.
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(row.url);
  if (!m) return NextResponse.redirect(row.url);

  const mime = m[1] || row.mime_type || 'application/octet-stream';
  const body = m[2] ? Buffer.from(m[3]!, 'base64') : Buffer.from(decodeURIComponent(m[3]!), 'utf8');

  // ?w=<px> — ảnh THU NHỎ. Ô xem trước trong drawer rộng 96px mà tải nguyên bản 1,9 MB thì phí
  // 99% băng thông cho thứ không ai nhìn ở kích thước đó. Thiếu sharp thì trả nguyên bản, đừng lỗi.
  const w = Number(new URL(_req.url).searchParams.get('w') || 0);
  if (w > 0 && w <= 2048 && mime.startsWith('image/')) {
    try {
      const sharp = (await import('sharp')).default;
      const out = await sharp(body).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      return new NextResponse(new Uint8Array(out), {
        headers: { 'Content-Type': 'image/webp', 'Content-Length': String(out.length), 'Cache-Control': 'private, max-age=31536000, immutable' },
      });
    } catch { /* không thu nhỏ được → nguyên bản, vẫn xem được */ }
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(body.length),
      // Bất biến theo id: sửa ảnh = hàng mới. Cache dài để lần sau không tải lại.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
