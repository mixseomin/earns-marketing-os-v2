// CÂU SQL CAMP CỦA TOÀ NHÀ — MỘT chỗ cho bảng phim (docLichPhim) và thành phố Tổng quan (docThanhPho): mỗi camp một cửa sổ / một cây.
// chi7 / thu7 = 7 ngày gần (gồm hôm nay, cùng cửa sổ thanh dạng của bảng phim) · ngay_chay / ngay_lai = trong 7 ngày Ethopex ĐÃ KHÉP (ngày UTC < hôm nay):
// số ngày có chi ≥ $1 / số ngày đó lãi — đo độ ỔN ĐỊNH của camp (anh 15/11/2026 "mỗi toà nhà sẽ có hình dáng, level khác nhau nếu có nhiều camp ổn định hơn").
// tat = camp đã tắt mà còn chi trong 30 ngày (cây héo ở góc thửa — anh 15/11/2026 "đã tắt thì héo và để ở 1 góc"); camp đang chạy luôn có, kể cả chưa chi.
// NGUỒN THEO NGƯỜI ĐANG XEM (anh 15/11/2026 "thành phố phải hiện theo số liệu của người được chọn"): nhà = etp.camp + so_ngay · người khác = etp.camp_ngoai + so_ngay_ngoai
// của tài khoản người đó (etp.tai_khoan.nguoi_id) · team = cả hai — cùng luật chọn người với lib/etp-doc.ts.
// etp.so_ngay một dòng mỗi camp × ngày (đã kiểm 15/11/2026: 13.365 dòng = 13.365 cặp) nên count(*) là số ngày.
import { sql, type SQL } from 'drizzle-orm';

// bo / bo_ten = BỘ TÀI KHOẢN của camp (anh 15/11/2026 "cùng 1 phim có thể nằm ở các bộ tk khác nhau" → khu phức hợp, mỗi bộ một tháp): nhà = etp.camp.bo (Bộ 1–5),
// người khác = tài khoản QC của camp (etp.tai_khoan.ten) — người trong team không chia bộ
export type CampToa = { id: number; dang: string; roas: boolean; ns: number; chi7: number; thu7: number; cho: boolean; ngay_chay: number; ngay_lai: number; tat: boolean; bo: string; bo_ten: string };
export type NguonToa = { kieu: 'nha' } | { kieu: 'nguoi'; id: number } | { kieu: 'team' };

const campNha = sql`select c.content_id, c.camp_id, c.la_roas, c.ngan_sach, c.lich, c.trang_thai, c.creative_id, 1 ng, coalesce(c.bo::text, '?') bo, 'Bộ ' || coalesce(c.bo::text, '?') bo_ten from etp.camp c`;
const campNgoai = (id: number | null) => sql`select c.content_id, c.camp_id, c.la_roas, c.ngan_sach, null::timestamptz lich, c.trang_thai, c.creative_id, 2 ng,
    'tk' || c.ad_account_id::text bo, coalesce(t.ten, c.ad_account_id::text) bo_ten
  from etp.camp_ngoai c join etp.tai_khoan t on t.ad_account_id = c.ad_account_id where ${id == null ? sql`t.nguoi_id is not null` : sql`t.nguoi_id = ${id}`}`;
const soNha = sql`select camp_id, ngay, chi, thu, 1 ng from etp.so_ngay where ngay >= current_date - 30`;
const soNgoai = sql`select camp_id, ngay, chi, thu, 2 ng from etp.so_ngay_ngoai where ngay >= current_date - 30`;

export const campToaSql = (dk: SQL, nguon: NguonToa = { kieu: 'nha' }) => {
  const c = nguon.kieu === 'nha' ? campNha : nguon.kieu === 'nguoi' ? campNgoai(nguon.id) : sql`${campNha} union all ${campNgoai(null)}`;
  const n = nguon.kieu === 'nha' ? soNha : nguon.kieu === 'nguoi' ? soNgoai : sql`${soNha} union all ${soNgoai}`;
  return sql`with c as (${c}), n as (${n})
  select c.content_id::int p, max(p.ten) ten, c.camp_id::int id, case when c.la_roas then 'ROAS' else coalesce(r.dang, '?') end dang, coalesce(c.la_roas, false) roas,
    coalesce(c.ngan_sach, 0)::float ns,
    coalesce(sum(n.chi) filter (where n.ngay >= current_date - 6), 0)::float chi7, coalesce(sum(n.thu) filter (where n.ngay >= current_date - 6), 0)::float thu7,
    count(*) filter (where n.ngay >= current_date - 7 and n.ngay < current_date and n.chi >= 1)::int ngay_chay,
    count(*) filter (where n.ngay >= current_date - 7 and n.ngay < current_date and n.chi >= 1 and n.thu > n.chi)::int ngay_lai,
    coalesce(c.lich > now(), false) cho, c.trang_thai <> 'ACTIVE' tat, c.bo, c.bo_ten
  from c left join etp.creative r using (creative_id) left join n on n.camp_id = c.camp_id and n.ng = c.ng left join etp.phim p on p.content_id = c.content_id
  where c.content_id is not null and ${dk}
  group by c.content_id, c.camp_id, c.ng, r.dang, c.la_roas, c.ngan_sach, c.lich, c.trang_thai, c.bo, c.bo_ten
  having c.trang_thai = 'ACTIVE' or coalesce(sum(n.chi), 0) > 0
  order by c.camp_id`;
};

/** dòng SQL → CampToa (số về number, bỏ p / ten) */
export const docCampToa = (r: Record<string, unknown>): CampToa => ({ id: Number(r.id), dang: String(r.dang), roas: !!r.roas, ns: Number(r.ns) || 0, chi7: Number(r.chi7) || 0, thu7: Number(r.thu7) || 0,
  cho: !!r.cho, ngay_chay: Number(r.ngay_chay) || 0, ngay_lai: Number(r.ngay_lai) || 0, tat: !!r.tat, bo: String(r.bo ?? '?'), bo_ten: String(r.bo_ten ?? r.bo ?? '?') });
