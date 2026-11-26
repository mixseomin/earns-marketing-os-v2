'use server';
// CHỜ ANH DUYỆT (anh 22/11/2026 "Tao cần duyệt trên page này cơ mà !"): creative máy giữ lại (etp.cho_anh_duyet, view etp.cham_cong cột cho_duyet — 0460)
// hiện ở etp2 › Camp. Duyệt = ghi cham_duyet ok (duyetCham — cùng nút Đạt cũ) rồi lên ★ ROAS (mặc định hoi_cho từ 24/11/2026) bằng đúng đường nút "Lên camp" (lenCampCr → nhan-ban, giờ chạy theo lich_len:
// ngoài 07–12h VN hẹn 07:00). Loại = cham_duyet ok=false. Không tự lên khi chưa bấm — view chặn mọi đường lên camp khác.

import { openSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { chayTach } from '@/lib/etp-chay-tach';
import { envVe, xinVeTrucTiep } from '@/lib/etp-ve';
import { docNhatKyLen, gioVnIso, moNhatKyLen } from '@/lib/etp-nhat-ky-len';
import { THEO_LICH, chayLuc, chuGio, daQua, gioVn } from '@/lib/etp-nb';   // giờ VN dùng chung với nhân bản ★ ROAS bài cũ (etp-tay.ts)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { duyetCham } from '@/lib/actions/etp-cham';
import { lenCampCr } from '@/lib/actions/etp-dong';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { laKhung } from '@/lib/etp-khung';
import { giongCr } from '@/lib/etp-ban';
import { DAN_NGAY, KHUON_CR, MUC_DAN_SQL, keCr, tenCampCr } from '@/lib/etp-ke-cr';
import { docThietLap, type KeTl } from '@/lib/actions/etp-thiet-lap';
import { kieuCr } from '@/lib/etp-doc';

export type ChoDuyet = {
  creative_id: number; content_id: number | null; phim: string | null; lang: string | null; dang: string | null; video: string | null; anh: string | null;
  /** giọng đọc (ky_di…) — giongCr (#1844 "show thêm kiểu giọng") */ giong: string | null;
  ghi: string; tao: string; duyet: boolean | null; /** ✎ Sửa lại (#1863, 0477): duyet = false + cờ này */ sua_lai?: boolean; diem_thap: string | null; camp_id: number | null; trang_thai: string | null; nhat_ky: string | null;
  /** nhận xét anh ghi trước đó cho creative KHÁC của cùng phim (etp.nhan_xet_cr, 0474) — đọc lại để thấy hướng sửa đã nêu */ nx: { cr: number; ok: boolean; sua?: boolean; chu: string; luc: string }[];
  /** '1.1|5' = mức ★ ROAS · $ máy sẽ lên — view etp.ke_cr (khối dàn muc 0.9/1.0/1.1/1.2 theo creative · sổ len_cr_roas), trống = hoi_cho */ roas: string | null;
  /** khuôn camp của khối theo tiếng (etp.ke_cr) — trống = KHUON_CR */ khuon: number | null; mien: string | null;
  /** camp DỰ KIẾN (lib/etp-ke-cr keCr) — ngăn camp đọc lại bằng docThietLap([], [ke]) */ ke: KeTl | null;
  /** tóm tắt camp dự kiến để REVIEW ngay trên thẻ (anh 25/11/2026 "nhất là các thông tin về ngôn ngữ, targeting,... form text rất quan trọng") — ô = mã docThietLap, giá trị đã mở khỏi `chung` */
  tl: Record<string, string | null> | null; tlLoi: string | null;
  /** KIỂU LÊN CAMP K/D của camp dự kiến (#1895 anh 26/11/2026 "badge loại camp K/D") — link camp dự kiến (tl.f_link) đối chiếu cùng sổ chữ với huy hiệu góc ảnh (etp-doc kieuCr) */ kieu: string | null;
};
/** ô thiết lập hiện trên thẻ duyệt (cùng mã trường ngăn camp etp-camp-cau-hinh) */
const O_THE = ['c_ten', 'ke_khuon', 'ke_thieu', 'c_bo', 'c_tk', 'c_ns', 'g_roas', 'g_lich', 'g_nuoc', 'g_so_nuoc', 'g_loai_nuoc', 'g_so_loai', 'g_ngon_ngu', 'g_tuoi', 'g_gioi',
  'g_nen', 'g_vi_tri', 'a_page_ten', 'a_mien', 'f_kieu', 'f_cta', 'f_link', 'f_chinh', 'f_tieu', 'f_mo_ta'];

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

/** tail nhật ký lên camp của nút (lenCampCr ghi /tmp/etp-len-cr-<cr>.log trên máy chạy web) — để lỗi KÊU TO dưới nút */
function nhatKy(cr: number): string | null {
  try { const t = readFileSync(`/tmp/etp-len-cr-${cr}.log`, 'utf8').trim(); return t ? t.split('\n').slice(-3).join('\n').slice(-400) : null; } catch { return null; }
}

/** creative máy giữ CHƯA duyệt — đã duyệt chưa camp là dòng xếp hàng ở bảng cây camp (etp-doc.ts hangCr) */
export async function dsChoDuyet(): Promise<{ ds: ChoDuyet[]; dungKhan: boolean } | { loi: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { loi: 'chỉ admin' };
  const ds = await run<Omit<ChoDuyet, 'nhat_ky' | 'ke' | 'tl' | 'tlLoi' | 'nx'>>(sql`select h.creative_id, r.content_id, f.ten phim, r.lang, r.dang, r.video, r.anh, ${giongCr('h.creative_id')} giong, h.ghi, h.tao::text tao, u.ok duyet, coalesce(u.sua_lai, false) sua_lai,
      (select string_agg(e.k || ' ' || e.v, ', ' order by e.v::numeric) from etp.cham c, jsonb_each_text(c.diem) e(k, v)
        where c.creative_id = h.creative_id and (e.k like 'meta.%' or e.k like 'afs.%') and e.v::numeric <= 4) diem_thap,
      k.camp_id, k.trang_thai,
      (select e.roas || '|' || e.ns from etp.ke_cr e where e.creative_id = h.creative_id limit 1) roas,   -- MỘT nguồn kế camp (0476) — cùng lenh_cho.py / lenCampCr / lenhNb
      (select e.khuon from etp.ke_cr e where e.creative_id = h.creative_id limit 1) khuon, (select gia_tri #>> '{}' from etp.cau_hinh where khoa = 'mien_len') mien
    from etp.cho_anh_duyet_cr h join etp.creative r on r.creative_id = h.creative_id left join etp.phim f on f.content_id = r.content_id
      left join etp.cham_duyet u on u.creative_id = h.creative_id
      left join lateral (select c.camp_id, c.trang_thai from etp.camp c where c.creative_id = h.creative_id order by c.camp_id desc limit 1) k on true
    where u.ok is null   -- ô vàng CHỈ giữ creative chưa duyệt; đã duyệt thì xuống bảng cây camp (etp-doc hangCr — anh 22/11/2026 "duyệt rồi thì phải cho vào table bên dưới")
    order by h.tao, h.creative_id`);
  const [dk] = await run<{ v: boolean }>(sql`select coalesce((select gia_tri = 'true'::jsonb from etp.cau_hinh where khoa = 'dung_khan'), false) v`);
  // nhận xét trước của cùng phim (3 dòng mới nhất) — anh 25/11/2026: comment khi duyệt là hướng sửa cho lượt dựng sau
  const cids = [...new Set(ds.map((x) => x.content_id).filter((v): v is number => v != null).map(Number))];
  const nxDs = cids.length ? await run<{ content_id: number; cr: number; ok: boolean; sua: boolean; chu: string; luc: string }>(sql`select r.content_id, n.creative_id cr, n.ok, n.sua_lai sua, n.chu, n.luc::text luc
      from etp.nhan_xet_cr n join etp.creative r using (creative_id) where r.content_id in (${sql.join(cids.map((c) => sql`${c}`), sql`, `)}) order by n.luc desc`) : [];
  const nxCua = (cid: number | null) => cid == null ? [] : nxDs.filter((n) => Number(n.content_id) === Number(cid)).slice(0, 3).map((n) => ({ cr: Number(n.cr), ok: n.ok, sua: !!n.sua, chu: n.chu, luc: n.luc }));
  // camp DỰ KIẾN của từng creative (cùng lệnh ▶ Lên: khuôn theo tiếng, ★ ROAS, bộ phim mới) — một lượt docThietLap cho cả ô
  const ke = new Map(ds.filter((x) => x.content_id != null && !x.camp_id).map((x) => [Number(x.creative_id),
    keCr({ cr: Number(x.creative_id), cid: Number(x.content_id), lang: x.lang, phim: x.phim, roas: x.roas, khuon: x.khuon == null ? null : Number(x.khuon), mien: x.mien, bo: null /* null → docThietLap tính bộ cùng luật máy lên (SQL_BO_PHIM) */ })]));
  const tl = ke.size ? await docThietLap([], [...ke.values()]).catch((e: unknown) => ({ loi: String((e as Error)?.message ?? e).slice(0, 200) })) : null;
  const tom = (cr: number): Record<string, string | null> | null => {
    if (!tl || 'loi' in tl) return null; const d = tl.dong.find((r) => r.ke_cha === -cr); if (!d) return null;
    return Object.fromEntries(O_THE.map((k) => { const v = d[k]; return [k, v == null ? null : typeof v === 'number' && k !== 'ke_khuon' ? (tl.chung[v] ?? null) : String(v)]; }));
  };
  return { ds: ds.map((x) => { const cr = Number(x.creative_id); const t = tom(cr);
    return { ...x, creative_id: cr, camp_id: x.camp_id == null ? null : Number(x.camp_id), nhat_ky: x.duyet && !x.camp_id ? nhatKy(cr) : null,
      ke: ke.get(cr) ?? null, tl: t, kieu: kieuCr(t?.f_link), tlLoi: tl && 'loi' in tl ? tl.loi : null, nx: nxCua(x.content_id) }; }), dungKhan: !!dk?.v };
}

/** ✓ Duyệt → ghi duyệt + lên ★ ROAS mặc định (hoi_cho, anh 24/11/2026); ✕ Loại → ghi loại. Phanh đang bật (dừng khẩn…): duyệt = XẾP HÀNG, máy tự lên camp ở nhịp đầu phanh nhả
 *  (apps/etp/lenh_cho.py len_cr — anh 22/11/2026 "thằng ngu !": không bắt anh bấm lại) */
/** sua = ✎ Sửa lại (#1863): không lên camp, nhận xét bắt buộc, dòng còn ở bảng cây với trạng thái ✎ Sửa lại */
export async function duyetChoAnh(cr: number, ok: boolean, chu?: string | null, sua = false, day = true): Promise<{ ok: true; chu: string } | { loi: string }> {
  const id = Math.trunc(Number(cr));
  const [h] = await run<{ x: number }>(sql`select 1 x from etp.cho_anh_duyet_cr where creative_id = ${id}`);
  if (!h) return { loi: `creative #${id} không nằm trong danh sách chờ anh duyệt` };
  const d = await duyetCham(id, ok && !sua, chu, sua ? 'sua-lai' : 'cho-duyet', sua);
  if ('loi' in d) return d;
  if (sua) return { ok: true, chu: `đã đánh dấu ✎ Sửa lại creative #${id} — không lên camp, con dựng lại theo nhận xét` };
  if (!ok) return { ok: true, chu: `đã loại creative #${id} — không lên camp` };
  if (!day) return { ok: true, chu: `đã duyệt creative #${id} — chưa đẩy lên Ethopex (anh bỏ chọn 🚀); lên sau ở ngăn phim › 🚀 Lên camp` };   // option đẩy Etho (anh 25/11/2026)
  return lenCamp(id);
}

/** ✕ KHÔNG DUYỆT dòng ⏳ chờ anh duyệt ở bảng cây camp (anh 22/11/2026 "Nếu tao bấm ko duyệt thì sao"): ghi LOẠI (cham_duyet ok=false — cùng ✕ Loại ô vàng)
 *  + bỏ creative khỏi sổ ★ ROAS len_cr_roas → dòng biến mất, lenh_cho.py / ▶ Lên không bao giờ lên. Không tạo camp, không gọi Ethopex, không tốn tiền. */
export async function khongDuyetCr(cr: number, chu?: string | null): Promise<{ ok: true; chu: string } | { loi: string }> {
  const id = Math.trunc(Number(cr));
  const [c] = await run<{ x: number }>(sql`select 1 x from etp.cr_co_camp where creative_id = ${id} limit 1`);
  if (c) return { loi: `creative #${id} đã có camp — không còn ở hàng chờ duyệt (muốn dừng thì tắt camp)` };
  const d = await duyetCham(id, false, chu, 'khong-duyet'); if ('loi' in d) return d;
  await getDb()!.execute(sql`update etp.cau_hinh set gia_tri = gia_tri - ${String(id)} where khoa = 'len_cr_roas' and gia_tri ? ${String(id)}`);
  return { ok: true, chu: `đã KHÔNG DUYỆT creative #${id} — ghi loại, bỏ khỏi sổ ★ ROAS; không camp nào được tạo, dòng tự biến mất` };
}

/** lên camp cho creative đã duyệt (bấm lại sau khi lên hỏng / dừng khẩn) */
export async function lenCamp(cr: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const id = Math.trunc(Number(cr));
  const [dk] = await run<{ v: boolean }>(sql`select coalesce((select gia_tri = 'true'::jsonb from etp.cau_hinh where khoa = 'dung_khan'), false) v`);
  if (dk?.v) return { ok: true, chu: `đã duyệt #${id} — xếp hàng: máy tự lên camp ở nhịp đầu nhả dừng khẩn, giờ chạy theo lịch` };
  // duyệt = LÊN CAMP NGAY cho MỌI creative, kể cả sổ len_cr_roas (anh 25/11/2026 "tất cả chờ ID phải tự đẩy lên Etho luôn" — bỏ đường chờ ▶ Lên)
  const r = await lenCampCr(-1, id);
  if ('loi' in r) return { loi: `Đã ghi DUYỆT #${id}, nhưng chưa lên camp: ${r.loi}` };
  return { ok: true, chu: `đã gửi lệnh lên ★ ROAS ${r.roas} · $${r.ns} (${r.nguon}) cho creative #${id} — giờ chạy theo lịch lên; dòng này tự hiện số camp khi xong` };
}

// ▶ LÊN NGAY / 🕒 ĐỔI GIỜ (anh 22/11/2026 "nút bấm Lên ngay = Tao ra lệnh sao phải xin mày ?" · "tao có thể điều chỉnh ngày, giờ lên camp") — anh bấm = LỆNH TRỰC TIẾP:
// vé cong.py --ve-truc-tiep (bỏ qua phanh: dừng khẩn, khung giờ, trần…; KHÔNG bỏ phim cấm / camp đội / giới hạn Ethopex). Phanh đang áp → lần bấm đầu trả { canh }
// (cảnh báo MỘT lần), bấm lại trong 30 phút mới lên. Giờ = "YYYY-MM-DD HH:MM" giờ VN, rỗng = chạy ngay.
const DIR_NB = () => `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex`;
export type KqNut = { ok: true; chu: string; /** giờ máy chủ ghi dòng gửi (#1770: trình duyệt đánh dấu "đang lên" ngay) */ gui?: string | null } | { canh: string } | { loi: string };

const ROAS_CR = [0.9, 1.4] as const, NS_CR = BANG_LUAT.hoi_cho.ns_khoang as [number, number];   // ★ ROAS creative mới: mức cùng nhan-ban.py ROAS_MIN/MAX · ngân sách sổ luật hoi_cho.ns_khoang

/** creative ĐÃ DUYỆT, chưa có camp, CÙNG PHIM với camp — nguồn "creative mới" của nhân bản ★ ROAS ở bảng điều khiển camp (Dol 22/11/2026) */
export async function dsCrMoiCamp(campId: number): Promise<{ cr: number; lang: string | null; dang: string | null }[]> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return [];
  return run<{ cr: number; lang: string | null; dang: string | null }>(sql`select r.creative_id cr, r.lang, r.dang from etp.creative r
      join etp.cham_duyet u on u.creative_id = r.creative_id and u.ok
    where r.content_id = (select content_id from etp.camp where camp_id = ${Math.trunc(Number(campId))})
      and not exists (select 1 from etp.cr_co_camp c where c.creative_id = r.creative_id) order by r.creative_id desc limit 30`);
}

