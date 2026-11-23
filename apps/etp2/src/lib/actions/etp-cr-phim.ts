'use server';
// CREATIVE CỦA MỘT PHIM (anh 23/11/2026, etp2 › Camp, hàng tên phim: "có 1 nút để thêm creative mới, hoặc hiện danh sách creative đang edit, đang có. Bấm vào sẽ ra drawer
// đầy đủ các bước edit… Khi xong thì bấm save thì sẽ lưu vào thư viện creatives. Khi muốn lên camp từ creative thì thêm 1 nút lên camp ở trong creative").
// Bản soạn = etp.cr_soan (0465). Lưu vào thư viện = đưa bản soạn cho máy dựng theo mẫu (dung-mau.py trên iMac, hàng chờ etp.mau_dung + tuy_chon), máy dựng xong ghi
// creative_id về bản soạn. Lên camp = đúng đường ✓ Duyệt của ô "chờ anh duyệt" (etp-cho-duyet.ts duyetChoAnh → lenCamp: camp $1 theo lich_len, phanh / phim cấm giữ nguyên).
// tra-repo-ok: mã dán keo nội bộ — dùng lại chonPhimMau-khuôn hàng chờ mau_dung và duyetChoAnh, không viết đường lên camp mới
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import SO_MAU from '@/lib/etp-mau-cr.json';
import { duyetChoAnh } from '@/lib/actions/etp-cho-duyet';

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];
const laChu = async () => { const me = await getCurrentUser(), q = await quyenEtp(me); return q?.vai === 'chu' ? me : null; };

type MucSo = { ma: string; ten: string; loai: string; trang_thai: string; may?: string | null; mo_ta?: string; anh_dung?: string | null; anh_dung_phim?: string | null; nhom?: string | null; cau_nhu?: boolean; o?: OMau[] };
/** ô thành phần của mẫu (sổ › o): mỗi ô gắn một QUY TẮC chọn từ một thư viện (sổ › thu_vien), không gắn cứng tệp */
export type OMau = { ma: string; ten: string; thu_vien: string; luat: string };
export type ThuVienSo = { ten: string; nguon: string; co: boolean };
const THU_VIEN = (SO_MAU as unknown as { thu_vien: Record<string, ThuVienSo & { cau?: Record<string, string[][]> }> }).thu_vien;
/** một món ghim vào ô (cũng là một món của thư viện bên phải): nguon = bảng gốc, id = khoá trong bảng đó, anh = ảnh xem trên trang, src = ảnh gốc máy dựng tải, chu = chữ (câu giọng) */
export type Ghim = { nguon: string; id: string; ten: string; anh: string | null; src: string | null; chu?: string | null };
/** thư viện theo khoá sổ (khung_phim, poster, giong, anh_tv…) — chỉ món của đúng phim đang soạn */
export type ThuVienO = Record<string, Ghim[]>;
/** mẫu máy dựng được (cùng điều kiện chonPhimMau: có hàm trong dung-mau.py, không phải công thức, không ở trạng thái chưa) */
const MAU_DUNG = (SO_MAU.mau as MucSo[]).filter((x) => x.loai !== 'cong_thuc' && x.trang_thai !== 'chua' && (x.may ?? '').startsWith('dung-mau.py'));

export type MauChon = { ma: string; ten: string; mo_ta: string; anh: string | null; anh_phim: string | null; nhom: string | null; cau_nhu: boolean;
  /** ô thành phần đã khai (rỗng = mẫu chưa khai, máy tự chọn theo luật mẫu) — kèm tên + nguồn thư viện của ô */ o: (OMau & { tv: ThuVienSo | null })[] };
export type SoanCr = { id: number; mau: string | null; cau: string | null; nhan: string | null; chu_dau: string | null; trang_thai: 'nhap' | 'dung' | 'xong' | 'loi'; ghi: string | null;
  creative_id: number | null; cap_nhat: string; /** việc dựng đang ở bước nào (etp.mau_dung) khi trang_thai = dung */ buoc: string | null;
  /** ô đã ghim (mã ô → món thư viện); ô vắng = máy chọn theo quy tắc */ o: Record<string, Ghim> | null } & XemSoan;
