'use server';
// PHIẾU LÊN CAMP (anh 27/11/2026: "giờ lên camp thì sẽ hiện poster phim, tên phim, ngôn ngữ phim. Sau đó sẽ cho ta chọn form text kiểu K hay D. Chọn xong sẽ tự sinh
// nội dung form text tương ứng. Nếu bấm lại (cho trùng) thì sinh lại tiếp form text. Cho ta chọn tiếp kiểu creative là AD, CC2,... default AD. Các trường link …
// default là search.com. Tương tự với domain. Ngân sách, loại bid … default đc set sẵn … Giờ chạy … khung cố định hoặc custom tuỳ ý nhưng cảnh báo. Khi submit thì mày
// sẽ sx với các thông tin đó … để tao review lại creative 1 lần nữa trc khi đẩy camp lên. Ko cần bước review camp thứ 2 nữa").
// Luồng: guiPhieu ghi etp.phieu_len 'dung' (0488) → AD: etp.mau_dung dt_anh_dong_logo tuy_chon.phieu (dung-mau.py, iMac) · CC2: dòng phim (chayDong, cho_len.py nối phiếu)
// → bản dựng vào etp2 › Chờ lên mang phieu_id → anh ✓ Duyệt (etp-cho-len.ts) = vé trực tiếp + apps/etp/len-phieu.py tải creative rồi tạo camp đúng phiếu.
// Nhãn hiện cho anh chỉ "K" / "D" (anh: "Khi show chỉ viết K hay D. Cấm ghi tên chi tiết").
import { anhUrl } from '@/lib/etp-anh-url';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { soChu, type Kieu, type ChuQc } from '@/lib/etp-chu-so';
import { haiKhung, laKhung } from '@/lib/etp-khung';
import { chayDong, loaiPhieu } from '@/lib/actions/etp-dong';
import { giongCr } from '@/lib/etp-ban';
import { TEN_GIONG } from '@/lib/etp-dang';
import SO_MAU from '@/lib/etp-mau-cr.json';
import BANG_LUAT from '@/lib/etp-bang-luat.json';

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];
async function laAdmin() { const me = await getCurrentUser(); return me?.role === 'admin' ? me : null; }

export type DangPhieu = string;   // 'AD' (mẫu ảnh động) · 'CU' (dùng lại) · mã dòng phim LOAI (CC2, CC, KT, AT, ATT, PO, CTS, LT) — máy kiểm theo loaiPhieu()   // CU = creative CŨ của phim (anh 27/11/2026 "chọn creative cũ … ko phải tạo creative mới nữa"): không dựng, không tốn tiền AI
// CREATIVE CŨ → camp mới: luật 25/11 cấm gắn creative_id cũ vào camp mới → len-phieu.py tạo BẢN MỚI cùng video (ap-form-chu.ban_nha, chữ + link của phiếu) rồi nhan-ban như AD
const CU_TOI_DA = 10, CAMP_TOI_DA = 20;
// GIỌNG + CÂU ĐỌC của AD (anh 27/11/2026 "Phần voice trong video, hook cũng cần show ra ở bước ban đầu này"): mẫu dt_anh_dong_logo KHÔNG có dòng câu nhử chữ trên màn —
// hook = câu mở đầu giọng đọc (sổ etp-mau-cr.json › thu_vien.giong.cau, dung-mau.py đọc cùng sổ). Anh ghim → tuy_chon.o.giong {id: 'en:2', kieu: 'gao'} (dung-mau.py g_ghim / giong_phim)
const CAU = (SO_MAU as unknown as { thu_vien: { giong: { cau: Record<string, string[][]> } } }).thu_vien.giong.cau;
const GIONG_MAC = (BANG_LUAT as unknown as { giong_at: { mac_dinh: string } }).giong_at.mac_dinh;
// trùng apps/xuong-video/scripts/ethopex/anh-tinh.py THE_LOAI_GIONG (giong_phim: anh ghim → AI theo chủ đề → thể loại → mặc định) — chỉ để BÁO trước, máy vẫn tự chọn khi anh không ghim
const THE_LOAI_GIONG: Record<string, string> = { fantasy: 'ky_di', soi: 'ky_di', vien_tuong: 'ky_di', he_thong: 'ky_di', vo_danh: 'gao', ty_phu: 'gao', mafia: 'gao', doi_thuong: 'gao',
  hoi_han: 'cam_xuc', me_con: 'cam_xuc', tinh_cam: 'hao_hung', hoc_duong: 'hao_hung', co_trang: 'hao_hung' };
