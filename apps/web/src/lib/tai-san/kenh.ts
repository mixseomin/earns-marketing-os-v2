// Kênh kéo khách theo sản phẩm (bảng kenh_sp, migration 0219) — máy của repo sản phẩm ghi, tab Tài sản đọc.
// Card board gắn kèm đọc trạng thái SỐNG từ human_tasks, nên đóng card là ô kênh tự đổi, không phải ghi lại.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

import type { KenhSp } from './kieu';
export { KHAU, type KenhO, type KenhSp } from './kieu';

export async function docKenh(): Promise<KenhSp[]> {
  const d = getDb(); if (!d) return [];
  const rows = (await d.execute(sql`SELECT k.*, t.title AS the_ten, t.status AS the_tt FROM kenh_sp k
    LEFT JOIN human_tasks t ON t.id = k.the_id ORDER BY k.ten, k.kenh`)) as unknown as {
      san_pham: string; kenh: string; ten: string; khop: string | null; muc: number; xong: number | null; tong: number | null; dich: string | null;
      canh_bao: string | null; the_id: number | null; project: string | null; cap_nhat: string; the_ten: string | null; the_tt: string | null }[];
  const m = new Map<string, KenhSp>();
  for (const r of rows) {
    const sp = m.get(r.san_pham) ?? { sanPham: r.san_pham, ten: r.ten, khop: r.khop, o: {} };
    sp.o[r.kenh] = { kenh: r.kenh, muc: r.muc, xong: r.xong, tong: r.tong, dich: r.dich, canhBao: r.canh_bao, capNhat: String(r.cap_nhat),
      the: r.the_id ? { id: r.the_id, project: r.project, ten: r.the_ten ?? `#${r.the_id}`, trangThai: r.the_tt ?? '?' } : null };
    m.set(r.san_pham, sp);
  }
  return [...m.values()];
}