/** o.khuon = camp ★ đang chạy làm KHUÔN (cùng bộ, cùng phim): ★ ROAS creative mới mức o.roas · $o.ns — từ nút nhân bản ★ ROAS "creative mới" */
/** GIỜ TỰ DO (#1869, anh 25/11/2026 "Vẫn cho edit tự do nhưng sẽ cảnh báo !!"): giờ anh đặt ngoài 2 khung chính (nút đã cảnh báo vàng) → nhan-ban --gio-tu-do giữ
 *  ĐÚNG giờ đó; giờ đúng khung → như cũ (gio_len). Mọi đường anh đặt giờ (▶ Lên theo giờ, 🕒 đổi giờ, ✎ đổi ROAS giữ giờ) qua MỘT chỗ này. */
const tuDo = (g: string | null) => !!g && !laKhung(g);
const lenhGio = (g: string | null) => (g ? ['--gio', g, ...(tuDo(g) ? ['--gio-tu-do'] : [])] : []);
type LenhNb = { args: string[]; lenh: string; ro: { roas: number; ns: number }; content: number; g: string | null; lich: boolean };
/** MỘT chỗ dựng lệnh nhan-ban cho ▶ Lên — nút lên thật (lenNgayCr, thêm --that) và 👁 xem trước (xemTruocLen, thêm --xem-truoc) đi CÙNG lệnh này,
 *  nên cái anh xem trước đúng là cái sẽ gửi Ethopex (anh 22/11/2026 "tao cần xem mọi thứ mày sẽ submit thì mới gọi là review") */
