'use server';
// BẢNG LỊCH GIỜ trên etp.on.tc › Camp › Lịch giờ (anh 25/10/2026: "cần có bảng giờ on-off theo khung như trên ở etp để còn kiểm soát").
// Chỉ ghi etp.lich_gio / etp.cau_hinh['lich_gio'] — máy apps/etp/lich-gio.py áp ở lượt đồng bộ kế (≤ 10 phút).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

const KHUNG = ['k07', 'k08', 'k13', 'k20'];

/** email admin đang bấm, hoặc null khi không phải admin */
async function admin(): Promise<string | null> {
  const me = await getCurrentUser();
  return me && me.role === 'admin' ? me.email : null;
}

/** Đổi một ô thể loại × khung: bat = true (camp chạy) / false (camp tạm dừng trong khung đó) */
export async function datLichGio(theLoai: string, khung: string, bat: boolean): Promise<{ ok: true } | { loi: string }> {
  const ai = await admin(); if (!ai) return { loi: 'chỉ admin' };
  if (!KHUNG.includes(khung) || !/^[a-z_]{2,30}$/.test(theLoai)) return { loi: 'thể loại / khung sai' };
  await getDb()!.execute(sql`insert into etp.lich_gio (the_loai, khung, bat, ai) values (${theLoai}, ${khung}, ${bat}, ${ai})
    on conflict (the_loai, khung) do update set bat = excluded.bat, ai = excluded.ai, luc = now()`);
  return { ok: true };
}

/** Công tắc tổng: false = máy bật lại mọi camp đang tạm dừng vì lịch và không tắt thêm */
export async function datLichTong(bat: boolean): Promise<{ ok: true } | { loi: string }> {
  const ai = await admin(); if (!ai) return { loi: 'chỉ admin' };
  await getDb()!.execute(sql`insert into etp.cau_hinh (khoa, gia_tri, ai) values ('lich_gio', ${JSON.stringify(bat)}::jsonb, ${ai})
    on conflict (khoa) do update set gia_tri = excluded.gia_tri, ai = excluded.ai, luc = now()`);
  return { ok: true };
}
