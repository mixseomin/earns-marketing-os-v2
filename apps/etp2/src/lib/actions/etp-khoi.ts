'use server';
// KHỐI CAMP — điều khiển (anh 25/11/2026: "Tao duyệt khối kiểu gì? Nếu không duyệt thì sao? Muốn điều chỉnh gì đó thì làm thế nào?")
//   ▶ Bắt đầu sản xuất = khoi 'cho' → 'duyet' (ghi ai + lúc) · Huỷ khối = khoi + dòng phim 'cho' → 'huy' (không xoá) · sửa tham số / thêm, bớt phim / số camp mỗi phim
//   chỉ khi khối chưa có camp nào lên (cho / duyet). Không action nào ở đây gọi AI, tạo camp hay chạm Ethopex — không tốn tiền.
// tra-repo-ok: mã dán keo nội bộ — ghi sổ etp.khoi / etp.dong_phim (0470, 0471)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

const db = () => getDb()!;
const run = async <T,>(s: ReturnType<typeof sql>) => (await db().execute(s)) as unknown as T[];
async function chu() { const me = await getCurrentUser(), q = await quyenEtp(me); return q?.vai === 'chu' && me ? (me.displayName ?? me.email ?? 'admin') : null; }
type Kq = { ok: true } | { loi: string };
const SUA_DUOC = ['cho', 'duyet'];

export type PhimKhoi = { dong: number; content_id: number; ten: string | null; locale: string | null; so_camp: number; trang_thai: string };
export type KhoiSua = { id: number; ten: string; trang_thai: string; roas: number; ns: number; gio: string; mien: string | null; nuoc: number | null; cr_camp: number;
  tran_ngay: number | null; khuon: Record<string, number> | null; duyet_ai: string | null; duyet_luc: string | null; phims: PhimKhoi[] };

async function docK(id: number) { return (await run<{ id: number; trang_thai: string; cr_camp: number }>(sql`select id, trang_thai, cr_camp from etp.khoi where id = ${id}`))[0]; }

export async function docKhoiSua(id: number): Promise<KhoiSua | { loi: string }> {
  if (!(await chu())) return { loi: 'chỉ chủ xem / sửa khối' };
  const [k] = await run<Record<string, unknown>>(sql`select id, ten, trang_thai, roas, ns, gio, mien, nuoc, cr_camp, tran_ngay, khuon, duyet_ai, duyet_luc::text duyet_luc from etp.khoi where id = ${Math.trunc(id)}`);
  if (!k) return { loi: `không có khối #${id}` };
  const ps = await run<Record<string, unknown>>(sql`select d.id dong, d.content_id, coalesce(f.ten, d.ten) ten, f.locale, coalesce(d.so_camp, ${k.cr_camp}::int) so_camp, d.trang_thai
    from etp.dong_phim d left join etp.phim f on f.content_id = d.content_id where d.khoi_id = ${k.id} and d.trang_thai <> 'huy' order by f.locale, d.content_id`);
  return { id: Number(k.id), ten: String(k.ten), trang_thai: String(k.trang_thai), roas: Number(k.roas), ns: Number(k.ns), gio: String(k.gio), mien: (k.mien as string) ?? null,
    nuoc: k.nuoc == null ? null : Number(k.nuoc), cr_camp: Number(k.cr_camp), tran_ngay: k.tran_ngay == null ? null : Number(k.tran_ngay), khuon: (k.khuon as Record<string, number>) ?? null,
    duyet_ai: (k.duyet_ai as string) ?? null, duyet_luc: (k.duyet_luc as string) ?? null,
    phims: ps.map((p) => ({ dong: Number(p.dong), content_id: Number(p.content_id), ten: (p.ten as string) ?? null, locale: (p.locale as string) ?? null, so_camp: Number(p.so_camp), trang_thai: String(p.trang_thai) })) };
}