async function lenhNb(cr: number, gio?: string | null, o?: { roas: number; ns: number; khuon: number } | null): Promise<LenhNb | { loi: string }> {
  const lich = gio === THEO_LICH; if (lich) gio = null;   // #1772 "⏱ Lên theo lịch": không --gio, không vé trực tiếp → lịch lên của máy quyết giờ
  const id = Math.trunc(Number(cr)), g = gioVn(gio);
  if (gio && !g) return { loi: `giờ không đọc được: "${gio}" — dạng YYYY-MM-DD HH:MM giờ VN` };
  if (g && daQua(g)) return { loi: `giờ ${g} VN đã qua — chọn giờ sau bây giờ` };
  const [x] = await run<{ content_id: number | null; ten: string | null; lang: string | null; ok: boolean | null; co_camp: string | null; bo: string | null; roas: string | null; ns: string | null; khuon: number | null; dan: string | null }>(sql`select r.content_id, f.ten, r.lang, u.ok,
      (select string_agg('#' || c.camp_id || case when c.doi then ' (team)' else '' end, ', ') from etp.cr_co_camp c where c.creative_id = r.creative_id) co_camp, (select gia_tri#>>'{}' from etp.cau_hinh where khoa = 'bo_phim_moi') bo,
      e.roas::text roas, e.ns::text ns, e.khuon,   -- kế camp MỘT nguồn: view etp.ke_cr (0476)
      case when r.content_id is null then null else etp.muc_roas(r.content_id, ${MUC_DAN_SQL}::numeric[], ${DAN_NGAY})::text end dan   -- ngoài khối: dàn mức theo phim (0481, anh 26/11/2026)
    from etp.creative r left join etp.phim f using (content_id) left join etp.cham_duyet u on u.creative_id = r.creative_id
      left join lateral (select * from etp.ke_cr k where k.creative_id = r.creative_id limit 1) e on true where r.creative_id = ${id}`);
  if (!x) return { loi: `không thấy creative #${id}` };
  if (!x.ok) return { loi: `creative #${id} chưa duyệt — duyệt trước rồi mới lên` };
  if (x.co_camp) return { loi: `creative #${id} đã có camp ${x.co_camp} — Ethopex chỉ lên creative chưa từng có camp (nhà lẫn team), không gửi được` };   // etp.cr_co_camp: cùng luật nhan-ban creative_cu
  if (!x.content_id || (!o && !x.bo)) return { loi: 'thiếu bộ lên camp (bo_phim_moi) hoặc phim của creative' };
  if (o) {
    if (!(o.roas >= ROAS_CR[0] && o.roas <= ROAS_CR[1])) return { loi: `ROAS goal phải trong ${ROAS_CR[0]}–${ROAS_CR[1]}` };
    if (!(Number.isInteger(o.ns) && o.ns >= NS_CR[0] && o.ns <= NS_CR[1])) return { loi: `ngân sách ★ ROAS creative mới $${NS_CR[0]}–${NS_CR[1]} (sổ luật hoi_cho)` };
    const [k] = await run<{ content_id: number | null }>(sql`select content_id from etp.camp where camp_id = ${Math.trunc(Number(o.khuon))}`);
    if (!k) return { loi: `không thấy camp khuôn #${o.khuon}` };
    if (Number(k.content_id) !== Number(x.content_id)) return { loi: `creative #${id} không cùng phim với camp #${o.khuon}` };
  }
  const lang = x.lang === 'es' ? 'es' : 'en', ro = o ? { roas: o.roas, ns: o.ns } : x.roas && x.ns ? { roas: Number(x.roas), ns: Math.trunc(Number(x.ns)) }
    : { roas: Number(x.dan), ns: Math.trunc(Number(BANG_LUAT.hoi_cho.ns)) };   // MẶC ĐỊNH ★ ROAS (anh 24/11/2026) — mức DÀN theo phim etp.muc_roas (anh 26/11/2026 "đa dạng level ROAS"), không cứng 1
  const chu = lich ? `theo lịch: ${chayLuc(Date.now(), !!ro)}` : chuGio(g, tuDo(g));
  const lenh = o ? `anh bấm nhân bản ★ ROAS ${o.roas} creative mới #${id} từ camp #${o.khuon} trên etp2 (${chu})` : `anh bấm ${lich ? '⏱ Lên theo lịch' : '▶ Lên ngay'} creative #${id} trên etp2 (${chu})`;
  const ten = tenCampCr(x.ten, lang, id);   // cùng tên camp dự kiến của ô duyệt (lib/etp-ke-cr)
  return { lenh, ro, content: Number(x.content_id), g, lich, args: ['nhan-ban.py', String(o ? Math.trunc(Number(o.khuon)) : x.khuon ? Math.trunc(Number(x.khuon)) : KHUON_CR[lang]), '--roas', String(ro.roas), '--ns', String(ro.ns), '--tay', ...(o ? [] : ['--bo', String(x.bo)]), '--creative', String(id),   // khuôn ★: không --bo → giữ bộ camp khuôn
    '--content', String(x.content_id), '--ten', ten, ...lenhGio(g)] };
}

