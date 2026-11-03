'use server';
// DÒNG PHIM TỰ ĐỘNG (anh 03/11/2026): chọn phim → form hỏi loại nội dung QC (KT / CC / CT…, có mô tả + ví dụ) + thể loại → máy chạy dòng (apps/etp/dong_phim.py, iMac)
// làm hết 8 bước tới khi camp chạy; dính policy thì dòng tự dừng; nút FIX từng bước; thằng Mạnh (apps/etp/manh.py, box3) canh bước kẹt. Kho: etp.dong_phim / etp.dong_buoc (0413).
// Chỉ chủ / admin (tài khoản Nhà) — đội chưa có đường tự động (luật "ko làm gì tự động ngoài tk Nhà", 02/11/2026).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

export type LoaiNoiDung = { ma: string; ten: string; dang: string; mo_ta: string; cach: string; gia: string; thoi_gian: string; chay: boolean; khoa?: string;
  vi_du: { creative_id: number; video: string; phim: string | null; lai: number; chi: number }[] };
export type BuocDong = { buoc: string; thu_tu: number; trang_thai: string; bat_dau: string | null; ket_thuc: string | null; han_giay: number; lan: number; ghi: string | null; nhip: string | null; fix: boolean; ket_qua: { ds?: { creative_id: number; tu?: number; den?: number }[]; sach?: { creative_id: number }[]; doan?: { tu: number; den: number }[] } | null };
export type CampDong = { id: number; tt: string | null; cr: number | null; ns: number | null; chi: number; thu: number };
export type DongPhim = { id: number; content_id: number; ten: string | null; the_loai: string | null; loai: string; ai: string | null; trang_thai: string; ly_do: string | null;
  camp_id: number | null; creative_id: number | null; anh: string | null; duyet: boolean | null; so: { camp: number; chay: number; chi: number; thu: number } | null; tao_luc: string; xong_luc: string | null; buoc: BuocDong[] };

// MỘT SỔ LOẠI NỘI DUNG — dạng = nhãn etp.creative.dang (cùng sổ MAU_DANG của etp-view / DANG_CHUAN của diem_cham.py); chay = máy dòng phim làm được
const LOAI: Omit<LoaiNoiDung, 'vi_du'>[] = [
  { ma: 'CC', ten: 'CC — Cảnh cuối tập', dang: 'cảnh cuối', chay: true, gia: '$0 (không gọi AI dựng video)', thoi_gian: '~15–30 phút',
    mo_ta: 'Cắt 65–85 giây liền từ tập phim gốc, kết đúng ở cú treo cuối tập (cliffhanger). 5 giây cuối là ô tên phim + nút WATCH NOW kiểu Kiên.',
    cach: 'tải 8 tập miễn phí → cắt 2 góc cuối tập (cat-cuoi-lo) → bỏ giây có thoại / hình nhạy cảm → máy soát đoạn (Claude) → giữ đoạn sạch đầu tiên' },
  { ma: 'KT', ten: 'KT — Kể chuyện', dang: 'kể chuyện', chay: true, gia: '~25₫ kịch bản (ckey) + credit VideoExpress', thoi_gian: '~1–4 giờ (máy sinh làm tuần tự, có hàng đợi)',
    mo_ta: 'Video kể lại cốt phim bằng giọng đọc + ảnh / clip AI dựng từ tóm tắt thật của phim, rồi CTA. Không dùng cảnh phim gốc nên ít dính cảnh nhạy cảm.',
    cach: 'dòng đứng đầu hàng đợi máy sinh kể chuyện (bậc 5000) → kịch bản → giọng / ảnh / clip VideoExpress → CTA → thư viện → creative → chấm' },
  { ma: 'LT', ten: 'LT — Lộ trình test rộng (mỗi tập một creative)', dang: 'tập nguyên', chay: true, gia: '$0 dựng · camp ~$1 × số tập/ngày', thoi_gian: '~1–2 giờ tới bước lên camp',
    mo_ta: 'Cách Kiên: mỗi tập trọn một creative (tên phim + WATCH NOW cuối), lên cùng lúc mỗi creative một camp $1 (~$8–10/phim/ngày), T2 cắt camp lỗ sớm, creative thắng thì nhân lô.',
    cach: 'tải 8 tập → cắt mỗi tập một đoạn (ETP_KIEU=tap) → máy soát → tải + chấm hết → DỪNG chờ anh bắt đầu → lên mỗi creative một camp $1 (miễn luật một camp)' },
  { ma: 'CT', ten: 'CT — Cảnh thật (giữa tập)', dang: 'cảnh thật', chay: false, gia: '$0', thoi_gian: '—',
    mo_ta: 'Một cảnh kịch tính GIỮA tập (thường lấy theo QC chạy lâu của app gốc trên spy), giữ bố cục của họ + thẻ cuối poster sạch. Số 14 ngày tốt hơn cảnh cuối.',
    cach: 'cần máy chọn cảnh giữa tập tự động (khớp QC spy với tập sạch) — chưa có trong dòng phim',
    khoa: 'chưa có máy chọn cảnh giữa tập tự động — đang làm' },
  { ma: 'KM', ten: 'Kiểu mới — chọn phe / bình luận / ba khoảnh khắc / trước sau / tin nhắn', dang: 'chọn phe', chay: false, gia: '$0', thoi_gian: '—',
    mo_ta: 'Năm kiểu dựng từ tập gốc + lớp chữ (kieu-moi.py): dừng hình hỏi chọn phe, bong bóng bình luận, đếm 3-2-1, chia đôi trước / sau, mở bằng màn chat.',
    cach: 'mỗi phim cần một kế hoạch chữ viết theo đúng cốt phim (người dựng xem tờ khung) — chưa tự động',
    khoa: 'cần kế hoạch chữ viết tay cho từng phim — chưa tự động' },
];