export type CrCu = { goc: number; nguon: number; dang: string | null; anh: string | null; giong: string | null; n_ban: number; n_camp: number; n_chi: number;
  chi: number; thu: number; chi7: number; thu7: number; ngay: string | null; gan_camp: number | null; gan_tt: string | null;
  // CREATIVE ĐỘI (anh 27/11/2026 "cho chọn lại creative của thành viên trong đội, có ghi rõ để phân biệt"): doi = tên thành viên đội có camp dùng creative này (etp.tai_khoan.nguoi, tk không phải nhà),
  // nha = nhà có camp dùng nó. Creative chỉ đội dùng → số chi / thu là số camp của đội.
  doi: string | null; nha: boolean;
  // CTA của creative (anh 27/11/2026 "dùng lại thì phải hiện CTA của creative đang chọn"): fb = nút Facebook camp cũ của nó (etp.bai_cr.cta), cta_dat = video đạt luật CTA mới
  // (studio ethopex_cta_dat, ghi = lời soát), bản lên lại luôn mang nút form chữ (len-phieu.py)
  fb: string | null; cta_dat: boolean; cta_ghi: string | null };
// DÙNG LẠI POST (anh 27/11/2026 "thêm option used post đang có và cũng show chi tiết hiệu suất giống với của Creative"): bài đăng FB nhà của phim (etp.bai_viet_v, chỉ camp nhà —
// bài của đội không có trong sổ). Camp mới = ★ ROAS clone bài (nhan-ban.py <goc> --roas): ad chỉ mang effective_object_story_id → chữ / link / nút là của BÀI, phiếu không đổi được.
// Luật 25/11 của nhan-ban: miền link của bài phải bằng domain lên camp (phiếu chọn, mặc định mien_len) — khác thì máy chặn, nên drawer khoá sẵn bài khác miền.
export type BaiCu = { bai: string; goc: number; page: string | null; anh: string | null; creative_id: number | null; so_camp: number; so_bat: number;
  chi: number; thu: number; chi7: number; thu7: number; mien: string | null; chay_cuoi: string | null };
const MAU_AD = 'dt_anh_dong_logo';
// CTA (anh 27/11/2026 "Thêm 1 khối nữa là Nội dung CTA"): nút Facebook cố định WATCH_MORE (form-chu.json, cổng dung_form chặn khác); chữ nút TRONG VIDEO của AD chọn được
// từ sổ etp-mau-cr.json › thu_vien.nut.chu (dung-mau.py đọc tuy_chon.o.cta.id = 'en:WATCH MORE'); CC2 cố định WATCH FREE / VER GRATIS (lop-logo-cc2.py NUT_CC2)
const NUT = (SO_MAU as unknown as { thu_vien: { nut: { chu: Record<string, string[]> } } }).thu_vien.nut.chu;
export type DangMo = { ma: string; ten: string; mo_ta: string; gia: string; thoi_gian: string; chay: boolean; khoa: string | null };
const ROAS_MUC = ['dan', '0.9', '1', '1.1', '1.2'] as const;
// NHIỀU MỨC ROAS (0489, anh 27/11/2026): N mức = N creative MỚI (AD: dung-mau tuy_chon.ban = N, mỗi bản một khung) + N camp, thẻ thứ i lên mức roas_ds[i]
export type PhieuMo = {
  cid: number; ten: string | null; lang: string | null; poster: string | null;
  logo: { url: string; kieu: string | null } | null;
  the_loai: string | null;
  giong: { mac: string; the_loai: string | null };   // mac = mặc định sổ luật (giong_at.mac_dinh) · the_loai = giọng theo thể loại phim (bản xoay với mặc định khi anh không ghim)
  cau: { id: string; chu: string }[];                 // câu đọc (hook) theo ngôn ngữ phim, {t} = tên phim
  bai: BaiCu[];                                      // bài đăng nhà của phim (dùng lại post) — chi / thu 7 ngày + tổng theo bài
  cu: CrCu[];                                         // creative cũ của phim: số bản / số camp nhà đã dùng + chi / thu 7 ngày và tổng   // logo gốc đã tách của phim (etp.logo_goc, dung-mau.py đẩy kho) — chưa tách thì null
  chu: { K: ChuQc | null; D: ChuQc };
  mien: string[]; mien_mac: string | null; khung: { gio: string; chu: string }[];
  dang_cho: { id: number; dang: string; trang_thai: string; tao: string }[];   // phiếu đang dở của phim (để anh không gửi trùng)
  dang: DangMo[];                                    // mọi dạng dòng phim máy làm được (LOAI chay) — phiếu không gác
  cta: string[];                                     // chữ nút CTA trong video theo ngôn ngữ phim (sổ nut.chu)
  nhom_goc: string | null;                           // dòng phim chỉ chạy phim Âu-Mỹ
};

