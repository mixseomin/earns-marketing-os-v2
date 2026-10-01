// /api/chat — ô chat tư vấn của mặt tiền (components/chat.tsx). Mỗi cuộc chat = một hồ sơ khách loai='tu_van' (sổ shop_ho_so), đọc lại
// bằng (id + chìa bí mật lưu ở trình duyệt khách). Khách nhắn → ghi tin → máy soạn trả lời ở nền (@mos2/shop/tu-van: soạn → kiểm → tự gửi
// loại an toàn / để nháp chờ anh duyệt ở mos2 /shop › Tư vấn). Không lộ ghi chú nội bộ, không lộ nháp.
//   POST {id?, k?, noi_dung?, email?, phien?}   GET ?id&k
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { q } from '@mos2/shop/su-kien';
import { moHoSo, themTin } from '@mos2/shop/ho-so-ghi';
import { soanTraLoi } from '@mos2/shop/tu-van';
import { LA_BOT } from '@mos2/shop/phien';
import { shopHienTai } from '@/lib/shop';
import { ipCua, quaGioiHan } from '@/lib/chan';

type Ho = { id: number; chat_khoa: string; email: string | null; nhap: { dang_soan?: boolean } | null };
const cat = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

async function tim(cuaHang: number, id: unknown, k: unknown): Promise<Ho | null> {
  if (!id || !k) return null;
  const [h] = await q<Ho>(sql`SELECT id, chat_khoa, email, nhap FROM shop_ho_so WHERE id = ${Number(id) || 0} AND cua_hang_id = ${cuaHang} AND loai = 'tu_van' AND chat_khoa = ${String(k)}`);
  return h ?? null;
}

async function ban(h: Ho) {
  const tin = await q<{ id: number; ts: string; nguoi: string; noi_dung: string }>(sql`
    SELECT id, ts::text AS ts, nguoi, noi_dung FROM shop_ho_so_tin WHERE ho_so_id = ${h.id} AND kenh = 'chat' ORDER BY ts, id`);
  const cuoi = tin[tin.length - 1];
  return { id: h.id, k: h.chat_khoa, email: h.email, tin: tin.map((t) => ({ id: t.id, ts: t.ts, minh: t.nguoi === 'khach', noi_dung: t.noi_dung })),
    // khách nhắn cuối mà chưa có trả lời: đang soạn (vài giây) hoặc đang chờ người duyệt
    cho: cuoi?.nguoi === 'khach' ? (h.nhap?.dang_soan ? 'soan' : 'nguoi') : null };
}

export async function GET(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  const u = new URL(req.url);
  const h = await tim(s.id, u.searchParams.get('id'), u.searchParams.get('k'));
  return h ? NextResponse.json(await ban(h)) : NextResponse.json({ loi: 'khong_thay' }, { status: 404 });
}

export async function POST(req: Request) {
  const s = await shopHienTai();
  if (!s) return NextResponse.json({ loi: 'shop' }, { status: 404 });
  if (LA_BOT.test(req.headers.get('user-agent') ?? '')) return NextResponse.json({ loi: 'bot' }, { status: 403 });
  if ((s.mt as { tu_van?: { bat?: boolean } }).tu_van?.bat === false) return NextResponse.json({ loi: 'tat' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: number; k?: string; noi_dung?: string; email?: string; phien?: string };
  const nd = cat(b.noi_dung, 2000), email = cat(b.email, 200).toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ loi: 'email' }, { status: 400 });
  let h = await tim(s.id, b.id, b.k);
  if (nd) {
    if (quaGioiHan(`chat:${ipCua(req)}`, 40)) return NextResponse.json({ loi: 'nhieu' }, { status: 429 });
    if (!h) {
      const k = randomBytes(18).toString('base64url');
      const mo = await moHoSo({ cuaHangId: s.id, ben: 'khach', loai: 'tu_van', tieuDe: nd.split('\n')[0]!.slice(0, 120), nguon: 'chat', email: email || null });
      await q(sql`UPDATE shop_ho_so SET chat_khoa = ${k}, phien_id = ${cat(b.phien, 60) || null}, cot = 'truoc_mua' WHERE id = ${mo.id}`);
      h = { id: mo.id, chat_khoa: k, email: email || null, nhap: null };
    }
    await themTin(h.id, 'khach', 'chat', nd);
    await q(sql`UPDATE shop_ho_so SET khach_cuoi = now(), trang_thai = CASE WHEN trang_thai = 'xong' THEN 'moi' ELSE trang_thai END,
      phien_id = COALESCE(phien_id, ${cat(b.phien, 60) || null}), nhap = jsonb_build_object('dang_soan', true, 'luc', now()) WHERE id = ${h.id}`);
    soanTraLoi(h.id, { epSoan: true }).catch((e) => console.error('chat soan', (e as Error).message));   // nền — khách thấy "typing…" rồi trả lời qua GET
  }
  if (h && email && email !== h.email) {
    await q(sql`UPDATE shop_ho_so SET email = ${email} WHERE id = ${h.id}`);
    await themTin(h.id, 'may', 'ghi_chu', `Khách để lại email ${email}`);
    h.email = email;
  }
  if (!h) return NextResponse.json({ loi: 'trong' }, { status: 400 });
  const [n] = await q<{ nhap: Ho['nhap'] }>(sql`SELECT nhap FROM shop_ho_so WHERE id = ${h.id}`);
  return NextResponse.json(await ban({ ...h, nhap: n?.nhap ?? null }));
}