/** ⏸ TẠM DỪNG creative đã duyệt chờ lên camp (anh 25/11/2026 "Vẫn có nút pause nếu cần thủ công"): khoá etp.cau_hinh.hoan_cr = {"<cr>": {luc, ai}}
 *  — apps/etp/lenh_cho.py SQL_CR_DUYET bỏ qua creative trong khoá này; bat=false gỡ ra, máy lên lại theo lịch */
export async function hoanCr(cr: number, bat: boolean): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được tạm dừng' };
  const id = Math.trunc(Number(cr)); if (!(id > 0)) return { loi: 'mã creative không hợp lệ' };
  const [c] = await run<{ x: number }>(sql`select 1 x from etp.cr_co_camp where creative_id = ${id} limit 1`);
  if (c) return { loi: `creative #${id} đã có camp — muốn dừng thì tắt camp đó` };
  if (bat) { if (docNhatKyLen(id).gui) return { loi: `creative #${id} đã gửi lệnh lên camp, máy đang tạo — không tạm dừng được nữa (xong thì tắt camp)` };
    const v = JSON.stringify({ [String(id)]: { luc: new Date().toISOString(), ai: me.email } });
    await getDb()!.execute(sql`insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('hoan_cr', ${v}::jsonb, 'creative anh tạm dừng ở etp2 — máy không lên camp', ${me.email})
      on conflict (khoa) do update set gia_tri = coalesce(etp.cau_hinh.gia_tri, '{}'::jsonb) || excluded.gia_tri, luc = now()`);
    return { ok: true, chu: `đã TẠM DỪNG creative #${id} — máy không lên camp cho tới khi anh bấm chạy tiếp` }; }
  await getDb()!.execute(sql`update etp.cau_hinh set gia_tri = gia_tri - ${String(id)}, luc = now() where khoa = 'hoan_cr' and gia_tri ? ${String(id)}`);
  return { ok: true, chu: `creative #${id} chạy tiếp — máy lên camp ở khung kế` };
}