/** mở phiếu: poster + tên + ngôn ngữ, chữ K (sổ) / D (form-chu), danh sách domain, hai khung giờ chính */
export async function docPhieu(cid: number): Promise<{ ok: true; p: PhieuMo } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  const id = Math.trunc(Number(cid)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  const [f] = await run<{ ten: string | null; lang: string | null; poster: string | null; the_loai: string | null; nhom_goc: string | null }>(sql`select coalesce(p.ten, v.ten) ten, coalesce(p.locale, v.locale) lang, v.anh poster, p.the_loai, p.nhom_goc
    from (select ${id}::int content_id) k left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)`);
  if (!f?.ten) return { loi: `phim #${id} không có trong etp.phim / thư viện phim` };
  const so = await soChu([id]);
  const [m] = await run<{ mac: string | null; ds: string[] | null }>(sql`select (select gia_tri #>> '{}' from etp.cau_hinh where khoa = 'mien_len') mac,
    (select array_agg(mien order by n desc) from (select mien, count(*) n from etp.camp where mien is not null and mien <> '' group by mien order by n desc limit 12) t) ds`);
  const mien = [...new Set([m?.mac, ...(m?.ds ?? [])].filter((x): x is string => !!x))];
  const dang = await run<{ id: number; dang: string; trang_thai: string; tao: string }>(sql`select id, dang, trang_thai, tao::text tao from etp.phieu_len
    where content_id = ${id} and trang_thai in ('dung', 'cho_duyet', 'len', 'loi') and tao > now() - interval '3 days' order by tao desc`);
  const [lg] = await run<{ url: string; kieu: string | null }>(sql`select url, kieu from etp.logo_goc where content_id = ${id}`);
  const lc = (f.lang ?? '').startsWith('es') ? 'es' : 'en', ten = f.ten;
  const cau = (CAU[lc] ?? []).map((m, i) => ({ id: `${lc}:${i}`, chu: m.map((v) => v.replace('{t}', ten)).join(' ') }));
  const cu = (await docCrCu(id)).map((x) => ({ ...x, anh: anhUrl(x.anh) }));
  const bai = (await docBai(id)).map((x) => ({ ...x, anh: anhUrl(x.anh) }));
  return { ok: true, p: { cid: id, ten: f.ten, lang: f.lang, poster: anhUrl(f.poster), logo: lg ? { url: lg.url, kieu: lg.kieu } : null,
    the_loai: f.the_loai, giong: { mac: GIONG_MAC, the_loai: THE_LOAI_GIONG[f.the_loai ?? ''] ?? null }, cau, cu, bai, chu: { K: so.kien(id), D: so.dol }, mien, mien_mac: m?.mac ?? null, khung: haiKhung(), dang_cho: dang,
    dang: await loaiPhieu(), cta: NUT[lc] ?? [], nhom_goc: f.nhom_goc } };
}

/** CREATIVE CŨ của phim, gom theo GỐC (bản lượt 2 / bản phiếu cũ tính về creative gốc của nó): số bản, số camp NHÀ (cr_co_camp.doi = false — số đội không tính),
 *  chi / thu 7 ngày + tổng (etp.so_ngay_ca), camp gần nhất. Nguồn tạo bản mới = bản mới nhất còn video, không bị từ chối, được lên (cham_cong.duoc_len). */
