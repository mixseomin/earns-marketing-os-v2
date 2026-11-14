// CÂU SQL CAMP CỦA TOÀ NHÀ — MỘT chỗ cho bảng phim (docLichPhim) và thành phố Tổng quan (taiTong2): mọi camp đang chạy, mỗi camp một cửa sổ.
// chi7 / thu7 = 7 ngày gần (gồm hôm nay, cùng cửa sổ thanh dạng của bảng phim) · ngay_chay / ngay_lai = trong 7 ngày Ethopex ĐÃ KHÉP (ngày UTC < hôm nay):
// số ngày có chi ≥ $1 / số ngày đó lãi — đo độ ỔN ĐỊNH của camp (anh 15/11/2026 "mỗi toà nhà sẽ có hình dáng, level khác nhau nếu có nhiều camp ổn định hơn").
// etp.so_ngay một dòng mỗi camp × ngày (đã kiểm 15/11/2026: 13.365 dòng = 13.365 cặp) nên count(*) là số ngày.
import { sql, type SQL } from 'drizzle-orm';

export type CampToa = { id: number; dang: string; roas: boolean; ns: number; chi7: number; thu7: number; cho: boolean; ngay_chay: number; ngay_lai: number };

export const campToaSql = (dk: SQL) => sql`select c.content_id::int p, max(p.ten) ten, c.camp_id::int id, case when c.la_roas then 'ROAS' else coalesce(r.dang, '?') end dang, c.la_roas roas,
    coalesce(c.ngan_sach, 0)::float ns,
    coalesce(sum(n.chi) filter (where n.ngay >= current_date - 6), 0)::float chi7, coalesce(sum(n.thu) filter (where n.ngay >= current_date - 6), 0)::float thu7,
    count(*) filter (where n.ngay < current_date and n.chi >= 1)::int ngay_chay, count(*) filter (where n.ngay < current_date and n.chi >= 1 and n.thu > n.chi)::int ngay_lai,
    coalesce(c.lich > now(), false) cho
  from etp.camp c left join etp.creative r using (creative_id) left join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay >= current_date - 7 left join etp.phim p on p.content_id = c.content_id
  where c.trang_thai = 'ACTIVE' and c.content_id is not null and ${dk}
  group by c.content_id, c.camp_id, r.dang, c.la_roas, c.ngan_sach, c.lich order by c.camp_id`;

/** dòng SQL → CampToa (số về number, bỏ p / ten) */
export const docCampToa = (r: Record<string, unknown>): CampToa => ({ id: Number(r.id), dang: String(r.dang), roas: !!r.roas, ns: Number(r.ns) || 0, chi7: Number(r.chi7) || 0, thu7: Number(r.thu7) || 0,
  cho: !!r.cho, ngay_chay: Number(r.ngay_chay) || 0, ngay_lai: Number(r.ngay_lai) || 0 });