/** ✎ SỬA TAY ROAS LEVEL creative CHƯA LÊN camp (anh 25/11/2026 #1857 "phải cho sửa thủ công ROAS level với camp chưa thực sự lên"): ghi / gộp mức roas vào sổ len_cr_roas.
 *  Creative chưa có mục trong sổ → mục mới mang cờ tu = true: apps/etp/lenh_cho.py vẫn TỰ LÊN như cũ (chỉ đổi mức), không biến thành "chờ anh ▶ Lên tay".
 *  Đã gửi lệnh lên / đã có camp → từ chối (camp thật đã gửi Ethopex không sửa Ad Set được). Không tạo camp, không gọi Ethopex, không tốn tiền. */
export async function suaRoasCr(cr: number, roas: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được sửa ROAS' };
  const id = Math.trunc(Number(cr)); if (!(id > 0)) return { loi: 'mã creative không hợp lệ' };
  const r = Math.round(Number(roas) * 100) / 100;
  if (!(r >= ROAS_CR[0] && r <= ROAS_CR[1])) return { loi: `ROAS level phải trong ${ROAS_CR[0]}–${ROAS_CR[1]} (cùng mức nhan-ban.py chấp nhận)` };
  const [c] = await run<{ x: number }>(sql`select 1 x from etp.cr_co_camp where creative_id = ${id} limit 1`);
  if (c) return { loi: `creative #${id} đã có camp — camp đã lên thì không sửa ROAS ở đây được` };
  if (docNhatKyLen(id).gui) return { loi: `creative #${id} đã gửi lệnh lên camp, máy đang tạo — không sửa ROAS được nữa` };
  const [cu] = await run<{ ns: string | null; tu: string | null; co: boolean }>(sql`select x.gia_tri -> ${String(id)} ->> 'ns' ns, x.gia_tri -> ${String(id)} ->> 'tu' tu, x.gia_tri ? ${String(id)} co
    from etp.cau_hinh x where x.khoa = 'len_cr_roas'`);
  const ns = cu?.ns != null ? Math.trunc(Number(cu.ns)) : Math.trunc(Number(BANG_LUAT.hoi_cho.ns));
  const tu = !cu?.co || cu.tu === 'true';   // mục cũ "chờ anh ▶ Lên tay" giữ nguyên kiểu chờ tay — chỉ đổi mức
  const v = JSON.stringify({ [String(id)]: { roas: r, ns, luc: new Date().toISOString(), ai: `anh sửa tay ROAS ở etp2 (${me.email})`, ...(tu ? { tu: true } : {}) } });
  await getDb()!.execute(sql`insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('len_cr_roas', ${v}::jsonb, 'creative anh duyệt lên ★ ROAS (etp2)', ${me.email})
    on conflict (khoa) do update set gia_tri = coalesce(etp.cau_hinh.gia_tri, '{}'::jsonb) || excluded.gia_tri, luc = now()`);
  return { ok: true, chu: `creative #${id} sẽ lên ★ ROAS ${r} · $${ns}${tu ? ' — máy vẫn tự lên theo lịch' : ' — vẫn chờ anh bấm ▶ Lên'}` };
}