async function docCrCu(cid: number): Promise<CrCu[]> {
  return run<CrCu>(sql`with cr as (select c.creative_id, c.dang, c.video, coalesce(nullif(c.anh, ''), (select a.anh from etp.anh_cr a where a.creative_id = c.creative_id)) anh,
      coalesce(c.tu_choi, '') tc, coalesce(cc.duoc_len, false) dl,
      coalesce((select l.cr_goc from etp.luot2 l where l.cr_moi = c.creative_id limit 1),
               (select (k.muc ->> 'cr_cu')::int from etp.cho_len k where k.creative_id = c.creative_id and k.muc ? 'cr_cu' limit 1), c.creative_id) goc
    from etp.creative c left join etp.cham_cong cc using (creative_id) where c.content_id = ${cid}),
  cx as (select distinct cr.goc, x.camp_id, x.doi from cr join etp.cr_co_camp x on x.creative_id = cr.creative_id),
  nh as (select goc, bool_or(not doi) nha from cx group by goc),
  ca as (select cx.goc, cx.camp_id from cx join nh using (goc) where cx.doi = not nh.nha),   -- số của nhà; creative chỉ đội dùng → số camp đội
  dn as (select cx.goc, string_agg(distinct t.nguoi, ', ') ten from cx join etp.camp_ngoai n on n.camp_id = cx.camp_id join etp.tai_khoan t on t.ad_account_id = n.ad_account_id
    where cx.doi and not coalesce(t.nha, false) and t.nguoi is not null group by cx.goc),
  so as (select ca.goc, count(distinct ca.camp_id) n_camp, count(distinct s.camp_id) filter (where s.chi > 0) n_chi, coalesce(sum(s.chi), 0) chi, coalesce(sum(s.thu), 0) thu,
      coalesce(sum(s.chi) filter (where s.ngay > current_date - 7), 0) chi7, coalesce(sum(s.thu) filter (where s.ngay > current_date - 7), 0) thu7, (max(s.ngay) filter (where s.chi > 0))::text ngay
    from ca left join etp.so_ngay_ca s using (camp_id) group by ca.goc),
  gan as (select distinct on (ca.goc) ca.goc, m.camp_id, m.trang_thai from ca join etp.camp m using (camp_id) order by ca.goc, m.tao desc nulls last),
  ng as (select distinct on (goc) goc, creative_id nguon, dang, anh from cr where video is not null and tc = '' and dl order by goc, creative_id desc)
  select ng.goc, ng.nguon, ng.dang, ng.anh, ${giongCr('ng.nguon')} giong, (select count(*) from cr where cr.goc = ng.goc)::int n_ban, coalesce(so.n_camp, 0)::int n_camp, coalesce(so.n_chi, 0)::int n_chi,
    round(coalesce(so.chi, 0)::numeric, 2)::float chi, round(coalesce(so.thu, 0)::numeric, 2)::float thu, round(coalesce(so.chi7, 0)::numeric, 2)::float chi7, round(coalesce(so.thu7, 0)::numeric, 2)::float thu7,
    so.ngay, gan.camp_id gan_camp, gan.trang_thai gan_tt, dn.ten doi, coalesce(nh.nha, false) nha,
    (select b.cta from etp.bai_cr b where b.creative_id = ng.nguon and b.cta is not null limit 1) fb, coalesce(c.cta_dat, false) cta_dat,
    (select k.gia_tri -> ng.nguon::text ->> 'ghi' from xv_khoa_ngoai k where k.ten = 'ethopex_cta_dat') cta_ghi
  from ng left join so using (goc) left join gan using (goc) left join nh using (goc) left join dn using (goc) left join etp.creative c on c.creative_id = ng.nguon order by coalesce(so.chi7, 0) desc, coalesce(so.chi, 0) desc, ng.nguon desc limit 40`);
}

/** BÀI ĐĂNG NHÀ của phim: số camp / đang bật / chi / thu (tổng + 7 ngày) từ etp.bai_viet_v; goc = camp nhà MỚI NHẤT mang bài (nhan-ban đọc khuôn camp + ad từ đó),
 *  miền = etp.camp.mien của camp đó (nhan-ban mien_goc), ảnh = ảnh creative của bài */
async function docBai(cid: number): Promise<BaiCu[]> {
  return run<BaiCu>(sql`select b.bai_viet bai, g.camp_id goc, b.page_ten page, b.creative_id,
      coalesce((select nullif(c.anh, '') from etp.creative c where c.creative_id = b.creative_id), (select a.anh from etp.anh_cr a where a.creative_id = b.creative_id), b.page_anh) anh,
      coalesce(b.so_camp, 0)::int so_camp, coalesce(b.so_bat, 0)::int so_bat, round(coalesce(b.chi, 0)::numeric, 2)::float chi, round(coalesce(b.thu, 0)::numeric, 2)::float thu,
      round(coalesce(b.chi7, 0)::numeric, 2)::float chi7, round(coalesce(b.thu7, 0)::numeric, 2)::float thu7, g.mien, b.chay_cuoi::text chay_cuoi
    from etp.bai_viet_v b
    join lateral (select camp_id, mien from etp.camp m where m.bai_viet = b.bai_viet order by m.tao desc nulls last, m.camp_id desc limit 1) g on true
    where b.content_id = ${cid} and b.bai_viet ~ '^[0-9]+_[0-9]+$'
      -- chỉ bài ĐANG CÓ LÃI (anh 27/11/2026): có tiêu 7 ngày thì xét lãi 7 ngày, không thì xét lãi tổng
      and (case when coalesce(b.chi7, 0) > 0 then coalesce(b.thu7, 0) > b.chi7 else coalesce(b.thu, 0) > coalesce(b.chi, 0) end)
    order by coalesce(b.chi7, 0) desc, coalesce(b.chi, 0) desc limit 40`);
}