async function quyen() {
  const me = await getCurrentUser(), q = await quyenEtp(me);
  return me && q && q.vai !== 'nguoi' ? me : null;
}
const db = () => getDb()!;
const run = async <T,>(s: ReturnType<typeof sql>) => (await db().execute(s)) as unknown as T[];

/** form chọn: loại nội dung (kèm 2 ví dụ creative lãi nhất 14 ngày của đúng dạng) + danh sách thể loại + thể loại máy đang gắn cho phim */
export async function formDong(contentId: number): Promise<{ loai: LoaiNoiDung[]; theLoai: Record<string, string>; tlPhim: string | null; ten: string | null; nhomGoc: string | null } | { loi: string }> {
  if (!(await quyen())) return { loi: 'chỉ chủ / admin chạy dòng phim tự động (tài khoản Nhà)' };
  const id = Math.trunc(Number(contentId));
  const vd = await run<{ dang: string; creative_id: number; video: string; phim: string | null; lai: number; chi: number }>(sql`
    with s as (select c.creative_id, sum(n.chi) chi, sum(n.thu) thu from etp.so_ngay n join etp.camp c using (camp_id) where n.ngay > current_date - 14 group by 1),
    x as (select r.dang, r.creative_id, r.video, p.ten phim, (s.thu - s.chi)::float lai, s.chi::float chi, row_number() over (partition by r.dang order by s.thu - s.chi desc) h
          from s join etp.creative r using (creative_id) left join etp.phim p using (content_id) where r.video like 'http%' and s.chi >= 5)
    select dang, creative_id, video, phim, round(lai::numeric, 2)::float lai, round(chi::numeric, 2)::float chi from x where h <= 2`);
  const [tl] = await run<{ gia_tri: { the_loai?: Record<string, string> } | null }>(sql`select gia_tri from xv_khoa_ngoai where ten = 'ethopex_the_loai_thu'`);
  const [gan] = await run<{ tl: string | null }>(sql`select gia_tri->${String(id)}->>'tl' tl from xv_khoa_ngoai where ten = 'ethopex_the_loai'`);
  const [ph] = await run<{ ten: string | null; nhom_goc: string | null }>(sql`select coalesce(p.ten, v.ten) ten, p.nhom_goc from (select ${id}::int content_id) k
    left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)`);
  return { loai: LOAI.map((l) => ({ ...l, vi_du: vd.filter((v) => v.dang === l.dang).map(({ dang: _d, ...v }) => v) })), theLoai: tl?.gia_tri?.the_loai ?? {},
    tlPhim: gan?.tl ?? null, ten: ph?.ten ?? null, nhomGoc: ph?.nhom_goc ?? null };
}