export async function lenNgayCr(cr: number, gio?: string | null, o?: { roas: number; ns: number; khuon: number } | null): Promise<KqNut> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được lên camp' };
  await getDb()!.execute(sql`update etp.cau_hinh set gia_tri = gia_tri - ${String(Math.trunc(Number(cr)))}, luc = now() where khoa = 'hoan_cr' and gia_tri ? ${String(Math.trunc(Number(cr)))}`);   // ▶ Lên tay = lệnh trực tiếp, bỏ ⏸ tạm dừng
  const L = await lenhNb(cr, gio, o); if ('loi' in L) return L;
  const id = Math.trunc(Number(cr)), { ro, g, lenh } = L;
  const dg = docNhatKyLen(id).gui; if (dg) return { canh: `đã gửi lệnh lên lúc ${gioVnIso(dg)} giờ VN, máy đang tạo camp — chờ xong, không gửi lần hai` };   // #1770: dòng "đang lên" bấm lại không nhân đôi camp
  const v = await xinVeTrucTiep('tao_camp', { content: L.content, lenh, ns: ro.ns });   // ⏱ theo lịch / ▶ Lên ngay / hẹn giờ đều là anh bấm = vé trực tiếp (anh 25/11/2026 "fix tất cả nút thủ công"); giờ chạy vẫn khung cố định gio_len của nhan-ban
  if (!('ma' in v)) return v;
  const log = moNhatKyLen(id, `anh (etp2 ${me.email})`);   // #1770: dòng gửi → bảng hiện "đang lên" ngay
  chayTach('python3', [...L.args, '--that', '--luat', lenh, '--ai', `anh (etp2 ${me.email})`], { cwd: DIR_NB(), detached: true, stdio: ['ignore', log, log], env: envVe(v.ma) }).unref();
  return { ok: true, chu: `đã gửi lệnh lên ★ ROAS ${ro.roas} · $${ro.ns} — ${L.lich ? `theo lịch: ${chayLuc(Date.now(), true)}` : chuGio(g, tuDo(g))}`, gui: docNhatKyLen(id).gui };
}