/** chọn K (hoặc bấm K lần nữa) → máy sinh bộ chữ K mới cho phim (apps/etp/sinh-chu-kien.py --lai --xem --json: không ghi sổ, chữ chỉ đi theo phiếu khi gửi) */
export async function sinhChuK(cid: number, lang?: 'en' | 'es'): Promise<{ ok: true; chu: ChuQc; vnd: number; lang: string } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  const id = Math.trunc(Number(cid)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  const tep = path.join(process.cwd(), '..', 'etp', 'sinh-chu-kien.py');
  const link = (await soChu([])).kien(0)?.link ?? 'search.com';
  return await new Promise((ok) => execFile('python3', [tep, String(id), '--lai', '--xem', '--json', ...(lang === 'en' || lang === 'es' ? ['--lang', lang] : [])], { timeout: 240_000, maxBuffer: 1 << 20, cwd: path.join(process.cwd(), '..', '..') }, (e, out, err) => {
    const ra = `${out ?? ''}`, dong = ra.split('\n').find((l) => l.startsWith('JSON:'));
    if (!dong) return ok({ loi: `sinh chữ K lỗi: ${(ra.split('\n').find((l) => l.startsWith('✗'))?.slice(2) ?? `${err ?? ''}`.trim().split('\n').slice(-2).join(' ') ?? e?.message ?? '?').slice(0, 400)}` });
    try {
      const j = JSON.parse(dong.slice(5)) as { primaryTexts: string[]; headlines: string[]; descriptions: string[]; vnd: number; lang: string };
      ok({ ok: true, lang: j.lang, chu: { pt: j.primaryTexts ?? [], hl: j.headlines ?? [], de: j.descriptions ?? [], link }, vnd: Number(j.vnd) || 0 });
    } catch (x) { ok({ loi: `đọc chữ K lỗi: ${(x as Error).message}` }); }
  }));
}

export type PhieuGui = { cid: number; kieu: Kieu; chu: { pt: string[]; hl: string[]; de: string[] }; link: string; dang: DangPhieu; mien: string | null;
  roas: string[]; ns: number; gio: string;
  bai?: string[];                        // dạng BAI: mã bài đăng (BaiCu.bai) — mỗi bài × mỗi mức ROAS = một camp clone bài
  cr_cu?: number[];                      // dạng CU: creative NGUỒN (CrCu.nguon) anh chọn — mỗi creative × mỗi mức ROAS = một camp
  giong?: { id?: string; kieu?: string };
  cta?: string };                        // AD: chữ nút trong video 'en:WATCH MORE' (sổ nut.chu) — bỏ trống = mặc định mẫu. Ngôn ngữ chữ form chỉ đổi lúc SINH (sinhChuK lang); phieu_len.lang giữ ngôn ngữ phim (camp theo khuôn Kiên)   // AD: anh ghim câu đọc (hook, 'en:2') / kiểu giọng — bỏ trống = máy chọn   // roas: 1–5 mức khác nhau, mỗi mức một creative + một camp   // gio: 'lich' (khung gần nhất) | 'YYYY-MM-DD HH:MM' giờ VN

