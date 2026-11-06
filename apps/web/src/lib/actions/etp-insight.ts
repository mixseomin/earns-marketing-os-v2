'use server';
// TAB INSIGHT (anh 06/11/2026 "tạo 1 tab mới là Insight (chỉ david xem) và tổng hợp các insight gần đây sau khi phân tích chi tiết theo từng ngày và từng giờ của nhà và đội"):
// sổ nhận định etp.insight (migration 0436) + số sống: từng ngày × người (view etp.so_nguoi), khung giờ × ngày (nhà etp.so_gio · đội etp.so_gio_ngoai), 24 giờ VN 7 ngày.
// CHỈ VAI CHỦ — kiểm trên máy chủ, người khác gọi hàm cũng không nhận được số. Ngày = ngày Ethopex (UTC, bắt đầu 07:00 VN); chỉ ngày đã khép.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import type { MocHang } from '@/lib/etp-moc';

export type InsightMuc = { id: number; ngay: string; khoang: string; nhom: string; tieu_de: string; noi_dung: string; goi_y: string | null; ai: string };
export type SoNguoiNgay = { ngay: string; nguoi: string; nha: boolean; chi: number; thu: number; camp: number };
export type SoKhung = { ngay: string; khung: string; ai: 'nha' | 'doi'; chi: number; thu: number };
export type SoGioVn = { h: number; ai: 'nha' | 'doi'; chi: number; thu: number };
export type DuInsight = { insight: InsightMuc[]; ngay: SoNguoiNgay[]; khung: SoKhung[]; gio: SoGioVn[] };

const NGAY = 14, GIO_NGAY = 7;
export async function docInsight(): Promise<DuInsight | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (q?.vai !== 'chu') return { loi: 'tab Insight chỉ chủ xem' };
  const db = getDb()!;
  const run = async <T,>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
  const [insight, ngay, khung, gio] = await Promise.all([
    run<InsightMuc>(sql`select id, ngay::text, khoang, nhom, tieu_de, noi_dung, goi_y, ai from etp.insight order by ngay desc, id`),
    run<SoNguoiNgay>(sql`select ngay::text, nguoi, nha, chi::float, thu::float, camp::int from etp.so_nguoi
      where ngay >= current_date - ${NGAY}::int and ngay < current_date order by ngay, nha desc, nguoi`),
    run<SoKhung>(sql`with g as (select ngay, (gio + 7) % 24 h, chi, thu, 'nha' ai from etp.so_gio where ngay >= current_date - ${NGAY}::int and ngay < current_date
        union all select ngay, (gio + 7) % 24, chi, thu, 'doi' from etp.so_gio_ngoai where ngay >= current_date - ${NGAY}::int and ngay < current_date)
      select ngay::text, case when h between 7 and 14 then '07–15' when h between 15 and 20 then '15–21' else '21–07' end khung, ai, sum(chi)::float chi, sum(thu)::float thu
      from g group by 1, 2, 3 order by 1, 2`),
    run<SoGioVn>(sql`with g as (select (gio + 7) % 24 h, chi, thu, 'nha' ai from etp.so_gio where ngay >= current_date - ${GIO_NGAY}::int and ngay < current_date
        union all select (gio + 7) % 24, chi, thu, 'doi' from etp.so_gio_ngoai where ngay >= current_date - ${GIO_NGAY}::int and ngay < current_date)
      select h::int, ai, sum(chi)::float chi, sum(thu)::float thu from g group by 1, 2 order by 1`),
  ]);
  return { insight, ngay, khung, gio };
}

