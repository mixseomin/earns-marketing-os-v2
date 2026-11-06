'use server';
// TAB INSIGHT (anh 06/11/2026 "tạo 1 tab mới là Insight (chỉ david xem) và tổng hợp các insight gần đây sau khi phân tích chi tiết theo từng ngày và từng giờ của nhà và đội"):
// sổ nhận định etp.insight (migration 0436) + số sống: từng ngày × người (view etp.so_nguoi), khung giờ × ngày (nhà etp.so_gio · đội etp.so_gio_ngoai), 24 giờ VN 7 ngày.
// CHỈ VAI CHỦ — kiểm trên máy chủ, người khác gọi hàm cũng không nhận được số. Ngày = ngày Ethopex (UTC, bắt đầu 07:00 VN); chỉ ngày đã khép.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

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