export type XemTruoc = { ten: string | null; chay: string | null; canh: string[]; payload: Record<string, unknown> } | { loi: string };
/** 👁 XEM TRƯỚC ▶ Lên: nhan-ban chạy KHÔ (--xem-truoc, cấm đi cùng --that) đúng lệnh của nút → payload THẬT sẽ POST /api/v1/campaigns/facebook + cổng sẽ bỏ qua.
 *  Không tạo gì, không cấp vé; chỉ đọc khuôn + danh sách camp Ethopex. */
export async function xemTruocLen(cr: number, gio?: string | null): Promise<XemTruoc> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin' };
  const L = await lenhNb(cr, gio); if ('loi' in L) return L;
  const out = await new Promise<string>((ok) => execFile('python3', [...L.args, '--xem-truoc'].concat(L.lich ? ['--theo-lich'] : []), { cwd: DIR_NB(), timeout: 240_000, maxBuffer: 8 << 20 },
    (e, so, se) => ok(String(so || '') + (e && !so ? `\n{"loi": ${JSON.stringify(String(se || e.message).trim().split('\n').slice(-3).join(' · ').slice(0, 400))}}` : ''))));
  const t = out.trim().split('\n').reverse().find((l) => l.startsWith('{'));
  if (!t) return { loi: `nhan-ban không trả kết quả: ${out.slice(-300)}` };
  const j = JSON.parse(t) as { loi?: string | null; ten?: string; chay_luc?: string; gio_roas?: string; gio_anh?: string; canh?: string[]; payload?: Record<string, unknown> };
  if (!j.payload) return { loi: j.loi || 'nhan-ban chạy khô không ra payload' };
  return { ten: j.ten ?? null, chay: j.gio_anh ?? j.gio_roas ?? j.chay_luc ?? null, canh: j.canh ?? [], payload: j.payload };
}

/** camp ĐÃ đẩy lên Ethopex, còn chờ giờ chạy: Ethopex không sửa được start_time Ad Set → nhan-ban tạo camp MỚI đúng giờ anh đặt rồi TẠM DỪNG camp cũ (--thay-cho) */
export async function doiGioCamp(campId: number, gio: string): Promise<KqNut> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được đổi giờ camp' };
  const id = Math.trunc(Number(campId)), g = gioVn(gio);
  if (!g) return { loi: `giờ không đọc được: "${gio}" — dạng YYYY-MM-DD HH:MM giờ VN` };
  if (daQua(g)) return { loi: `giờ ${g} VN đã qua — chọn giờ sau bây giờ` };
  const [c] = await run<{ la_roas: boolean | null; roas: string | null; ngan_sach: string | null; cho: boolean }>(sql`select c.la_roas, c.roas::text roas, c.ngan_sach::text ngan_sach,
      (c.lich is not null and c.lich > now() and coalesce(c.trang_thai, '') not in ('PAUSED', 'ARCHIVED', 'DELETED')) cho from etp.camp c where c.camp_id = ${id}`);
  if (!c) return { loi: `không thấy camp #${id} trong sổ nhà` };
  if (!c.cho) return { loi: `camp #${id} không còn chờ giờ chạy — đổi giờ chỉ cho camp chưa chạy` };
  const ro = c.la_roas && c.roas ? { roas: Number(c.roas), ns: Math.trunc(Number(c.ngan_sach ?? 0)) } : null;
  const lenh = `anh bấm 🕒 đổi giờ camp #${id} trên etp2 → ${chuGio(g, tuDo(g))} (camp mới đúng giờ, tạm dừng #${id})`;
  const v = await xinVeTrucTiep('nhan_ban', { camp: id, lenh, ns: ro?.ns ?? Number(c.ngan_sach ?? 1) });
  if (!('ma' in v)) return v;
  const log = openSync(`/tmp/etp-doi-gio-${id}.log`, 'a');
  chayTach('python3', ['nhan-ban.py', String(id), ...(ro ? ['--roas', String(ro.roas), '--ns', String(ro.ns)] : []), ...lenhGio(g), '--thay-cho', String(id), '--that',
    '--luat', lenh, '--ai', `anh (etp2 ${me.email})`], { cwd: DIR_NB(), detached: true, stdio: ['ignore', log, log], env: envVe(v.ma) }).unref();
  return { ok: true, chu: `đã gửi lệnh: camp mới ${chuGio(g, tuDo(g))}, xong thì tạm dừng #${id}` };
}

