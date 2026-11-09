'use server';
// TÌM CAMP Ở NGƯỜI KHÁC (anh 02/11/2026 "tại sao ko còn hiện camp nào? Filter nào gây ra phải highlight chứ?" — #66420 là camp của Sơn, anh đang xem Nhà):
// ô tìm cây camp ra 0 dòng mà không bộ lọc nào ẩn → hỏi kho xem chữ đó khớp camp của ai (mã camp hoặc tên / phim), để màn nói rõ "camp của X — mở".
// Vai người (chỉ xem phần mình) không được biết camp người khác → trả rỗng.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

export type CampNoiKhac = { nguoi_id: number; nguoi: string; nha: boolean; so: number; chay: number; vi_du: number };

export async function timCampNoiKhac(q: string): Promise<CampNoiKhac[]> {
  const qu = await quyenEtp(await getCurrentUser());
  const k = q.trim();
  if (!qu || qu.vai === 'nguoi' || k.length < 3) return [];
  const id = /^\d+$/.test(k) ? Number(k) : null, mau = `%${k.replace(/[%_\\]/g, (x) => `\\${x}`)}%`;
  const r = (await getDb()!.execute(sql`with c as (
      select c.camp_id, c.ten, c.trang_thai, c.ad_account_id, p.ten phim from etp.camp c left join etp.phim p using (content_id)
      union all select k.camp_id, k.ten, k.trang_thai, k.ad_account_id, coalesce(p.ten, k.phim_ten) from etp.camp_ngoai k left join etp.phim p using (content_id))
    select t.nguoi_id, max(t.nguoi) nguoi, bool_or(t.nha) nha, count(*) so, count(*) filter (where c.trang_thai = 'ACTIVE') chay, min(c.camp_id) vi_du
    from c join etp.tai_khoan t using (ad_account_id)
    where c.trang_thai <> 'ARCHIVED' and t.nguoi_id is not null and ${id != null ? sql`c.camp_id = ${id}` : sql`(c.ten ilike ${mau} or c.phim ilike ${mau})`}
    group by 1 order by count(*) desc`)) as unknown as Record<string, unknown>[];
  return r.map((x) => ({ nguoi_id: Number(x.nguoi_id), nguoi: String(x.nguoi ?? ''), nha: !!x.nha, so: Number(x.so), chay: Number(x.chay), vi_du: Number(x.vi_du) }));
}