/** ▶ Bắt đầu sản xuất: chỉ đổi khối sang 'duyet' — camp vẫn chỉ lên theo lệnh anh + nhiệm vụ hôm nay */
export async function duyetKhoi(id: number): Promise<Kq> {
  const ai = await chu(); if (!ai) return { loi: 'chỉ chủ duyệt khối' };
  const k = await docK(id); if (!k) return { loi: `không có khối #${id}` };
  if (k.trang_thai !== 'cho') return { loi: `khối #${id} đang '${k.trang_thai}', chỉ khối chưa bắt đầu mới duyệt được` };
  const [n] = await run<{ n: number }>(sql`select count(*)::int n from etp.dong_phim where khoi_id = ${id} and trang_thai = 'cho'`);
  if (!n?.n) return { loi: 'khối không còn phim nào — thêm phim trước' };
  await db().execute(sql`update etp.khoi set trang_thai = 'duyet', duyet_ai = ${ai}, duyet_luc = now() where id = ${id} and trang_thai = 'cho'`);
  return { ok: true };
}

/** Thôi duyệt: về 'cho' khi chưa phim nào bắt đầu sinh */
export async function thoiDuyetKhoi(id: number): Promise<Kq> {
  if (!(await chu())) return { loi: 'chỉ chủ sửa khối' };
  const k = await docK(id); if (!k) return { loi: `không có khối #${id}` };
  if (k.trang_thai !== 'duyet') return { loi: `khối #${id} đang '${k.trang_thai}'` };
  const [n] = await run<{ n: number }>(sql`select count(*)::int n from etp.dong_phim where khoi_id = ${id} and trang_thai not in ('cho', 'huy')`);
  if (n?.n) return { loi: `${n.n} phim của khối đã bắt đầu sinh — không lùi về chưa duyệt được` };
  await db().execute(sql`update etp.khoi set trang_thai = 'cho', duyet_ai = null, duyet_luc = null where id = ${id}`);
  return { ok: true };
}

/** Huỷ khối: khối + dòng phim còn 'cho' → 'huy' (giữ bản ghi, không xoá) */
export async function huyKhoi(id: number): Promise<Kq> {
  const ai = await chu(); if (!ai) return { loi: 'chỉ chủ huỷ khối' };
  const k = await docK(id); if (!k) return { loi: `không có khối #${id}` };
  if (!SUA_DUOC.includes(k.trang_thai)) return { loi: `khối #${id} đang '${k.trang_thai}' — đã có camp lên, không huỷ cả khối được` };
  const [n] = await run<{ n: number }>(sql`select count(*)::int n from etp.dong_phim where khoi_id = ${id} and trang_thai not in ('cho', 'huy')`);
  if (n?.n) return { loi: `${n.n} phim của khối đang sinh — dừng từng dòng ở tab Dòng phim trước` };
  await db().execute(sql`update etp.dong_phim set trang_thai = 'huy', ly_do = ${`huỷ khối #${id} — ${ai}`} where khoi_id = ${id} and trang_thai = 'cho'`);
  await db().execute(sql`update etp.khoi set trang_thai = 'huy', huy_luc = now() where id = ${id}`);
  return { ok: true };
}

export type ThamSoKhoi = { roas: number; ns: number; gio: string; mien: string; nuoc: number | null; cr_camp: number; tran_ngay: number | null };
export async function suaKhoi(id: number, t: ThamSoKhoi): Promise<Kq> {
  if (!(await chu())) return { loi: 'chỉ chủ sửa khối' };
  const k = await docK(id); if (!k) return { loi: `không có khối #${id}` };
  if (!SUA_DUOC.includes(k.trang_thai)) return { loi: `khối #${id} đang '${k.trang_thai}' — chỉ sửa được khi chưa camp nào lên` };
  const roas = Number(t.roas), ns = Number(t.ns), cr = Math.trunc(Number(t.cr_camp)), tran = t.tran_ngay == null || String(t.tran_ngay) === '' ? null : Number(t.tran_ngay);
  const nuoc = t.nuoc == null || String(t.nuoc) === '' ? null : Math.trunc(Number(t.nuoc)), gio = String(t.gio ?? '').trim(), mien = String(t.mien ?? '').trim().toLowerCase();
  if (!(roas >= 0.1 && roas <= 5)) return { loi: 'ROAS phải từ 0,1 tới 5' };
  if (!(ns >= 1 && ns <= 50)) return { loi: 'ngân sách mỗi camp phải từ $1 tới $50' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(gio)) return { loi: 'giờ lên dạng HH:MM (giờ VN), vd 22:00' };
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(mien)) return { loi: 'miền trang đích dạng ten.com' };
  if (!(cr >= 1 && cr <= 10)) return { loi: 'số camp mỗi creative từ 1 tới 10' };
  if (nuoc != null && !(nuoc >= 1 && nuoc <= 60)) return { loi: 'số nước từ 1 tới 60' };
  if (tran != null && !(tran >= ns)) return { loi: 'trần $/ngày cả khối phải ≥ ngân sách một camp' };
  // cr_camp đổi → phim đang mang số camp mặc định cũ đổi theo; phim đã chỉnh riêng giữ nguyên
  await db().execute(sql`update etp.dong_phim set so_camp = ${cr} where khoi_id = ${id} and trang_thai = 'cho' and so_camp = ${k.cr_camp}`);
  await db().execute(sql`update etp.khoi set roas = ${roas}, ns = ${ns}, gio = ${gio}, mien = ${mien}, nuoc = ${nuoc}, cr_camp = ${cr}, tran_ngay = ${tran}, sua_luc = now() where id = ${id}`);
  return { ok: true };
}

