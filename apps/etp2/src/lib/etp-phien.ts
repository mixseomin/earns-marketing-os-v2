// MÃ PHIÊN BẢN DỮ LIỆU etp2 (anh 09/11/2026 "sửa load chậm"): trang tự làm mới mỗi phút bằng router.refresh → mỗi phút tải lại ~10 MB dữ liệu
// + dựng lại cả bảng dù số không đổi. Giờ trang hỏi /etp/phien (mã băm dữ liệu, vài chục byte), mã khác mã trang đang cầm mới làm mới.
// Băm bỏ `luc` (giờ dựng). Có trường đổi theo đồng hồ thì mã đổi mỗi phút — chỉ quay về như cũ (làm mới mỗi phút), không mất số.
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { DuLieuEtp } from './etp-doc';

export const phienDu = (d: DuLieuEtp) => createHash('sha1').update(JSON.stringify({ ...d, luc: null })).digest('hex').slice(0, 16);

/** LƯỢT ĐỒNG BỘ ĐANG GHI KHO (#1582): etp.dong_bo có lượt chưa `xong` bắt đầu trong 12 phút (lượt thường ~5 phút, dài nhất đo 9 phút; quá 12 phút = lượt chết, thôi chờ).
 *  Lúc đó kho đổi dần từng phút — /etp/phien trả 'dang', trang không làm mới tới khi lượt xong. Lỗi đọc sổ → coi như không đồng bộ (làm mới như cũ). */
export async function dangDongBo(): Promise<boolean> {
  const db = getDb(); if (!db) return false;
  const r = (await db.execute(sql`select exists (select 1 from etp.dong_bo where xong is null and bat_dau > now() - interval '12 minutes') dang`).catch(() => [])) as unknown as { dang: boolean }[];
  return !!r[0]?.dang;
}
