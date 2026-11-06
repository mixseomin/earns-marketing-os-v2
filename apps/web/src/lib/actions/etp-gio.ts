'use server';
// DIỄN BIẾN TRONG NGÀY (anh 05/11/2026: "khi bấm hoặc hover vào 1 ngày có thể nhìn thấy diễn biến tăng giảm trong ngày đó ko" — "1 cái chart"):
// chi / thu từng giờ của một nhóm camp trong một ngày Ethopex, từ etp.so_gio_camp (dong-bo ghi). gio 0 = 07:00 VN.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp, xemNha } from '@/lib/etp-quyen';
import { KD } from '@/lib/etp-khung';

export type SoGio = { gio: number; chi: number; thu: number };

// hoc[g] = số camp trong nhóm đang ở GIAI ĐOẠN HỌC lúc giờ g (KD.hoc_gio giờ chạy đầu, tính từ giờ đầu tiên có chi — anh 05/11/2026 "highlight khoảng thời gian FB dành cho việc học")
export async function docGioNgay(camps: number[], ngay: string): Promise<{ ds: SoGio[]; luc: string | null; hoc: number[]; so: number; ns: number } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || !xemNha(q)) return { loi: 'không có quyền xem số theo giờ' };
  const ids = [...new Set(camps.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 2000);
  if (!ids.length || !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ds: [], luc: null, hoc: [], so: 0, ns: 0 };
  const r = (await getDb()!.execute(sql`select gio, sum(chi)::float chi, sum(thu)::float thu, max(cap_nhat)::text luc from etp.so_gio_camp
    where ngay = ${ngay}::date and camp_id = any(${`{${ids.join(',')}}`}::bigint[]) group by gio order by gio`)) as unknown as { gio: number; chi: number; thu: number; luc: string }[];
  const mang = `{${ids.join(',')}}`;
  const h = (await getDb()!.execute(sql`with t0 as (select camp_id, min(ngay + gio * interval '1 hour') t from etp.so_gio_camp where camp_id = any(${mang}::bigint[]) and chi > 0 group by 1)
    select g, count(t0.camp_id) filter (where ${ngay}::date + g * interval '1 hour' >= t0.t and ${ngay}::date + g * interval '1 hour' < t0.t + ${KD.hoc_gio} * interval '1 hour')::int n
    from generate_series(0, 23) g left join t0 on true group by g order by g`)) as unknown as { g: number; n: number }[];
  // ngân sách ngày của nhóm — biểu đồ vẽ mức NS (trần) + % NS tới 13h (anh 05/11/2026 "show thêm mức chi của fb vào chart theo giờ")
  // camp Nhà: etp.so_ngay hôm đó (chưa có dòng → ngân sách hiện tại etp.camp). CAMP ĐỘI không có trong so_ngay lẫn etp.camp → trước ra 0, biểu đồ mất vạch trần
  // (anh 06/11/2026 #1543 "Fix thiếu Trần", trang ng=116): lấy bậc cuối của sổ etp.bac_ngoai tính tới hết ngày đó (không có → ngân sách hiện tại camp_ngoai), chỉ camp có chi ngày đó
  const nsR = (await getDb()!.execute(sql`with x as (select unnest(${mang}::bigint[])::int id),
    nha as (select coalesce((select sum(ngan_sach)::float from etp.so_ngay where ngay = ${ngay}::date and camp_id in (select id from x)), (select sum(ngan_sach)::float from etp.camp where camp_id in (select id from x)), 0) v),
    doi as (select coalesce(sum(coalesce((select b.moi from etp.bac_ngoai b where b.camp_id = n.camp_id and b.moi is not null and b.luc < ${ngay}::date + 1 order by b.luc desc limit 1), n.ngan_sach))::float, 0) v
      from etp.camp_ngoai n where n.camp_id in (select id from x) and not exists (select 1 from etp.camp c where c.camp_id = n.camp_id)
        and exists (select 1 from etp.so_gio_camp g where g.camp_id = n.camp_id and g.ngay = ${ngay}::date and g.chi > 0))
    select (select v from nha) + (select v from doi) ns`)) as unknown as { ns: number }[];
  return { ns: Number(nsR[0]?.ns ?? 0), hoc: h.map((x) => Number(x.n)), so: ids.length, ds: r.map((x) => ({ gio: Number(x.gio), chi: Number(x.chi), thu: Number(x.thu) })), luc: r.reduce<string | null>((a, x) => (!a || x.luc > a ? x.luc : a), null) };
}
