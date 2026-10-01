// POST /api/contact — thư khách gửi vào hộp hỗ trợ của shop (trả lời thẳng được vì reply-to = email khách) VÀ vào sổ hồ sơ
// (mos2 /shop › Khách phản hồi): khách đã có hồ sơ chưa đóng trong 30 ngày thì nối tin vào đó, không thì mở hồ sơ mới.
import { NextResponse } from 'next/server';
import { guiThu } from '@mos2/shop/thu';
import { moHoSo, themTin } from '@mos2/shop/ho-so';
import { q } from '@mos2/shop/su-kien';
import { sql } from 'drizzle-orm';
import { shopHienTai } from '@/lib/shop';
import { ipCua, quaGioiHan } from '@/lib/chan';

const cat = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const e = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function POST(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  if (quaGioiHan(`lh:${ipCua(req)}`, 5)) return NextResponse.json({ loi: 'nhieu' }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ten = cat(b.ten, 80), email = cat(b.email, 200), don = cat(b.don, 20), nd = cat(b.noi_dung, 5000);
  if (!ten || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || nd.length < 5) return NextResponse.json({ loi: 'thieu' }, { status: 400 });
  const hop = s.mt.email ?? `support@${s.domain}`;
  try {
    const [d] = don ? await q<{ id: number }>(sql`SELECT id FROM shop_don WHERE cua_hang_id = ${s.id} AND so_don = ${don.replace(/^#/, '')} LIMIT 1`) : [];
    const [mo] = await q<{ id: number; trang_thai: string }>(sql`SELECT id, trang_thai FROM shop_ho_so WHERE cua_hang_id = ${s.id} AND ben = 'khach'
      AND lower(email) = ${email.toLowerCase()} AND trang_thai <> 'xong' AND cap_nhat > now() - interval '30 days' ORDER BY cap_nhat DESC LIMIT 1`);
    const id = mo?.id ?? (await moHoSo({ cuaHangId: s.id, ben: 'khach', loai: 'lien_he', tieuDe: nd.split('\n')[0]!.slice(0, 120), donId: d?.id ?? null, ten, email, nguon: 'form' })).id;
    await themTin(id, 'khach', 'form', `${don ? `Order #${don}\n` : ''}${nd}`);
    if (mo && mo.trang_thai === 'cho_ho') await q(sql`UPDATE shop_ho_so SET trang_thai = 'moi' WHERE id = ${id}`);
  } catch (x) { console.error('contact ho_so', (x as Error).message); }   // sổ lỗi vẫn gửi thư — khách không mất tin
  try {
    await guiThu({ khoa: s.khoa, ten: s.ten, domain: s.domain, email: hop }, hop, `[Contact] ${ten}${don ? ` · order #${don}` : ''}`,
      `<p><b>${e(ten)}</b> &lt;${e(email)}&gt;${don ? ` · order #${e(don)}` : ''}</p><p style="white-space:pre-wrap">${e(nd)}</p>`, `${ten} <${email}>${don ? ` order #${don}` : ''}\n\n${nd}`, email);
    return NextResponse.json({ ok: true });
  } catch (x) { console.error('contact', (x as Error).message); return NextResponse.json({ loi: 'gui' }, { status: 500 }); }
}