export async function chayDong(contentId: number, loai: string, theLoai: string): Promise<{ ok: true; id: number } | { loi: string }> {
  const me = await quyen(); if (!me) return { loi: 'chỉ chủ / admin chạy dòng phim tự động' };
  const id = Math.trunc(Number(contentId)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  const l = LOAI.find((x) => x.ma === loai); if (!l) return { loi: 'loại nội dung lạ' }; if (!l.chay) return { loi: `${l.ten}: ${l.khoa}` };
  const [ph] = await run<{ ten: string | null; nhom_goc: string | null }>(sql`select coalesce(p.ten, v.ten) ten, p.nhom_goc from (select ${id}::int content_id) k
    left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)`);
  if (ph?.nhom_goc !== 'au_my') return { loi: ph?.nhom_goc ? `phim nhóm gốc '${ph.nhom_goc}' — chỉ chạy phim Âu-Mỹ` : 'phim chưa xác định nhóm gốc — chỉ chạy phim đã xác định Âu-Mỹ (cột Nhóm gốc)' };
  const [dang] = await run<{ id: number }>(sql`select id from etp.dong_phim where content_id = ${id} and loai = ${loai} and trang_thai = 'chay'`);   // một phim nhiều loại cùng lúc (0415), mỗi loại một dòng
  if (dang) return { loi: `phim đang có dòng #${dang.id} loại ${loai} chạy` };
  if (theLoai) await db().execute(sql`update xv_khoa_ngoai set gia_tri = jsonb_set(coalesce(gia_tri, '{}'::jsonb), ${'{' + id + '}'}::text[],
      jsonb_build_object('tl', ${theLoai}::text, 'ten', ${ph?.ten ?? ''}::text, 'nguon', 'anh'), true) where ten = 'ethopex_the_loai'`);   // thể loại anh chọn đè máy đoán (the-loai.py đọc cùng sổ)
  const [r] = await run<{ id: number }>(sql`insert into etp.dong_phim (content_id, ten, the_loai, loai, ai) values (${id}, ${ph?.ten ?? null}, ${theLoai || null}, ${loai}, ${me.displayName ?? me.email ?? 'admin'}) returning id`);
  return r ? { ok: true, id: r.id } : { loi: 'không ghi được' };
}

// CHỊU TẢI LỚN (anh 03/11/2026 "khi có 100000 creative thì trông nó thế nào?"): danh sách dòng lọc + phân trang ở máy chủ (50 / trang), số tổng của từng phim
// máy chủ tính (creative / sạch / camp / chạy / chi / thu); chi tiết creative + camp chỉ tải khi mở thư mục phim (docChiTiet)
const TRANG = 50;
export type LocDong = 'mac_dinh' | 'dang' | 'loi' | 'tat_ca';
export async function docDong(loc: LocDong = 'mac_dinh', tim = '', trang = 0): Promise<{ dong: DongPhim[]; tong: number; dem: Record<LocDong, number>; may: { may: string; nhip: string }[]; luc: string } | { loi: string }> {
  if (!(await quyen())) return { loi: 'không có quyền' };
  const xongLuc = sql`coalesce(p.xong_luc, case when not exists (select 1 from etp.dong_buoc b where b.dong_id = p.id and b.trang_thai not in ('xong', 'bo_qua')) then (select max(b.ket_thuc) from etp.dong_buoc b where b.dong_id = p.id) end)`;
  const coLoi = sql`(p.trang_thai in ('dung', 'loi') or exists (select 1 from etp.dong_buoc b where b.dong_id = p.id and b.trang_thai in ('loi', 'dung')))`;
  const dangL = sql`(p.trang_thai = 'chay' and ${xongLuc} is null)`;
  const dk = loc === 'dang' ? dangL : loc === 'loi' ? coLoi : loc === 'tat_ca' ? sql`true` : sql`(${dangL} or ${coLoi} or ${xongLuc} > now() - interval '1 day')`;
  const t = `%${tim.trim()}%`;
  const loctim = tim.trim() ? sql`and (p.ten ilike ${t} or p.content_id::text = ${tim.trim()} or p.id::text = ${tim.trim()})` : sql``;
  const dong = await run<DongPhim>(sql`select p.id, p.content_id, p.ten, p.the_loai, p.loai, p.ai, p.trang_thai, p.ly_do, p.camp_id, p.creative_id, p.tao_luc::text tao_luc, p.xong_luc::text xong_luc,
      (select case when a like 'http%' then a else '/api/ethopex/anh?p=' || ltrim(a, '/') end from (select coalesce((select t.anh from etp.trang_phim t where t.content_id = p.content_id and t.anh is not null order by t.cap_nhat desc limit 1), (select v.anh from etp.thu_vien_phim v where v.content_id = p.content_id and v.anh is not null limit 1)) a) x) anh,   -- ảnh tương đối → qua cùng miền /api/ethopex/anh
      ((select gia_tri->p.content_id::text from etp.cau_hinh where khoa = 'lo_trinh')->>'bat_dau')::boolean duyet,   -- anh đã bấm Duyệt lên camp
      (select json_build_object('camp', count(*), 'chay', count(*) filter (where c.trang_thai = 'ACTIVE'), 'chi', coalesce(sum(s.chi), 0), 'thu', coalesce(sum(s.thu), 0))
        from etp.camp c left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s using (camp_id) where c.content_id = p.content_id and c.tao >= p.tao_luc) so,
      coalesce((select json_agg(json_build_object('buoc', b.buoc, 'thu_tu', b.thu_tu, 'trang_thai', b.trang_thai, 'bat_dau', b.bat_dau, 'ket_thuc', b.ket_thuc, 'han_giay', b.han_giay,
        'lan', b.lan, 'ghi', b.ghi, 'nhip', b.nhip, 'fix', b.fix, 'ket_qua', b.ket_qua) order by b.thu_tu) from etp.dong_buoc b where b.dong_id = p.id), '[]'::json) buoc
    from etp.dong_phim p where ${dk} ${loctim} order by (${coLoi}) desc, (${dangL}) desc, p.id desc limit ${TRANG} offset ${Math.max(0, Math.trunc(trang)) * TRANG}`);
  const [d] = await run<Record<LocDong | 'tong', number>>(sql`select count(*) filter (where ${dk} ${loctim}) tong, count(*) filter (where ${dangL} or ${coLoi} or ${xongLuc} > now() - interval '1 day') mac_dinh,
      count(*) filter (where ${dangL}) dang, count(*) filter (where ${coLoi}) loi, count(*) tat_ca from etp.dong_phim p`);
  const may = await run<{ may: string; nhip: string }>(sql`select may, nhip::text nhip from etp.dong_may`);
  const n = (k: LocDong | 'tong') => Number(d?.[k] ?? 0);
  return { dong, tong: n('tong'), dem: { mac_dinh: n('mac_dinh'), dang: n('dang'), loi: n('loi'), tat_ca: n('tat_ca') }, may, luc: new Date().toISOString() };
}

/** chi tiết thư mục phim: camp của dòng (creative → camp, chi / thu) + ảnh / video creative */
export async function docChiTiet(dongId: number): Promise<{ camps: CampDong[]; crs: Record<string, { anh: string | null; video: string | null }> } | { loi: string }> {
  if (!(await quyen())) return { loi: 'không có quyền' };
  const id = Math.trunc(Number(dongId));
  const camps = await run<CampDong>(sql`select c.camp_id::int id, c.trang_thai tt, c.creative_id::int cr, c.ngan_sach::float ns, coalesce(s.chi, 0)::float chi, coalesce(s.thu, 0)::float thu
      from etp.dong_phim p join etp.camp c on c.content_id = p.content_id and c.tao >= p.tao_luc left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s on s.camp_id = c.camp_id
      where p.id = ${id} order by c.camp_id`);
  const [r] = await run<{ crs: Record<string, { anh: string | null; video: string | null }> }>(sql`select coalesce(json_object_agg(r.creative_id, json_build_object('anh', r.anh, 'video', r.video)), '{}'::json) crs
      from etp.dong_phim p join etp.creative r on r.content_id = p.content_id where p.id = ${id} and (r.anh is not null or r.video is not null)`);
  return { camps, crs: r?.crs ?? {} };
}

/** ANH DUYỆT LÊN CAMP ngay trên ô "chờ anh" (anh 03/11/2026 "nút chờ anh phải cho tao bấm duyệt luôn trên đó"): đặt etp.cau_hinh lo_trinh[phim].bat_dau →
 *  máy chạy dòng lên mỗi creative sạch một camp $1 ở vòng kế (cổng luật nhan-ban vẫn chặn như thường). Chỉ admin. */
export async function batDauCamp(dongId: number): Promise<{ ok: true } | { loi: string }> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được duyệt lên camp' };
  const [d] = await run<{ content_id: number }>(sql`select content_id from etp.dong_phim where id = ${Math.trunc(Number(dongId))} and trang_thai = 'chay'`);
  if (!d) return { loi: 'dòng không còn chạy' };
  await db().execute(sql`insert into etp.cau_hinh (khoa, gia_tri) values ('lo_trinh', jsonb_build_object(${String(d.content_id)}::text, jsonb_build_object('bat_dau', true, 'ai', ${me.displayName ?? me.email ?? 'admin'}::text, 'luc', now()::text)))
    on conflict (khoa) do update set gia_tri = coalesce(etp.cau_hinh.gia_tri, '{}'::jsonb) || jsonb_build_object(${String(d.content_id)}::text,
      coalesce(etp.cau_hinh.gia_tri->${String(d.content_id)}, '{}'::jsonb) || jsonb_build_object('bat_dau', true, 'ai', ${me.displayName ?? me.email ?? 'admin'}::text, 'luc', now()::text))`);
  return { ok: true };
}

