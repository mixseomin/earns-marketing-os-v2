// Người được quản trị cấp quyền Studio 2 (bảng xv_s2_quyen, mục Đội của studio2) dùng được hòm góp ý trên studio2.on.tc — anh 24/11/2026
// "tk doanhoe cũng là admin của studio2 nên hãy cho phép gửi task vào gopy đầy đủ". Hai chỗ hỏi: layout gốc (hiện hòm trong iframe nhúng từ
// studio2) và guiGopYMos2 (cho gửi vào hòm xuong-video). Trả lời / làm lại đi qua cuaMinh của @mos2/gop-y (chỉ card mình gửi); duyệt vẫn chỉ admin.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { noiNhungGopY } from './gop-y-loc-nguon';

/** yêu cầu là hòm góp ý nhúng trong studio2 (khung iframe hoặc lượt gọi bên trong khung — xem noiNhungGopY). */
export function tuStudio2(host: string | null | undefined, referer: string | null | undefined, dest: string | null | undefined): boolean {
  return noiNhungGopY(host, referer, dest) === 'studio2.on.tc';
}

export async function quyenGopYS2(userId: number | null | undefined): Promise<boolean> {
  const db = getDb();
  if (!db || !userId) return false;
  const r = (await db.execute(sql`SELECT 1 FROM xv_s2_quyen WHERE user_id = ${userId} AND (dung OR sinh) LIMIT 1`)) as unknown as unknown[];
  return r.length > 0;
}
