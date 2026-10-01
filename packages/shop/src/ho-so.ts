// SHOP — HỒ SƠ TRAO ĐỔI với khách / nhà cung cấp (bảng shop_ho_so + shop_ho_so_tin, migration 0197). Một khuôn cho hai phía; loại +
// trạng thái khai ở đây để mặt tiền (form liên hệ), nhịp đồng bộ (dispute Stripe/CJ) và màn /shop cùng đọc một bản.
import { sql } from 'drizzle-orm';
import { q } from './su-kien';

export type Ben = 'khach' | 'ncc';
export const LOAI_HO_SO: Record<Ben, { key: string; nhan: string; chuThich: string }[]> = {
  khach: [
    { key: 'lien_he', nhan: 'Liên hệ', chuThich: 'Khách gửi form Contact us / hỏi chung.' },
    { key: 'khieu_nai', nhan: 'Khiếu nại', chuThich: 'Sai size, lỗi hàng, giao trễ, không nhận được…' },
    { key: 'doi_tra', nhan: 'Đổi / trả', chuThich: 'Khách muốn đổi size hoặc trả hàng.' },
    { key: 'hoan_tien', nhan: 'Hoàn tiền', chuThich: 'Khách đòi hoàn tiền (chưa qua ngân hàng).' },
    { key: 'dispute', nhan: 'Dispute', chuThich: 'Khách khiếu nại qua ngân hàng/thẻ (Stripe dispute) — có HẠN nộp bằng chứng.' },
    { key: 'khac', nhan: 'Khác', chuThich: '' },
  ],
  ncc: [
    { key: 'hoi', nhan: 'Hỏi NCC', chuThich: 'Hỏi tồn kho, tuyến ship, mẫu, giá…' },
    { key: 'khieu_nai', nhan: 'Khiếu nại NCC', chuThich: 'Thiếu/sai/hỏng hàng — dispute bên CJ.' },
    { key: 'giao_tre', nhan: 'Giao trễ', chuThich: 'Đơn đứng lâu, vận đơn không chạy — giục NCC.' },
    { key: 'khac', nhan: 'Khác', chuThich: '' },
  ],
};
export const TRANG_THAI_HO_SO = [
  { key: 'moi', nhan: 'Mới', chuThich: 'Chưa ai đụng tới.' },
  { key: 'dang_xu_ly', nhan: 'Đang xử lý', chuThich: 'Mình đang làm (tra đơn, hỏi NCC, soạn trả lời…).' },
  { key: 'cho_ho', nhan: 'Chờ bên kia', chuThich: 'Đã trả lời/gửi — chờ khách hoặc NCC phản hồi.' },
  { key: 'xong', nhan: 'Xong', chuThich: 'Đã giải quyết / đóng.' },
] as const;
export const NHAN_LOAI = (ben: Ben, k: string) => LOAI_HO_SO[ben].find((x) => x.key === k)?.nhan ?? k;

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