/** FIX: máy chạy dòng giết tiến trình bước (nếu còn), chạy lại bước đó + các bước sau, mở lại dòng */
export async function fixBuoc(dongId: number, buoc: string): Promise<{ ok: true } | { loi: string }> {
  if (!(await quyen())) return { loi: 'không có quyền' };
  const r = await run<{ id: number }>(sql`update etp.dong_buoc set fix = true, huy = (trang_thai = 'dang') where dong_id = ${Math.trunc(Number(dongId))} and buoc = ${buoc}
      and trang_thai in ('dang', 'loi', 'dung', 'xong') and exists (select 1 from etp.dong_phim where id = ${Math.trunc(Number(dongId))} and trang_thai <> 'huy') returning id`);
  return r.length ? { ok: true } : { loi: 'bước không FIX được (chưa chạy, hoặc dòng đã huỷ)' };
}

export async function dungDong(dongId: number): Promise<{ ok: true } | { loi: string }> {
  if (!(await quyen())) return { loi: 'không có quyền' };
  const id = Math.trunc(Number(dongId));
  await db().execute(sql`update etp.dong_buoc set huy = true where dong_id = ${id} and trang_thai = 'dang'`);
  await db().execute(sql`update etp.dong_phim set trang_thai = 'huy', ly_do = 'anh bấm Dừng', xong_luc = now() where id = ${id} and trang_thai in ('chay', 'dung', 'loi')`);
  return { ok: true };
}