/** XEM TRƯỚC bản soạn: ảnh tĩnh máy dựng thật (iMac) dựng từ đúng mẫu + chữ + ô ghim — cho = chờ máy nhận, dang = đang dựng, xong / loi */
export type XemSoan = { xem_tt: 'cho' | 'dang' | 'xong' | 'loi' | null; xem_anh: string | null; xem_loi: string | null; xem_xong: string | null };
export type CrCuaPhim = { creative_id: number; dang: string | null; lang: string | null; anh: string | null; video: string | null; luc: string | null; mau: string | null;
  camp_id: number | null; camp_tt: string | null; duyet: boolean | null; tu_choi: string | null };
export type DuCrPhim = { phim: string | null; mau: MauChon[]; soan: SoanCr[]; cr: CrCuaPhim[]; con: number };

const BANG = sql`create table if not exists etp.cr_soan (id serial primary key, content_id integer not null, mau text, cau text, nhan text, chu_dau text,
  trang_thai text not null default 'nhap', ghi text, tv_id integer, creative_id integer, ai text, tao timestamptz not null default now(), cap_nhat timestamptz not null default now(), o jsonb)`;
/** bảng + cột ô ghim (migration 0467) — chạy được cả khi deploy chưa áp migration */
const damBang = async () => { await getDb()!.execute(BANG); await getDb()!.execute(sql`alter table etp.cr_soan add column if not exists o jsonb`);
  // xem trước (0468): máy dựng trên iMac dựng ảnh thật mỗi lần bản soạn đổi · cr_khung = khung ứng viên máy trích từ 3 tập (thư viện Khung phim)
  await getDb()!.execute(sql`alter table etp.cr_soan add column if not exists xem_tt text, add column if not exists xem_anh text, add column if not exists xem_loi text,
    add column if not exists xem_yc timestamptz, add column if not exists xem_xong timestamptz`);
  await getDb()!.execute(sql`create table if not exists etp.cr_khung (content_id integer not null, khoa text not null, tep text not null, tap text, so integer, cam_xuc text, nhan_vat text,
    hang integer, luc timestamptz not null default now(), primary key (content_id, khoa))`); };

/** số creative + bản đang soạn của các phim (chip "🎬 N" trên hàng phim) */
export async function demCrPhim(ids: number[]): Promise<Record<number, { cr: number; soan: number }>> {
  if (!(await laChu())) return {};
  const ds = [...new Set(ids.map((x) => Math.trunc(Number(x))).filter((x) => x > 0))].slice(0, 2000); if (!ds.length) return {};
  await damBang();
  const arr = sql.raw(`array[${ds.join(',')}]::int[]`);
  const r = await run<{ k: number; cr: number; soan: number }>(sql`select k, coalesce(c.n, 0)::int cr, coalesce(s.n, 0)::int soan from unnest(${arr}) k
    left join (select content_id, count(*) n from etp.creative where content_id = any(${arr}) group by 1) c on c.content_id = k
    left join (select content_id, count(*) n from etp.cr_soan where content_id = any(${arr}) and trang_thai in ('nhap', 'dung', 'loi') group by 1) s on s.content_id = k`);
  return Object.fromEntries(r.map((x) => [Number(x.k), { cr: Number(x.cr), soan: Number(x.soan) }]));
}