// BẢNG MỐC (anh 06/11/2026): từng mốc lên camp / tăng / giảm của TẬP CAMP trang đang lọc (ids — cây camp gửi lên, cùng bộ lọc tab Camp) trong KỲ đang chọn
// (ngày Ethopex của giờ mốc, tu..den) + chi / thu 24 giờ trước và ba khối 24 giờ sau — gom dòng ở lib/etp-moc. Nhà: etp.nhat_ky · đội: etp.bac_ngoai (không trùng camp nhà).
// Gửi về dạng HÀNG MẢNG (cột theo MOC_COT, số làm tròn 2 chữ số) thay vì object — Team + All time ~5.500 mốc: nhẹ ~3 lần; lỗi truy vấn trả { loi } cho bảng hiện, không ném lên trang.
export async function docMoc(ids: number[], tu: string, den: string): Promise<MocHang[] | { loi: string }> {
  try { return await docMocTho(ids, tu, den); } catch (e) { console.error('docMoc:', e); return { loi: `không đọc được mốc: ${String((e as Error)?.message ?? e).slice(0, 160)}` }; }
}
async function docMocTho(ids: number[], tu: string, den: string): Promise<MocHang[] | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (q?.vai !== 'chu') return { loi: 'tab Insight chỉ chủ xem' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tu) || !/^\d{4}-\d{2}-\d{2}$/.test(den)) return { loi: 'kỳ không hợp lệ' };
  const ds = [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))];
  if (!ds.length) return [];
  const mang = `{${ds.join(',')}}`;
  return ((await getDb()!.execute(sql`with mx as (select max(ngay + make_interval(hours => gio)) m from etp.so_gio_camp),
    g as (select camp_id, ngay + make_interval(hours => gio) t, chi, thu from etp.so_gio_camp where camp_id = any(${mang}::int[])),
    ev as (
      select 'len' loai, camp_id, min(t) t, null::float ty from g where chi > 0 group by camp_id
      union all
      select case when sau::numeric > truoc::numeric then 'tang' else 'giam' end, camp_id, date_trunc('hour', luc at time zone 'utc') + interval '1 hour', (sau::numeric / truoc::numeric)::float
        from etp.nhat_ky where viec in ('tang', 'giam') and ok and camp_id = any(${mang}::int[]) and truoc ~ '^[0-9.]+$' and sau ~ '^[0-9.]+$' and truoc::numeric > 0 and sau::numeric <> truoc::numeric
      union all
      select case when moi > cu then 'tang' else 'giam' end, camp_id, date_trunc('hour', luc at time zone 'utc') + interval '1 hour', (moi / cu)::float
        from etp.bac_ngoai where kieu = 'sua' and cu > 0 and moi > 0 and cu <> moi and camp_id = any(${mang}::int[])),
    e as (select distinct on (loai, camp_id, t) * from ev where t::date between ${tu}::date and ${den}::date)
    select json_build_array(e.loai, e.camp_id, extract(hour from e.t + interval '7 hour')::int, round(e.ty::numeric, 3), least(3, floor(extract(epoch from (mx.m + interval '1 hour' - e.t)) / 86400))::int,
      round(coalesce(sum(g.chi) filter (where g.t < e.t), 0)::numeric, 2), round(coalesce(sum(g.thu) filter (where g.t < e.t), 0)::numeric, 2),
      round(coalesce(sum(g.chi) filter (where g.t >= e.t and g.t < e.t + interval '24 hour'), 0)::numeric, 2), round(coalesce(sum(g.thu) filter (where g.t >= e.t and g.t < e.t + interval '24 hour'), 0)::numeric, 2),
      round(coalesce(sum(g.chi) filter (where g.t >= e.t + interval '24 hour' and g.t < e.t + interval '48 hour'), 0)::numeric, 2), round(coalesce(sum(g.thu) filter (where g.t >= e.t + interval '24 hour' and g.t < e.t + interval '48 hour'), 0)::numeric, 2),
      round(coalesce(sum(g.chi) filter (where g.t >= e.t + interval '48 hour'), 0)::numeric, 2), round(coalesce(sum(g.thu) filter (where g.t >= e.t + interval '48 hour'), 0)::numeric, 2)) r
    from e cross join mx left join g on g.camp_id = e.camp_id and g.t >= e.t - interval '24 hour' and g.t < e.t + interval '72 hour'
    group by e.loai, e.camp_id, e.t, e.ty, mx.m`)) as unknown as { r: MocHang }[]).map((x) => x.r);
}
