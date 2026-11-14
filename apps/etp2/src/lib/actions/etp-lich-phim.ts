'use server';
// LỊCH TRIỂN KHAI + ĐIỀU KHIỂN TỪNG PHIM (anh 06/11/2026 "Show cái icon lịch. Hover vào thì xem được lịch triển khai của từng phim để đạt mục tiêu" ·
// "thêm chức năng … tăng camp loại A, B… giảm số camp… quá trình sx đang diễn ra có lỗi gì ko" · "các đồng hồ đang có chưa dùng đến à" ·
// "Phần có thể điều khiển + plan thì chỉ show ở tk của David"): bấm đồng hồ thị trường trên dòng phim (tab Camp) → bảng nổi lịch + nút.
// CHỈ VAI CHỦ — mọi hàm kiểm trên máy chủ. Đọc từ máy đang có: etp.phim.thu_vong (cat_phim) · etp.mo_rong (đồng hồ thị trường) · etp.thay_the (camp thay / chờ) ·
// etp.dong_phim + dong_buoc (sản xuất) · etp.nhat_ky (cổng lên camp chặn 24 giờ) · etp.cau_hinh khung_hoan (sổ hoãn của máy luật).
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { campToaSql, docCampToa, type CampToa } from '@/lib/etp-toa-sql';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { chayDong, dangGac } from '@/lib/actions/etp-dong';
import BANG_LUAT from '@/lib/etp-bang-luat.json';

export type LichDang = { dang: string; chay: number; lai: number; lo: number; chi7: number; thu7: number };   // CHỈ camp đang chạy, lãi / lỗ theo 7 ngày (anh 07/11/2026 "mục tiêu là camp active")
export type LichSx = { id: number; trang_thai: string; loai: string; so_camp: number | null; /** lý do dừng (etp.dong_phim.ly_do) */ ly_do: string | null; /** tạo trong 24 giờ — dòng dừng vẫn hiện kèm lý do, không biến mất (#1598) */ moi: boolean; buoc: { buoc: string; trang_thai: string; ghi: string | null; bat_dau: string | null; ket_qua: unknown }[]; tao: string };
export type LichPhim = {
  content_id: number; ten: string | null; vong: string | null; ly: string | null; pha: string | null; muc_hut: number | null; chi_gan: number | null;
  chi: number; thu: number; moc_chi: number; so_thu: number; moc_thu: number; camp_lai: number; roas: number; dang: LichDang[];
  // CAMP MỚI (anh 07/11/2026 "chưa có thông tin về kế hoạch, sx, chờ lên"): kế hoạch etp.mo_rong · camp đã tạo hẹn giờ · creative sạch chờ · đợt gần nhất lên thiếu · máy có tự mở không (etp.phim_doi_lai, dong_phim.mo_doi_lai)
  ke: { trang_thai: string; k: number; san: number; can_sx: number; ly: string } | null; hen: { camp_id: number; luc: string }[]; tu_len: number; thieu: string | null; may_mo: boolean;
  lt: { ma: string; chu: string; ke: number; dang: Record<string, { da: number; chi: number; bo: boolean }> } | null;   // lộ trình tự động thí điểm (apps/etp/lo_trinh_phim.py)
  thay: { kieu: string; buoc: string; ghi: string | null } | null; sx: LichSx[]; hoan: { camp_id: number; huong: string }[];
  // LỘ TRÌNH SCALE (anh 07/11/2026 "phim đang có camp thắng phải show rõ … kế hoạch mở rộng và nhân bản camp cũng như lên bậc"): camp Nhà đang chạy lãi 7 ngày,
  // đủ số để trang chấm đúng cổng máy luật (lên bậc · nhân bản hai nấc · ★ ROAS) — ngưỡng đọc ở sổ luật chung, không ở đây
  thang: CampThang[]; cr: { san: number; chan: number }; doi_lai: { chi: number; roi: number; ngay: number }; do_toi: string | null;
  // TOÀ NHÀ (anh 15/11/2026 "giống kiểu hình một toà nhà"): MỌI camp đang chạy của phim, mỗi camp một khối — cùng cửa sổ 7 ngày + cùng tập camp với `dang`
  camp: CampToa[]; camp_tat: CampToa[];   // camp_tat: camp đã tắt còn chi trong 30 ngày (cây héo ở thửa túp lều / nhà cấp 4)
  /** dạng dòng đang gác (etp.cau_hinh.gac_dang) — nút ＋ dạng đó tắt, chữ rê nói vì sao (#1598) */
  gac: string[];
};
export type { CampToa } from '@/lib/etp-toa-sql';   // kiểu + câu SQL camp của toà nhà ở MỘT chỗ (lib/etp-toa-sql.ts)
/** một camp thắng: ngân sách · chi / thu 30 ngày (cửa sổ máy luật dùng cho nấc nhân bản + ROAS) · 3 ngày gần · hôm nay (ngày Ethopex = ngày UTC) · tới 13:00 VN · lần tăng gần nhất */
export type CampThang = { camp_id: number; ten: string; ns: number; la_ban: boolean; co_roas: boolean; ban: number; chi30: number; thu30: number; chi7: number; thu7: number; chi3: number; thu3: number;
  chi_nay: number; thu_nay: number; chi13: number; ns13: number | null; tang_luc: string | null };

