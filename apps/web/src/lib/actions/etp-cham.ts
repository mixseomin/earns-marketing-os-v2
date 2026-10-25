'use server';
// NÚT "CHẤM" trên etp.on.tc › Creative › Quét nội dung (anh 25/10/2026: "thêm nút để tao có thể chủ động chạy chấm 1 creative cụ thể").
// Chỉ xếp hàng etp.cham_hang — Worker Cloudflare etp-cham nhận trong ~1 phút.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

export async function xepHangCham(ids: number[]): Promise<{ ok: true; so: number } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  const ds = [...new Set(ids.map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
  if (!ds.length) return { loi: 'không có creative' };
  await getDb()!.execute(sql`insert into etp.cham_hang (creative_id, nguon, ai)
    select unnest(${`{${ds.join(',')}}`}::int[]), 'nut', ${me.email}
    on conflict (creative_id) do update set luc = now(), nguon = 'nut', ai = excluded.ai, trang_thai = 'cho', bat_dau = null, xong = null, loi = null,
      buoc = 'chờ Cloudflare nhận', nhat_ky = jsonb_build_array(jsonb_build_object('b', 'anh bấm Chấm', 'luc', now()))
    where etp.cham_hang.trang_thai <> 'dang'`);
  return { ok: true, so: ds.length };
}