/** ✎ ĐỔI ROAS LEVEL camp ★ ROAS đã đẩy Ethopex nhưng CHƯA CHẠY (lich > now) — anh 25/11/2026 #1857 "…hoặc chưa active (nếu đc)". Ethopex không sửa Ad Set được,
 *  nên cùng khuôn 🕒 đổi giờ: camp mới GIỮ NGUYÊN giờ chạy + ngân sách, mức ROAS mới, xong thì tạm dừng camp cũ (nhan-ban.py --thay-cho). Anh bấm = vé trực tiếp. */
export async function doiRoasCamp(campId: number, roas: number): Promise<KqNut> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được đổi ROAS camp' };
  const id = Math.trunc(Number(campId)), r = Math.round(Number(roas) * 100) / 100;
  if (!(r >= ROAS_CR[0] && r <= ROAS_CR[1])) return { loi: `ROAS level phải trong ${ROAS_CR[0]}–${ROAS_CR[1]} (cùng mức nhan-ban.py chấp nhận)` };
  const [c] = await run<{ la_roas: boolean | null; roas: string | null; ngan_sach: string | null; lich: string | null; cho: boolean }>(sql`select c.la_roas, c.roas::text roas, c.ngan_sach::text ngan_sach, to_char(c.lich at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') lich,
      (c.lich is not null and c.lich > now() + interval '5 minutes' and coalesce(c.trang_thai, '') not in ('PAUSED', 'ARCHIVED', 'DELETED')) cho from etp.camp c where c.camp_id = ${id}`);
  if (!c) return { loi: `không thấy camp #${id} trong sổ nhà` };
  if (!c.cho || !c.lich) return { loi: `camp #${id} đã chạy (hoặc còn dưới 5 phút) — ROAS chỉ đổi được cho camp chưa chạy` };
  if (!c.la_roas) return { loi: `camp #${id} không phải camp ★ ROAS — không có ROAS level để đổi` };
  if (c.roas != null && Math.abs(Number(c.roas) - r) < 1e-6) return { loi: `camp #${id} đang là ROAS ${r} rồi` };
  const g = c.lich, ns = Math.trunc(Number(c.ngan_sach ?? 0));
  const lenh = `anh bấm ✎ đổi ROAS camp #${id} trên etp2 → ★ ROAS ${r} (camp mới giữ giờ ${chuGio(g, tuDo(g))}, tạm dừng #${id})`;
  const v = await xinVeTrucTiep('nhan_ban', { camp: id, lenh, ns });
  if (!('ma' in v)) return v;
  const log = openSync(`/tmp/etp-doi-gio-${id}.log`, 'a');   // cùng nhật ký đổi giờ → nhatKyDoiGio đọc lỗi KÊU TO dưới nút
  chayTach('python3', ['nhan-ban.py', String(id), '--roas', String(r), '--ns', String(ns), ...lenhGio(g), '--thay-cho', String(id), '--that',
    '--luat', lenh, '--ai', `anh (etp2 ${me.email})`], { cwd: DIR_NB(), detached: true, stdio: ['ignore', log, log], env: envVe(v.ma) }).unref();
  return { ok: true, chu: `đã gửi lệnh: camp mới ★ ROAS ${r} · $${ns} giữ giờ ${chuGio(g, tuDo(g))}, xong thì tạm dừng #${id}` };
}

/** tail nhật ký đổi giờ (box3 /tmp/etp-doi-gio-<id>.log) — lỗi KÊU TO dưới nút */
export async function nhatKyDoiGio(campId: number): Promise<string | null> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return null;
  try { const t = readFileSync(`/tmp/etp-doi-gio-${Math.trunc(Number(campId))}.log`, 'utf8').trim(); return t ? t.split('\n').slice(-3).join('\n').slice(-400) : null; } catch { return null; }
}