async function laChu() { const q = await quyenEtp(await getCurrentUser()); return q?.vai === 'chu'; }
const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

export async function docLichPhim(contentId: number): Promise<LichPhim | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ chủ xem lịch phim' };
  const id = Math.trunc(Number(contentId)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  const [[p], dang, [thay], sx, [kh], [mc], [ke], hen, [cho], [lt]] = await Promise.all([
    run<Omit<LichPhim, 'dang' | 'thay' | 'sx' | 'hoan' | 'moc_chi' | 'moc_thu' | 'ke' | 'hen' | 'tu_len' | 'thieu' | 'may_mo' | 'lt' | 'thang' | 'cr' | 'doi_lai' | 'do_toi'>>(sql`
      with s as (select c.camp_id, c.la_roas, sum(n.chi) chi, sum(n.thu) thu from etp.camp c join etp.so_ngay n using (camp_id) where c.content_id = ${id} group by 1, 2)
      select ${id}::int content_id, p.ten, p.thu_vong vong, p.thu_ly ly, m.pha, m.muc_hut::float, m.chi_gan::float,
        coalesce((select sum(chi) from s), 0)::float chi, coalesce((select sum(thu) from s), 0)::float thu,
        (select count(*) from s where chi >= 1)::int so_thu, (select count(*) from s where chi >= 1 and thu > chi and not la_roas)::int camp_lai,   -- cùng cách đếm với thanh từng dạng (không tính ROAS — ROAS đếm riêng)
        (select count(*) from etp.camp where content_id = ${id} and la_roas and trang_thai = 'ACTIVE')::int roas
      from (select 1) o left join etp.phim p on p.content_id = ${id} left join etp.mo_rong m on m.content_id = ${id}`),
    run<LichDang>(sql`with s as (select c.camp_id, case when c.la_roas then 'ROAS' else coalesce(r.dang, '?') end dang, coalesce(sum(n.chi), 0) chi, coalesce(sum(n.thu), 0) thu from etp.camp c
        left join etp.creative r using (creative_id) left join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay >= current_date - 6
        where c.content_id = ${id} and c.trang_thai = 'ACTIVE' group by 1, 2)   -- gồm cả camp ROAS: phải khớp số camp ở dòng phim (anh 07/11/2026)
      select dang, count(*)::int chay, count(*) filter (where chi >= 1 and thu > chi)::int lai, count(*) filter (where chi >= 1 and thu <= chi)::int lo, sum(chi)::float chi7, sum(thu)::float thu7
      from s group by 1 order by 2 desc`),
    run<LichPhim['thay']>(sql`select kieu, buoc, ghi from etp.thay_the where content_id = ${id} and buoc not in ('chay', 'huy') order by id desc limit 1`),
    run<LichSx>(sql`select d.id, d.trang_thai, d.loai, d.so_camp, left(d.ly_do, 200) ly_do, d.tao_luc > now() - interval '1 day' moi, d.tao_luc::text tao, coalesce((select json_agg(json_build_object('buoc', b.buoc, 'trang_thai', b.trang_thai, 'ghi', left(b.ghi, 160), 'bat_dau', b.bat_dau, 'ket_qua', b.ket_qua) order by b.thu_tu)
        from etp.dong_buoc b where b.dong_id = d.id), '[]') buoc from etp.dong_phim d where d.content_id = ${id} and d.trang_thai in ('chay', 'loi', 'dung') order by d.id desc limit 3`),
    run<{ g: Record<string, unknown> | null }>(sql`select gia_tri g from etp.cau_hinh where khoa = 'khung_hoan'`),
    run<{ chi: number; so: number }>(sql`select coalesce((gia_tri->>'chi')::float, 25) chi, coalesce((gia_tri->>'so_thu')::int, 4) so from etp.cau_hinh where khoa = 'cat_phim'`),
    run<NonNullable<LichPhim['ke']>>(sql`select trang_thai, k, san, can_sx, ly from etp.mo_rong where content_id = ${id}`),
    run<LichPhim['hen'][number]>(sql`select camp_id, to_char(lich at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') luc from etp.camp where content_id = ${id} and trang_thai = 'ACTIVE' and lich > now() order by lich`),
    run<{ tu_len: number; thieu: string | null; may_mo: boolean }>(sql`select (select count(*) from etp.cho_len_v where content_id = ${id} and ly_do is null)::int tu_len,
      (select b.ghi from etp.dong_phim d join etp.dong_buoc b on b.dong_id = d.id and b.buoc = 'camp' where d.content_id = ${id} and d.trang_thai = 'xong' and d.tao_luc > now() - interval '3 days' and b.ghi like '%thiếu%' order by d.id desc limit 1) thieu,
      (exists (select 1 from etp.phim_doi_lai where content_id = ${id}) and coalesce((select pha from etp.mo_rong where content_id = ${id}), '') <> 'bao_hoa') may_mo`),
    run<{ g: LichPhim['lt'] }>(sql`select gia_tri->${String(id)} g from etp.cau_hinh where khoa = 'lo_trinh_tt'`),
  ]);
  const DON_GIO = Number(BANG_LUAT.khung_doi.don_gio);
  const [thang, [kho], camp, gac] = await Promise.all([
    run<CampThang>(sql`with nay as (select (now() at time zone 'utc')::date d), c as (select camp_id, ten, ngan_sach from etp.camp where content_id = ${id} and trang_thai = 'ACTIVE' and not la_roas),
        s as (select n.camp_id, sum(n.chi) filter (where n.ngay >= nay.d - 29) chi30, sum(n.thu) filter (where n.ngay >= nay.d - 29) thu30,
                sum(n.chi) filter (where n.ngay >= nay.d - 6) chi7, sum(n.thu) filter (where n.ngay >= nay.d - 6) thu7, sum(n.chi) filter (where n.ngay >= nay.d - 2) chi3, sum(n.thu) filter (where n.ngay >= nay.d - 2) thu3,
                sum(n.chi) filter (where n.ngay = nay.d) chi_nay, sum(n.thu) filter (where n.ngay = nay.d) thu_nay from etp.so_ngay n, nay where n.camp_id in (select camp_id from c) group by 1)
      select c.camp_id::int, c.ten, c.ngan_sach::float ns, c.ten ~ '\(nhan ban \d+ cua \d+\)$' la_ban,
        exists (select 1 from etp.camp r where r.la_roas and r.goc = c.camp_id) co_roas,
        (select count(*) from etp.camp b where b.goc = c.camp_id and b.ten ~ '\(nhan ban \d+ cua \d+\)$')::int ban,
        coalesce(s.chi30, 0)::float chi30, coalesce(s.thu30, 0)::float thu30, coalesce(s.chi7, 0)::float chi7, coalesce(s.thu7, 0)::float thu7, coalesce(s.chi3, 0)::float chi3, coalesce(s.thu3, 0)::float thu3,
        coalesce(s.chi_nay, 0)::float chi_nay, coalesce(s.thu_nay, 0)::float thu_nay,
        coalesce((select sum(g.chi) from etp.so_gio_camp g, nay where g.camp_id = c.camp_id and g.ngay = nay.d and g.gio < ${DON_GIO}), 0)::float chi13,
        (select min(nullif(regexp_replace(k.truoc, '[^0-9.]', '', 'g'), '')::numeric)::float from etp.nhat_ky k, nay where k.ok and k.viec = 'tang' and k.camp_id = c.camp_id and (k.luc at time zone 'utc')::date = nay.d) ns13,
        (select max(k.luc)::text from etp.nhat_ky k where k.ok and k.viec = 'tang' and k.camp_id = c.camp_id) tang_luc
      from c left join s using (camp_id) where coalesce(s.chi7, 0) >= 1 and coalesce(s.thu7, 0) > coalesce(s.chi7, 0) order by coalesce(s.thu7, 0) - coalesce(s.chi7, 0) desc`),
    run<{ san: number; chan: number; chi: number; roi: number; ngay: number; do_toi: string | null }>(sql`select
        (select count(*) from etp.creative r join etp.cham_cong g using (creative_id) where r.content_id = ${id} and g.duoc_len and r.cta_dat and r.tu_choi is null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id))::int san,
        (select count(*) from etp.creative r left join etp.cham_cong g using (creative_id) where r.content_id = ${id} and not coalesce(g.duoc_len, false) and r.tu_choi is null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id))::int chan,
        coalesce((gia_tri->>'chi')::float, 30) chi, coalesce((gia_tri->>'roi')::float, 30) roi, coalesce((gia_tri->>'ngay')::int, 3) ngay,
        -- mo_rong 'cho_do': camp mới nhất chưa qua trọn 1 ngày khép → đo lại từ 00:00 UTC ngày thứ 2 sau ngày tạo (07:00 VN)
        (select to_char(((max(tao) at time zone 'utc')::date + 2)::timestamp at time zone 'utc' at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') from etp.camp where content_id = ${id} and trang_thai = 'ACTIVE' and not la_roas) do_toi
      from (select (select gia_tri from etp.cau_hinh where khoa = 'len_doi_lai') gia_tri) x`),
    run<Record<string, unknown>>(campToaSql(sql`c.content_id = ${id}`)),
    dangGac(),
  ]);
  const ids = new Set((await run<{ camp_id: number }>(sql`select camp_id from etp.camp where content_id = ${id} and trang_thai = 'ACTIVE'`)).map((x) => Number(x.camp_id)));
  const hoan = (['tang', 'giam', 'tat'] as const).flatMap((h) => ((kh?.g?.[h] as number[] | undefined) ?? []).filter((c) => ids.has(Number(c))).map((c) => ({ camp_id: Number(c), huong: h })));
  return { ...p!, dang, thay: thay ?? null, sx, hoan, moc_chi: mc?.chi ?? 25, moc_thu: mc?.so ?? 4, ke: ke ?? null, hen, tu_len: cho?.tu_len ?? 0, thieu: cho?.thieu ?? null, may_mo: !!cho?.may_mo, lt: lt?.g ?? null,
    thang, cr: { san: kho?.san ?? 0, chan: kho?.chan ?? 0 }, doi_lai: { chi: kho?.chi ?? 30, roi: kho?.roi ?? 30, ngay: kho?.ngay ?? 3 }, do_toi: kho?.do_toi ?? null, camp: camp.map(docCampToa).filter((x) => !x.tat), camp_tat: camp.map(docCampToa).filter((x) => x.tat), gac };
}

