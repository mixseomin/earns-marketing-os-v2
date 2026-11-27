// PHIM ĐỘI CÓ CAMP, NHÀ CHƯA CÓ (anh 27/11/2026: "thêm vào …v=cay… cả danh sách các phim chưa có camp của Nhà nhưng đội đang có camp để lên camp").
// Nguồn: etp.camp_ngoai + etp.so_ngay_ngoai (camp của đội, dong-bo.py đọc) — phim có chi 7 ngày > 0 mà etp.camp (camp nhà) không có camp nào.
// Đọc qua GET /etp/phim-doi (không qua server action: Next xếp action của một trang thành hàng, khối phải chờ các action nặng ~30s; câu SQL chỉ ~20ms).
// Chỉ đọc; lên camp vẫn qua Phiếu lên camp (ngăn etp-phieu-len, anh bấm ✓ Duyệt mới tạo camp).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { anhUrl } from '@/lib/etp-anh-url';

export type PhimDoi = {
  cid: number; ten: string; lang: string | null; the_loai: string | null; anh: string | null;
  so_camp: number; nguoi: string[]; chi7: number; thu7: number; chay_cuoi: string | null; phieu: string | null;
};

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

export async function dsPhimDoi(): Promise<PhimDoi[]> {
  const ds = await run<PhimDoi>(sql`
    with d as (
      select c.content_id cid, count(distinct c.camp_id)::int so_camp,
        coalesce(array_agg(distinct t.nguoi) filter (where t.nguoi is not null), '{}') nguoi,
        sum(n.chi)::float chi7, coalesce(sum(n.thu), 0)::float thu7, max(n.ngay)::text chay_cuoi
      from etp.camp_ngoai c join etp.so_ngay_ngoai n using (camp_id) left join etp.tai_khoan t on t.ad_account_id = c.ad_account_id
      where n.ngay > current_date - 7 and c.content_id is not null and not coalesce(t.nha, false)
      group by 1 having sum(n.chi) > 0)
    select d.*, coalesce(p.ten, v.ten, '#' || d.cid) ten, coalesce(p.locale, v.locale) lang, p.the_loai, v.anh,
      (select trang_thai from etp.phieu_len l where l.content_id = d.cid and l.tao > now() - interval '3 days' order by l.tao desc limit 1) phieu
    from d left join etp.phim p on p.content_id = d.cid left join etp.thu_vien_phim v on v.content_id = d.cid
    where not exists (select 1 from etp.camp k where k.content_id = d.cid)
    order by d.thu7 - d.chi7 desc`);
  return ds.map((r) => ({ ...r, anh: anhUrl(r.anh) }));
}