/** ✓ Gửi phiếu → ghi etp.phieu_len rồi giao máy dựng đúng dạng. Creative dựng xong vào Chờ lên; anh duyệt creative = lên camp với đúng phiếu này. */
export async function guiPhieu(g: PhieuGui): Promise<{ ok: true; id: number; chu: string } | { loi: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  const cid = Math.trunc(Number(g.cid)); if (!(cid > 0)) return { loi: 'mã phim không hợp lệ' };
  if (g.kieu !== 'kien' && g.kieu !== 'dol') return { loi: 'kiểu chữ phải là K hoặc D' };
  const dsDang = await loaiPhieu();
  const laBai = g.dang === 'BAI';
  const ld = g.dang === 'AD' || g.dang === 'CU' || laBai ? null : dsDang.find((x) => x.ma === g.dang);
  if (g.dang !== 'AD' && g.dang !== 'CU' && !laBai && !ld) return { loi: `kiểu creative lạ: ${g.dang}` };
  if (ld && !ld.chay) return { loi: `${ld.ten}: ${ld.khoa}` };
  const cta = g.dang === 'AD' && g.cta ? String(g.cta) : null;
  if (cta) { const [l, ...r] = cta.split(':'); if (!(NUT[l ?? ''] ?? []).includes(r.join(':'))) return { loi: `chữ nút CTA lạ: ${cta}` }; }
  const crCu = g.dang === 'CU' ? [...new Set((g.cr_cu ?? []).map((x) => Math.trunc(Number(x))).filter((x) => x > 0))] : [];
  if (g.dang === 'CU' && !crCu.length) return { loi: 'chọn ít nhất một creative cũ' };
  if (crCu.length > CU_TOI_DA) return { loi: `tối đa ${CU_TOI_DA} creative cũ mỗi phiếu` };
  const gKieu = g.dang === 'AD' && g.giong?.kieu ? String(g.giong.kieu) : null, gId = g.dang === 'AD' && g.giong?.id ? String(g.giong.id) : null;
  if (gKieu && !(gKieu in TEN_GIONG)) return { loi: `kiểu giọng lạ: ${gKieu}` };
  if (gId && !/^[a-z]{2}:\d+$/.test(gId)) return { loi: `câu đọc lạ: ${gId}` };
  const baiDs = laBai ? [...new Set((g.bai ?? []).map(String).filter((x) => /^\d+_\d+$/.test(x)))] : [];
  if (laBai && !baiDs.length) return { loi: 'chọn ít nhất một bài đăng' };
  if (baiDs.length > CU_TOI_DA) return { loi: `tối đa ${CU_TOI_DA} bài đăng mỗi phiếu` };
  const pt = (g.chu?.pt ?? []).map(String).filter(Boolean), hl = (g.chu?.hl ?? []).map(String).filter(Boolean), de = (g.chu?.de ?? []).map(String).filter(Boolean);
  if (!laBai && (!pt.length || !hl.length)) return { loi: 'chữ QC trống — chọn K (máy sinh) hoặc D trước khi gửi' };
  const link = laBai ? 'search.com' : String(g.link ?? '').trim(); if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(link)) return { loi: `link không hợp lệ: ${link}` };
  const mien = g.mien ? String(g.mien).trim() : null; if (mien && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(mien)) return { loi: `domain không hợp lệ: ${mien}` };
  const roasDs = [...new Set((Array.isArray(g.roas) ? g.roas : [g.roas]).map(String))];
  if (!roasDs.length) return { loi: 'chọn ít nhất một mức bid ROAS' };
  const la = roasDs.find((x) => !(ROAS_MUC as readonly string[]).includes(x)); if (la) return { loi: `bid ROAS phải là dàn hoặc 0.9–1.2 (nhận ${la})` };
  roasDs.sort((a, b) => ROAS_MUC.indexOf(a as never) - ROAS_MUC.indexOf(b as never)); const roas = roasDs.join(',');
  const ns = Math.trunc(Number(g.ns)); if (!(ns >= 1 && ns <= 50)) return { loi: 'ngân sách phải từ $1 tới $50' };
  const gio = String(g.gio ?? 'lich').trim().replace('T', ' ').slice(0, 16);
  if (gio !== 'lich' && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(gio)) return { loi: `giờ chạy không hợp lệ: ${g.gio}` };
  const tuDo = gio !== 'lich' && !laKhung(gio);
  if (baiDs.length * roasDs.length > CAMP_TOI_DA) return { loi: `${baiDs.length} bài × ${roasDs.length} mức ROAS = ${baiDs.length * roasDs.length} camp — tối đa ${CAMP_TOI_DA} mỗi phiếu` };
  if (crCu.length * roasDs.length > CAMP_TOI_DA) return { loi: `${crCu.length} creative × ${roasDs.length} mức ROAS = ${crCu.length * roasDs.length} camp — tối đa ${CAMP_TOI_DA} mỗi phiếu` };
  const [f] = await run<{ lang: string | null; ten: string | null; cam: string | null }>(sql`select coalesce(p.locale, v.locale) lang, coalesce(p.ten, v.ten) ten,
      (select gia_tri -> ${String(cid)} ->> 'ly_do' from xv_khoa_ngoai where ten = 'ethopex_phim_cam' and jsonb_typeof(gia_tri) = 'object' and gia_tri ? ${String(cid)}) cam
    from (select ${cid}::int content_id) k left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)`);
  if (f?.cam) return { loi: `PHIM CẤM — không dựng: ${f.cam}` };
  type CrNguon = { creative_id: number; video: string; anh: string | null; dang: string | null; giay: number | null };
  const nguon = crCu.length ? await run<CrNguon>(sql`select c.creative_id, c.video, coalesce(nullif(c.anh, ''), (select a.anh from etp.anh_cr a where a.creative_id = c.creative_id)) anh, c.dang,
      (c.den - c.tu)::float giay from etp.creative c left join etp.cham_cong cc using (creative_id)
    where c.content_id = ${cid} and c.creative_id = any(${`{${crCu.join(',')}}`}::int[]) and c.video is not null and coalesce(c.tu_choi, '') = '' and coalesce(cc.duoc_len, false)`) : [];
  const thieu = crCu.filter((x) => !nguon.some((o) => o.creative_id === x));
  if (thieu.length) return { loi: `creative ${thieu.map((x) => `#${x}`).join(', ')} không dùng lại được (khác phim / không có video / bị từ chối / chưa được lên) — tải lại phiếu` };
  const baiCo = laBai ? (await docBai(cid)).filter((b) => baiDs.includes(b.bai)) : [];
  if (laBai) {
    const ml = mien ?? (await run<{ m: string | null }>(sql`select gia_tri #>> '{}' m from etp.cau_hinh where khoa = 'mien_len'`))[0]?.m ?? null;
    const la = baiDs.filter((x) => !baiCo.some((b) => b.bai === x));
    if (la.length) return { loi: `bài ${la.join(', ')} không phải bài nhà của phim này — tải lại phiếu` };
    const lech = baiCo.filter((b) => (b.mien ?? '') !== (ml ?? ''));
    if (lech.length) return { loi: `bài ${lech.map((b) => `${b.bai} (${b.mien ?? 'chưa rõ miền'})`).join(', ')} khác domain lên camp ${ml ?? '?'} — máy chặn clone bài khác miền; chọn domain đúng miền của bài` };
  }
  const [trung] = g.dang === 'CU' || laBai ? [] : await run<{ id: number }>(sql`select id from etp.phieu_len where content_id = ${cid} and dang = ${g.dang} and trang_thai = 'dung' and tao > now() - interval '2 days'`);
  if (trung) return { loi: `phim này đang có phiếu #${trung.id} dạng ${g.dang} chờ máy dựng — chờ bản dựng vào Chờ lên rồi gửi phiếu mới` };
  const chu = laBai ? null : JSON.stringify({ pt, hl, de });
  const [p] = await run<{ id: number }>(sql`insert into etp.phieu_len (content_id, lang, kieu, chu, link, dang, mien, roas, roas_ds, ns, gio, tu_do, ai)
    values (${cid}, ${f?.lang ?? null}, ${g.kieu}, ${chu}::jsonb, ${link}, ${g.dang}, ${mien}, ${roas}, ${`{${roas}}`}::text[], ${ns}, ${gio}, ${tuDo}, ${me.email}) returning id`);
  if (!p) return { loi: 'không ghi được phiếu' };
  const k = g.kieu === 'kien' ? 'K' : 'D';
  const loiPhieu = async (l: string) => { await run(sql`update etp.phieu_len set trang_thai = 'loi', loi = ${l.slice(0, 400)}, cap_nhat = now() where id = ${p.id}`); return { loi: l }; };
  if (laBai) {
    // mỗi bài × mỗi mức ROAS = một thẻ Chờ lên (muc.bai + muc.goc); không dựng gì — anh duyệt thẻ là len-phieu.py chạy nhan-ban.py <goc> --roas (clone bài, giữ chữ / link / nút của bài)
    for (const b of baiCo) for (const r of roasDs) {
      await run(sql`insert into etp.cho_len (khoa, content_id, lang, dang, ten, ma, video, anh, giay, muc, ghi, kieu, phieu_id, phieu_roas)
        values (${`bai:${p.id}:${b.bai}:${r}`}, ${cid}, ${f?.lang ?? null}, 'BAI', ${f?.ten ?? null}, ${`bai ${b.bai}`},
          (select c.video from etp.creative c where c.creative_id = ${b.creative_id}), ${b.anh}, null,
          ${JSON.stringify({ bai: b.bai, goc: b.goc, cr: b.creative_id, ten: f?.ten ?? null })}::jsonb,
          ${`dùng lại post ${b.bai} (camp #${b.goc}, ${b.page ?? 'Page ?'}) — không dựng: duyệt là clone bài sang camp mới ★ ROAS, chữ / link / nút giữ của bài`},
          ${g.kieu}, ${p.id}, ${r}) on conflict (khoa) do nothing`);
    }
    await run(sql`update etp.phieu_len set trang_thai = 'cho_duyet', cap_nhat = now() where id = ${p.id}`);
  } else if (g.dang === 'CU') {
    // mỗi creative × mỗi mức ROAS = một thẻ Chờ lên mang sẵn video + muc.cr_cu; cho_len.py (iMac) KHÔNG tải thẻ này — len-phieu.py tạo bản mới cùng video lúc anh duyệt
    for (const c of nguon) for (const r of roasDs) {
      await run(sql`insert into etp.cho_len (khoa, content_id, lang, dang, ten, ma, video, anh, giay, muc, ghi, kieu, phieu_id, phieu_roas)
        values (${`cu:${p.id}:${c.creative_id}:${r}`}, ${cid}, ${f?.lang ?? null}, ${c.dang ?? 'CU'}, ${f?.ten ?? null}, ${`cr${c.creative_id}`}, ${c.video}, ${c.anh}, ${c.giay},
          ${JSON.stringify({ cr_cu: c.creative_id, ten: f?.ten ?? null })}::jsonb, ${`creative cũ #${c.creative_id} — không dựng: duyệt là tạo bản mới cùng video với chữ ${k} của phiếu #${p.id} rồi lên camp`},
          ${g.kieu}, ${p.id}, ${r}) on conflict (khoa) do nothing`);
    }
    await run(sql`update etp.phieu_len set trang_thai = 'cho_duyet', cap_nhat = now() where id = ${p.id}`);
  } else if (g.dang === 'AD') {
    const [dang] = await run<{ tt: string }>(sql`select trang_thai tt from etp.mau_dung where mau = ${MAU_AD} and content_id = ${cid} and trang_thai in ('dang', 'cho', 'cho_nang_cap') and (tuy_chon is not null or trang_thai = 'dang')`);
    if (dang) return await loiPhieu(`AD đang dựng cho phim này (${dang.tt === 'dang' ? 'đang làm' : 'đang chờ máy'}) — chờ xong rồi gửi phiếu mới`);
    const r = await run<{ mau: string }>(sql`insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi, ten_mau, tuy_chon)
      values (${MAU_AD}, ${cid}, 'cho', 'cho', ${`phiếu lên camp #${p.id} — chờ máy dựng ${roasDs.length} bản AD (iMac) nhận`}, 'Ảnh động logo gốc + CTA', ${JSON.stringify({ phieu: p.id, ban: roasDs.length, ...(gKieu || gId || cta ? { o: { ...(gKieu || gId ? { giong: { ...(gId ? { id: gId } : {}), ...(gKieu ? { kieu: gKieu } : {}) } } : {}), ...(cta ? { cta: { id: cta } } : {}) } } : {}) })}::jsonb)
      on conflict (mau, content_id) do update set buoc = 'cho', trang_thai = 'cho', tuy_chon = excluded.tuy_chon, cap_nhat = now(), ghi = excluded.ghi
      where etp.mau_dung.trang_thai in ('loi', 'cho', 'xong', 'dung') returning mau`);
    if (!r[0]) return await loiPhieu('việc dựng AD của phim đang ở trạng thái không nhận bản mới');
  } else {
    const r = await chayDong(cid, g.dang, '', undefined, null, p.id);
    if ('loi' in r) return await loiPhieu(`dòng ${g.dang}: ${r.loi}`);
  }
  const chuGio = gio === 'lich' ? `khung gần nhất (${haiKhung()[0]?.chu ?? ''})` : `${gio}${tuDo ? ' ⚠ ngoài khung' : ''}`;
  if (laBai) return { ok: true, id: p.id, chu: `đã gửi phiếu #${p.id}: dùng lại ${baiDs.length} post × ${roasDs.length} mức ROAS = ${baiDs.length * roasDs.length} thẻ ở Chờ lên · ${mien ?? 'domain mặc định'} · $${ns} · ${chuGio} — không dựng, chữ / link / nút giữ của bài; anh duyệt thẻ nào là máy clone bài đó sang camp mới` };
  if (g.dang === 'CU') return { ok: true, id: p.id, chu: `đã gửi phiếu #${p.id}: ${k} · ${crCu.length} creative cũ × ${roasDs.length} mức ROAS = ${crCu.length * roasDs.length} thẻ ở Chờ lên · ${link} · ${mien ?? 'domain mặc định'} · $${ns} · ${chuGio} — không dựng creative mới; anh duyệt thẻ nào là máy tạo bản cùng video với chữ phiếu rồi lên camp` };
  return { ok: true, id: p.id, chu: `đã gửi phiếu #${p.id}: ${k} · ${g.dang} · ${link} · ${mien ?? 'domain mặc định'} · ROAS ${roasDs.map((x) => x === 'dan' ? 'dàn' : x).join(' / ')} · $${ns} · ${chuGio} — máy dựng ${roasDs.length} creative mới (mỗi mức ROAS một bản), xong hiện ở Chờ lên, anh duyệt bản nào là lên camp mức của bản đó` };
}