/** LOG TỪNG PHIM (anh 07/11/2026 "các log của từng film nên để sang 1 tab riêng"): nhật ký máy + dòng phim, mới nhất trên. Lần cổng chặn (ok rỗng) gom theo câu lỗi. */
export type LogPhim = { luc: string; viec: string; camp_id: number | null; truoc: string | null; sau: string | null; ok: boolean | null; chu: string | null };
export async function docLogPhim(contentId: number): Promise<LogPhim[] | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ chủ xem log phim' };
  const id = Math.trunc(Number(contentId)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  return run<LogPhim>(sql`select to_char(t at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') luc, viec, camp_id, truoc, sau, ok, chu from (
      select k.luc t, k.viec, k.camp_id, k.truoc::text truoc, k.sau::text sau, k.ok, coalesce(nullif(k.loi, ''), k.luat) chu from etp.nhat_ky k
        where (k.ok is not null or k.viec <> 'tao_camp') and (k.camp_id in (select camp_id from etp.camp where content_id = ${id}) or k.goc in (select camp_id from etp.camp where content_id = ${id}))
      union all select max(k.luc), k.viec, null, null, null, null, min(k.loi) from etp.nhat_ky k
        where k.viec = 'tao_camp' and k.ok is null and k.luc > now() - interval '7 days' and (k.loi like ${`%phim ${id} %`} or k.loi like ${`%phim #${id} %`} or k.loi like ${`%phim ${id}'%`} or k.goc in (select camp_id from etp.camp where content_id = ${id})) group by k.viec, left(k.loi, 60)
      union all select k.luc, k.viec, null, null, null, k.ok, regexp_replace(k.luat, '^phim \d+ · ', '') from etp.nhat_ky k where k.viec = 'lo_trinh' and k.luat like ${`phim ${id} ·%`}
      union all select d.tao_luc, 'dong', d.camp_id, d.loai, d.so_camp::text, case d.trang_thai when 'xong' then true when 'chay' then true when 'huy' then null else false end, coalesce(d.ly_do, d.ai) from etp.dong_phim d where d.content_id = ${id}
    ) x order by t desc limit 60`);
}

/** ＋ camp loại A / B: một dòng phim (CC cảnh cuối · KT kể chuyện) lên `so` camp — đường dòng phim (dùng lại creative sạch, thiếu thì cắt / sinh). Bấm = anh duyệt tiền camp $1 × so. */
// MỌI DẠNG MÁY LÀM ĐƯỢC + SỐ CAMP + BỘ (anh 15/11/2026): loại / dạng gác / số 1–30 / bộ 1–5 do chayDong kiểm (cùng cổng form dòng phim); bo null = máy chọn bộ
export async function themCampPhim(contentId: number, loai: string, so: number, bo?: string | null): Promise<{ ok: true; id: number } | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ chủ điều khiển phim' };
  const n = Math.trunc(Number(so)); if (!(n >= 1 && n <= 30)) return { loi: 'số camp 1–30' };
  return chayDong(contentId, String(loai), '', n, bo ?? null);
}

/** − BỚT CAMP LỖ NHẤT của phim (camp Nhà đang chạy, không ★ ROAS, ROI cả đời thấp nhất) — giữ camp cuối nếu nó lãi. Tắt qua lam-ethopex.py (đường nút Telegram). */
async function campBot(id: number): Promise<{ camp_id: number; chi: number; thu: number } | { loi: string }> {
  const ds = await run<{ camp_id: number; chi: number; thu: number }>(sql`select c.camp_id, coalesce(sum(n.chi), 0)::float chi, coalesce(sum(n.thu), 0)::float thu
    from etp.camp c left join etp.so_ngay n using (camp_id) where c.content_id = ${id} and c.trang_thai = 'ACTIVE' and not c.la_roas group by 1
    order by case when sum(n.chi) >= 1 then (sum(n.thu) - sum(n.chi)) / sum(n.chi) else 0 end, c.camp_id`);
  const x = ds[0]; if (!x) return { loi: 'phim không có camp Nhà đang chạy' };
  if (ds.length === 1 && x.thu > x.chi) return { loi: `#${x.camp_id} là camp cuối và đang lãi — giữ` };
  return x;
}
/** camp sẽ bị tắt — hàng xác nhận hiện đúng camp này trước khi anh bấm */
export async function xemBotCamp(contentId: number) { if (!(await laChu())) return { loi: 'chỉ chủ điều khiển phim' }; return campBot(Math.trunc(Number(contentId))); }
export async function botCampPhim(contentId: number, campDaXem: number): Promise<{ ok: true; camp_id: number } | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ chủ điều khiển phim' };
  const id = Math.trunc(Number(contentId));
  const x = await campBot(id); if ('loi' in x) return x;
  if (x.camp_id !== Number(campDaXem)) return { loi: `camp lỗ nhất vừa đổi sang #${x.camp_id}, bấm lại để xem` };   // anh xác nhận camp nào thì chỉ tắt camp đó
  const tep = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex/lam-ethopex.py`;
  const me = await getCurrentUser();
  const ra = await new Promise<string>((ok) => execFile('python3', [tep, 'tat', String(x.camp_id), '--luat', `anh bấm Bớt camp lỗ nhất ở etp.on.tc (phim ${id})`, '--ai', `anh (etp.on.tc ${me?.email ?? ''})`],
    { timeout: 120_000, env: process.env }, (_e, out) => ok(String(out ?? ''))));
  const dong = ra.trim().split('\n').reverse().find((l) => l.startsWith('{'));
  const k = dong ? (JSON.parse(dong) as { ok?: boolean; loi?: string }) : null;
  return k?.ok ? { ok: true, camp_id: x.camp_id } : { loi: k?.loi || 'máy tắt không trả kết quả' };
}