/** mọi thứ ngăn kéo cần: mẫu chọn được, bản đang soạn / đang dựng, creative đã có của phim (mới nhất trước, 80 cái) */
export async function docCrPhim(contentId: number): Promise<DuCrPhim | { loi: string }> {
  if (!(await laChu())) return { loi: 'không có quyền' };
  const cid = Math.trunc(Number(contentId)); if (!(cid > 0)) return { loi: 'mã phim không hợp lệ' };
  await damBang();
  const [f] = await run<{ ten: string | null }>(sql`select ten from etp.phim where content_id = ${cid}`);
  const soan = await run<SoanCr>(sql`select s.id, s.mau, s.cau, s.nhan, s.chu_dau, s.trang_thai, s.ghi, s.creative_id, s.cap_nhat::text cap_nhat, s.o, s.xem_tt, s.xem_loi, s.xem_xong::text xem_xong,
      case when s.xem_anh is not null then '/etp/xem?f=' || s.xem_anh end xem_anh,
      case when s.trang_thai = 'dung' then d.buoc end buoc
    from etp.cr_soan s left join etp.mau_dung d on d.mau = s.mau and d.content_id = s.content_id
    where s.content_id = ${cid} and (s.trang_thai <> 'xong' or s.cap_nhat > now() - interval '2 days') order by s.cap_nhat desc limit 30`);
  const cr = await run<CrCuaPhim>(sql`select r.creative_id, r.dang, r.lang, r.anh, r.video, (select v.tao::text from etp.thu_vien v where v.creative_id = r.creative_id order by v.id desc limit 1) luc, r.tu_choi,   -- giờ làm thật (thư viện); creative.cap_nhat là giờ đồng bộ, mọi dòng giống nhau
     
      (select substring(v.ghi from 'mẫu:([a-z_0-9]+)') from etp.thu_vien v where v.creative_id = r.creative_id order by v.id desc limit 1) mau,
      k.camp_id, k.trang_thai camp_tt, u.ok duyet
    from etp.creative r left join etp.cham_duyet u on u.creative_id = r.creative_id
      left join lateral (select c.camp_id, c.trang_thai from etp.camp c where c.creative_id = r.creative_id order by c.camp_id desc limit 1) k on true
    where r.content_id = ${cid} order by r.creative_id desc limit 80`);
  const n = Number((await run<{ n: number }>(sql`select count(*)::int n from etp.creative where content_id = ${cid}`))[0]?.n ?? 0);
  return { phim: f?.ten ?? null, con: Math.max(0, Number(n) - cr.length),
    mau: MAU_DUNG.map((x) => ({ ma: x.ma, ten: x.ten, mo_ta: x.mo_ta ?? '', anh: x.anh_dung ?? null, anh_phim: x.anh_dung_phim ?? null, nhom: x.nhom ?? null, cau_nhu: !!x.cau_nhu, o: (x.o ?? []).map((y) => ({ ...y, tv: THU_VIEN[y.thu_vien] ?? null })) })),
    soan: soan.map((s) => ({ ...s, id: Number(s.id), creative_id: s.creative_id == null ? null : Number(s.creative_id) })),
    cr: cr.map((x) => ({ ...x, creative_id: Number(x.creative_id), camp_id: x.camp_id == null ? null : Number(x.camp_id) })) };
}

/** trạng thái xem trước của một bản soạn (ngăn kéo hỏi lại mỗi 3 giây khi máy đang dựng) */
export async function docXem(id: number): Promise<XemSoan | { loi: string }> {
  if (!(await laChu())) return { loi: 'không có quyền' };
  await damBang();
  const [r] = await run<XemSoan>(sql`select xem_tt, xem_loi, xem_xong::text xem_xong, case when xem_anh is not null then '/etp/xem?f=' || xem_anh end xem_anh from etp.cr_soan where id = ${Math.trunc(Number(id))}`);
  return r ?? { loi: 'không thấy bản soạn' };
}

