// SHOP — GHI hồ sơ trao đổi (DB). Tách khỏi ho-so.ts (định nghĩa thuần) vì màn /shop chạy ở trình duyệt import loại/trạng thái —
// kéo theo module nối DB là gãy bản dựng (01/10/2026). Lưới: scripts/check-client-db.mjs.
import { sql } from 'drizzle-orm';
import { q } from './su-kien';
import type { Ben } from './ho-so';

type MoHoSo = { cuaHangId: number; ben: Ben; loai: string; tieuDe: string; donId?: number | null; ten?: string | null; email?: string | null;
  nguon?: string; maNgoai?: string | null; soTien?: number | null; han?: string | null; trangThai?: string };

/** Mở hồ sơ (nguồn ngoài có ma_ngoai thì upsert — chạy lại nhịp không đẻ bản trùng). Trả id + có phải bản mới không. */
export async function moHoSo(h: MoHoSo): Promise<{ id: number; moi: boolean }> {
  const [r] = await q<{ id: number; moi: boolean }>(sql`
    INSERT INTO shop_ho_so (cua_hang_id, ben, loai, trang_thai, tieu_de, don_id, ten, email, nguon, ma_ngoai, so_tien, han)
    VALUES (${h.cuaHangId}, ${h.ben}, ${h.loai}, ${h.trangThai ?? 'moi'}, ${h.tieuDe.slice(0, 200)}, ${h.donId ?? null}, ${h.ten ?? null}, ${h.email ?? null},
            ${h.nguon ?? 'tay'}, ${h.maNgoai ?? null}, ${h.soTien ?? null}, ${h.han ?? null}::timestamptz)
    ON CONFLICT (nguon, ma_ngoai) WHERE ma_ngoai IS NOT NULL DO UPDATE SET so_tien = EXCLUDED.so_tien, han = EXCLUDED.han, cap_nhat = shop_ho_so.cap_nhat
    RETURNING id, (xmax = 0) AS moi`);
  return r!;
}

export async function themTin(hoSoId: number, nguoi: string, kenh: string, noiDung: string, loi = false) {
  await q(sql`INSERT INTO shop_ho_so_tin (ho_so_id, nguoi, kenh, noi_dung, loi) VALUES (${hoSoId}, ${nguoi}, ${kenh}, ${noiDung.slice(0, 20000)}, ${loi})`);
  await q(sql`UPDATE shop_ho_so SET cap_nhat = now() WHERE id = ${hoSoId}`);
}