/** số camp riêng của một phim trong khối */
export async function soCampPhimKhoi(dong: number, so: number): Promise<Kq> {
  if (!(await chu())) return { loi: 'chỉ chủ sửa khối' };
  const s = Math.trunc(Number(so)); if (!(s >= 1 && s <= 10)) return { loi: 'số camp từ 1 tới 10' };
  const [d] = await run<{ kt: string | null; tt: string }>(sql`select k.trang_thai kt, d.trang_thai tt from etp.dong_phim d join etp.khoi k on k.id = d.khoi_id where d.id = ${dong}`);
  if (!d || !SUA_DUOC.includes(d.kt ?? '') || d.tt !== 'cho') return { loi: 'chỉ sửa phim chưa bắt đầu của khối chưa lên camp' };
  await db().execute(sql`update etp.dong_phim set so_camp = ${s} where id = ${dong}`);
  return { ok: true };
}

/** bỏ một phim khỏi khối = dòng 'huy' (không xoá) */
export async function boPhimKhoi(dong: number): Promise<Kq> {
  const ai = await chu(); if (!ai) return { loi: 'chỉ chủ sửa khối' };
  const [d] = await run<{ kt: string | null; tt: string; k: number }>(sql`select k.trang_thai kt, d.trang_thai tt, k.id k from etp.dong_phim d join etp.khoi k on k.id = d.khoi_id where d.id = ${dong}`);
  if (!d || !SUA_DUOC.includes(d.kt ?? '') || d.tt !== 'cho') return { loi: 'chỉ bỏ được phim chưa bắt đầu của khối chưa lên camp' };
  await db().execute(sql`update etp.dong_phim set trang_thai = 'huy', ly_do = ${`bỏ khỏi khối #${d.k} — ${ai}`} where id = ${dong}`);
  return { ok: true };
}

/** thêm phim (mã content) vào khối — cùng dạng / số camp mặc định của khối */
export async function themPhimKhoi(id: number, contentId: number): Promise<Kq> {
  const ai = await chu(); if (!ai) return { loi: 'chỉ chủ sửa khối' };
  const cid = Math.trunc(Number(contentId)); if (!(cid > 0)) return { loi: 'mã phim không hợp lệ' };
  const [k] = await run<{ trang_thai: string; cr_camp: number; dang: string | null }>(sql`select trang_thai, cr_camp, dang from etp.khoi where id = ${id}`);
  if (!k) return { loi: `không có khối #${id}` };
  if (!SUA_DUOC.includes(k.trang_thai)) return { loi: `khối #${id} đang '${k.trang_thai}' — không thêm phim được` };
  const [f] = await run<{ ten: string | null; the_loai: string | null }>(sql`select ten, the_loai from etp.phim where content_id = ${cid}`);
  if (!f) return { loi: `phim #${cid} chưa có trong kho etp.phim` };
  const [co] = await run<{ id: number }>(sql`select id from etp.dong_phim where khoi_id = ${id} and content_id = ${cid} and trang_thai <> 'huy'`);
  if (co) return { loi: `phim #${cid} đã ở trong khối` };
  await db().execute(sql`insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, trang_thai, so_camp, bo, khoi_id)
    values (${cid}, ${f.ten}, ${f.the_loai}, ${k.dang ?? 'AD'}, ${`${ai} — thêm vào khối #${id}`}, 'cho', ${k.cr_camp}, null, ${id})`);
  return { ok: true };
}
