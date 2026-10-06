// Kênh kéo khách theo sản phẩm (bảng kenh_sp, migration 0219 + 0220) và THƯ VIỆN phương pháp (bảng phuong_phap) — tab Tài sản đọc.
// kenh_sp: máy của repo sản phẩm ghi (puzzle-books/scripts/kenh.mjs, project ≠ null) hoặc sửa tay ở drawer (project null).
// Card board gắn kèm đọc trạng thái SỐNG từ human_tasks, nên đóng card là ô kênh tự đổi, không phải ghi lại.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

import type { KenhSp, PhuongPhap } from './kieu';
export type { KenhO, KenhSp, PhuongPhap } from './kieu';

export async function docKenh(): Promise<KenhSp[]> {
  const d = getDb(); if (!d) return [];
  const rows = (await d.execute(sql`SELECT k.*, t.title AS the_ten, t.status AS the_tt FROM kenh_sp k
    LEFT JOIN human_tasks t ON t.id = k.the_id ORDER BY k.ten, k.kenh`)) as unknown as {
      san_pham: string; kenh: string; ten: string; khop: string | null; muc: number; xong: number | null; tong: number | null; dich: string | null;
      canh_bao: string | null; the_id: number | null; project: string | null; cap_nhat: string; ngay_dang: string | null; the_ten: string | null; the_tt: string | null }[];
  const m = new Map<string, KenhSp>();
  for (const r of rows) {
    const sp = m.get(r.san_pham) ?? { sanPham: r.san_pham, ten: r.ten, khop: r.khop, project: r.project, o: {} };
    // Dòng sửa tay (project null, khop null) có thể đứng trước dòng máy trong cùng tựa → lấy khop/project từ dòng nào có.
    sp.khop ??= r.khop; sp.project ??= r.project;
    sp.o[r.kenh] = { kenh: r.kenh, muc: r.muc, xong: r.xong, tong: r.tong, dich: r.dich, canhBao: r.canh_bao, capNhat: String(r.cap_nhat),
      ngayDang: r.ngay_dang ? String(r.ngay_dang).slice(0, 10) : null,
      the: r.the_id ? { id: r.the_id, project: r.project, ten: r.the_ten ?? `#${r.the_id}`, trangThai: r.the_tt ?? '?' } : null };
    m.set(r.san_pham, sp);
  }
  return [...m.values()];
}

type DongPp = { key: string; nhan: string; mo_ta: string; nham: string[]; buoc: string[]; noi: PhuongPhap['noi'] | null; may: string | null;
  nguong: Record<string, unknown> | null; thu_tu: number; bat: boolean };
const dichPp = (r: DongPp): PhuongPhap => ({ key: r.key, nhan: r.nhan, moTa: r.mo_ta, nham: r.nham ?? [], buoc: r.buoc?.length ? r.buoc : ['chưa làm'],
  noi: { tk: r.noi?.tk ?? [], url: r.noi?.url }, may: r.may, nguong: r.nguong, thuTu: r.thu_tu, bat: r.bat });

/** Cả thư viện, kể cả phương pháp đã tắt (panel thư viện cần thấy để bật lại); apDung tự bỏ cái tắt. */
export async function docPhuongPhap(): Promise<PhuongPhap[]> {
  const d = getDb(); if (!d) return [];
  const rows = (await d.execute(sql`SELECT key, nhan, mo_ta, nham, buoc, noi, may, nguong, thu_tu, bat FROM phuong_phap ORDER BY thu_tu, key`)) as unknown as DongPp[];
  return rows.map(dichPp);
}
