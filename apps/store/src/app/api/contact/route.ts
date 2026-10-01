// POST /api/contact — thư khách gửi vào hộp hỗ trợ của shop (trả lời thẳng được vì reply-to = email khách).
import { NextResponse } from 'next/server';
import { guiThu } from '@mos2/shop/thu';
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
    await guiThu({ khoa: s.khoa, ten: s.ten, domain: s.domain, email: hop }, hop, `[Contact] ${ten}${don ? ` · order #${don}` : ''}`,
      `<p><b>${e(ten)}</b> &lt;${e(email)}&gt;${don ? ` · order #${e(don)}` : ''}</p><p style="white-space:pre-wrap">${e(nd)}</p>`, `${ten} <${email}>${don ? ` order #${don}` : ''}\n\n${nd}`, email);
    return NextResponse.json({ ok: true });
  } catch (x) { console.error('contact', (x as Error).message); return NextResponse.json({ loi: 'gui' }, { status: 500 }); }
}