/** ảnh tương đối của Ethopex: trang xem qua /api/ethopex/anh (cùng miền), máy dựng tải thẳng CDN gốc */
const anhXem = (p: string | null) => (!p ? null : /^https?:\/\//.test(p) ? p : `/api/ethopex/anh?p=${encodeURIComponent(p.replace(/^\/+/, ''))}`);
const anhGoc = (p: string | null) => (!p ? null : /^https?:\/\//.test(p) ? p : `https://acdn.dofez.com/${p.replace(/^\/+/, '')}`);

/** THƯ VIỆN CHO BƯỚC THÀNH PHẦN: mọi món của đúng phim, gom theo khoá thư viện của sổ (ô nào dùng khoá nào: sổ › mau[].o[].thu_vien).
 *  khung_phim = khung creative đã cắt của phim (etp.anh_cr) + ảnh bìa phim · poster = poster gốc (etp.phim_poster) + ảnh bìa · anh_tv = bản đã dựng trong etp.thu_vien
 *  · giong = câu đọc theo ngôn ngữ phim (sổ › thu_vien.giong.cau, cùng nguồn anh-tinh.py). khung_phim = etp.cr_khung: khung ứng viên máy dựng trích từ tập 1–3 + xếp hạng, đẩy lên box3 ở lượt xem trước đầu tiên của phim (ảnh ở /var/lib/etp-xem/<phim>/k). */
export async function docThuVienO(contentId: number): Promise<ThuVienO | { loi: string }> {
  if (!(await laChu())) return { loi: 'không có quyền' };
  const cid = Math.trunc(Number(contentId)); if (!(cid > 0)) return { loi: 'mã phim không hợp lệ' };
  const [f] = await run<{ ten: string | null; lang: string | null; bia: string | null }>(sql`select coalesce(p.ten, v.ten) ten, coalesce(p.locale, v.locale) lang, v.anh bia
    from (select ${cid}::bigint content_id) k left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)`);
  const bia: Ghim[] = f?.bia ? [{ nguon: 'thu_vien_phim', id: String(cid), ten: 'ảnh bìa phim', anh: anhXem(f.bia), src: anhGoc(f.bia) }] : [];
  await damBang();
  const khung = await run<{ khoa: string; tep: string; cam_xuc: string | null; nhan_vat: string | null; hang: number }>(sql`select khoa, tep, cam_xuc, nhan_vat, hang from etp.cr_khung
    where content_id = ${cid} order by hang limit 80`);
  const poster = await run<{ url: string | null }>(sql`select url from etp.phim_poster where content_id = ${cid} and url is not null`).catch(() => []);
  const tv = await run<{ id: number; anh: string; dang: string | null; ghi: string | null }>(sql`select id, anh, dang, ghi from etp.thu_vien
    where content_id = ${cid} and anh is not null and trang_thai not in ('loai', 'loi_may') order by id desc limit 60`);
  const lang = (f?.lang ?? 'en').slice(0, 2).toLowerCase(), cau = THU_VIEN.giong?.cau ?? {}, ds = cau[lang] ?? cau.en ?? [], ten = f?.ten ?? 'tên phim';
  return {
    // khung ứng viên máy dựng trích từ 3 tập + AI xếp hạng (id = tap#so, đúng khoá máy dựng tìm khi anh ghim) — rỗng tới khi lượt xem trước đầu tiên của phim chạy xong
    khung_phim: khung.map((x) => ({ nguon: 'khung_phim', id: x.khoa, ten: `hạng ${x.hang} · ${x.khoa.replace('#', ' khung ')}${x.cam_xuc ? ` · ${x.cam_xuc}` : ''}${x.nhan_vat ? ` · ${x.nhan_vat}` : ''}`,
      anh: `/etp/xem?f=${cid}/k/${x.tep}`, src: null })),
    poster: [...poster.map((x, i) => ({ nguon: 'phim_poster', id: `${cid}-${i}`, ten: 'poster gốc (trang phim)', anh: x.url, src: x.url })), ...bia],
    anh_tv: tv.map((x) => ({ nguon: 'thu_vien', id: String(x.id), ten: `${x.dang ?? 'thư viện'} #${x.id}`, anh: anhXem(x.anh), src: anhGoc(x.anh) })),
    giong: ds.map((m, i) => ({ nguon: 'cau_giong', id: `${cau[lang] ? lang : 'en'}:${i}`, ten: `câu đọc ${i + 1}${cau[lang] ? '' : ' (tiếng Anh — sổ chưa có câu cho ' + lang + ')'}`, anh: null, src: null,
      chu: m.map((v) => v.replace('{t}', ten)).join(' ') })),
  };
}

/** ô ghim hợp lệ: chỉ ô của mẫu đang chọn, món đủ khoá, chữ gọn — món lạ bị bỏ (không tin trình duyệt) */
const sachO = (mau: string | null, o: Record<string, Ghim> | null | undefined) => {
  if (o == null) return null;
  const ma = new Set((MAU_DUNG.find((x) => x.ma === mau)?.o ?? []).map((x) => x.ma)), r: Record<string, Ghim> = {};
  for (const [k, g] of Object.entries(o)) if (ma.has(k) && g && g.nguon && g.id)
    r[k] = { nguon: String(g.nguon).slice(0, 30), id: String(g.id).slice(0, 60), ten: String(g.ten ?? '').slice(0, 120), anh: g.anh ? String(g.anh).slice(0, 600) : null,
      src: g.src ? String(g.src).slice(0, 600) : null, chu: g.chu ? String(g.chu).slice(0, 400) : null };
  return r;
};

const gon = (s: unknown, max: number) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t ? t.slice(0, max) : null; };

/** TỰ LƯU bản soạn (gõ tới đâu lưu tới đó) — id rỗng = bản mới. Bản đang dựng / đã xong thì không sửa. */
export async function luuSoan(o: { id?: number | null; contentId: number; mau?: string | null; cau?: string | null; nhan?: string | null; chu_dau?: string | null; o?: Record<string, Ghim> | null }): Promise<{ id: number } | { loi: string }> {
  const me = await laChu(); if (!me) return { loi: 'không có quyền' };
  const cid = Math.trunc(Number(o.contentId)); if (!(cid > 0)) return { loi: 'mã phim không hợp lệ' };
  if (o.mau && !MAU_DUNG.some((x) => x.ma === o.mau)) return { loi: 'mẫu này không có máy dựng' };
  await damBang();
  const v = { mau: o.mau || null, cau: gon(o.cau, 120), nhan: gon(o.nhan, 30), chu: gon(o.chu_dau, 400) }, oj = sachO(o.mau || null, o.o), ojs = oj ? JSON.stringify(oj) : null;
  if (o.id) {
    const r = await run<{ id: number }>(sql`update etp.cr_soan set mau = ${v.mau}, cau = ${v.cau}, nhan = ${v.nhan}, chu_dau = ${v.chu}${o.o === undefined ? sql`` : sql`, o = ${ojs}::jsonb`}, cap_nhat = now(),
      xem_tt = case when ${v.mau}::text is null then xem_tt else 'cho' end, xem_yc = now()
      where id = ${Math.trunc(Number(o.id))} and content_id = ${cid} and trang_thai in ('nhap', 'loi') returning id`);
    if (!r[0]) return { loi: 'bản này đang dựng hoặc đã xong — không sửa được nữa (tạo bản mới)' };
    return { id: Number(r[0].id) };
  }
  const [r] = await run<{ id: number }>(sql`insert into etp.cr_soan (content_id, mau, cau, nhan, chu_dau, o, ai, xem_tt, xem_yc) values (${cid}, ${v.mau}, ${v.cau}, ${v.nhan}, ${v.chu}, ${ojs}::jsonb, ${me.displayName ?? me.email ?? 'chủ'},
    case when ${v.mau}::text is null then null else 'cho' end, now()) returning id`);
  if (!r) return { loi: 'không ghi được bản soạn — máy chủ không trả mã' };
  return { id: Number(r.id) };
}

/** bỏ bản nháp (chỉ nháp / lỗi — không đụng creative đã ra). Đánh dấu 'bo', không xoá dòng. */
export async function boSoan(id: number): Promise<{ ok: true } | { loi: string }> {
  if (!(await laChu())) return { loi: 'không có quyền' };
  const r = await run<{ id: number }>(sql`update etp.cr_soan set trang_thai = 'bo', cap_nhat = now() where id = ${Math.trunc(Number(id))} and trang_thai in ('nhap', 'loi') returning id`);
  return r[0] ? { ok: true } : { loi: 'bản này đang dựng hoặc đã xong — không bỏ được' };
}

/** 💾 LƯU VÀO THƯ VIỆN: đưa bản soạn cho máy dựng theo mẫu (iMac lấy hàng mỗi 2 phút) — cùng khuôn hàng chờ chonPhimMau + tuỳ chọn của anh. */
export async function dungSoan(id: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await laChu(); if (!me) return { loi: 'không có quyền' };
  const [s] = await run<{ id: number; content_id: number; mau: string | null; cau: string | null; nhan: string | null; chu_dau: string | null; trang_thai: string; o: Record<string, Ghim> | null }>(
    sql`select id, content_id, mau, cau, nhan, chu_dau, trang_thai, o from etp.cr_soan where id = ${Math.trunc(Number(id))}`);
  if (!s) return { loi: 'không thấy bản soạn' };
  if (!['nhap', 'loi'].includes(s.trang_thai)) return { loi: 'bản này đã gửi máy dựng rồi' };
  const mau = MAU_DUNG.find((x) => x.ma === s.mau); if (!mau) return { loi: 'chưa chọn mẫu (bước Mẫu)' };
  const [cam] = await run<{ ly: string | null }>(sql`select gia_tri -> ${String(s.content_id)} ->> 'ly_do' ly from xv_khoa_ngoai where ten = 'ethopex_phim_cam'
    and jsonb_typeof(gia_tri) = 'object' and gia_tri ? ${String(s.content_id)}`);
  if (cam) return { loi: `PHIM CẤM — không dựng creative: ${cam.ly ?? 'phim trong sổ cấm'}` };
  // cùng mẫu × phim đang dựng (bản khác) → chờ xong, máy chỉ giữ một việc cho mỗi cặp
  const [dang] = await run<{ tt: string }>(sql`select trang_thai tt from etp.mau_dung where mau = ${mau.ma} and content_id = ${s.content_id}
    and (trang_thai in ('dang', 'cho', 'cho_nang_cap') and (tuy_chon is not null or trang_thai = 'dang'))`);
  if (dang) return { loi: `mẫu "${mau.ten}" đang dựng cho phim này (${dang.tt === 'dang' ? 'đang làm' : 'đang chờ máy'}) — chờ xong rồi lưu bản này` };
  const tc = JSON.stringify({ soan: s.id, cau: s.cau ?? '', nhan: s.nhan ?? '', chu_dau: s.chu_dau ?? '', o: sachO(mau.ma, s.o) ?? {} });   // o = ô anh ghim; ô vắng → máy chọn theo quy tắc ô
  await getDb()!.execute(sql`alter table etp.mau_dung add column if not exists tuy_chon jsonb`);
  const r = await run<{ mau: string }>(sql`insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi, ten_mau, tuy_chon) values (${mau.ma}, ${s.content_id}, 'cho', 'cho', ${`bản soạn #${s.id} — chờ máy dựng theo mẫu (iMac) nhận`}, ${mau.ten}, ${tc}::jsonb)
    on conflict (mau, content_id) do update set buoc = 'cho', trang_thai = 'cho', ten_mau = excluded.ten_mau, tuy_chon = excluded.tuy_chon, cap_nhat = now(), ghi = excluded.ghi
    where etp.mau_dung.trang_thai in ('loi', 'cho', 'xong', 'dung') returning mau`);
  if (!r[0]) return { loi: 'việc dựng của mẫu này đang ở trạng thái không nhận bản mới' };
  await getDb()!.execute(sql`create table if not exists etp.mau_phim (mau text not null, content_id integer not null, ai text, dong_id integer, luc timestamptz not null default now(), primary key (mau, content_id))`);
  await getDb()!.execute(sql`insert into etp.mau_phim (mau, content_id, ai) values (${mau.ma}, ${s.content_id}, ${me.displayName ?? me.email ?? 'chủ'}) on conflict (mau, content_id) do update set luc = now()`);
  await getDb()!.execute(sql`update etp.cr_soan set trang_thai = 'dung', ghi = 'chờ máy dựng (iMac lấy hàng mỗi 2 phút)', cap_nhat = now() where id = ${s.id}`);
  return { ok: true, chu: 'đã gửi máy dựng — máy trên iMac lấy hàng mỗi 2 phút, dựng xong creative tự vào thư viện + hiện ở danh sách' };
}

/** 🚀 LÊN CAMP các creative đã chọn: mỗi cái đi đúng đường ✓ Duyệt của ô "chờ anh duyệt" (duyetChoAnh → camp $1 theo lich_len). Đã có camp / đã loại thì bỏ qua. */
export async function lenCampCrPhim(ids: number[]): Promise<{ ok: true; ds: { cr: number; chu: string; loi?: boolean }[] } | { loi: string }> {
  if (!(await laChu())) return { loi: 'không có quyền' };
  const ds = [...new Set(ids.map((x) => Math.trunc(Number(x))).filter((x) => x > 0))].slice(0, 20); if (!ds.length) return { loi: 'chưa chọn creative' };
  const kq: { cr: number; chu: string; loi?: boolean }[] = [];
  for (const id of ds) {
    const [c] = await run<{ camp_id: number | null; tu_choi: string | null }>(sql`select (select camp_id from etp.camp where creative_id = r.creative_id limit 1) camp_id, r.tu_choi
      from etp.creative r where r.creative_id = ${id}`);
    if (!c) { kq.push({ cr: id, chu: 'không thấy creative', loi: true }); continue; }
    if (c.camp_id) { kq.push({ cr: id, chu: `đã có camp #${c.camp_id} — bỏ qua` }); continue; }
    if (c.tu_choi) { kq.push({ cr: id, chu: `Ethopex từ chối creative này: ${c.tu_choi}`, loi: true }); continue; }
    await getDb()!.execute(sql`insert into etp.cho_anh_duyet (creative_id, ghi) values (${id}, 'anh chọn lên camp từ ngăn Creative của phim') on conflict do nothing`);
    const r = await duyetChoAnh(id, true);
    kq.push('loi' in r ? { cr: id, chu: r.loi, loi: true } : { cr: id, chu: r.chu });
  }
  return { ok: true, ds: kq };
}
