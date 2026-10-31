// HỎI KHUNG THẬT (luat-dung.ts › do_tren_hinh_that): câu hỏi kiểm khung (cau-hoi-khung.ts — dáng, đồ trên người, ai có / không có trong khung, thấy mặt)
// hỏi Gemini Flash trên MỘT khung cắt từ clip đã dùng → câu "không" = lỗi đúng loại. Bắt lớp lỗi máy đo mặt không thấy: phim #353 #8 nắm tay trống không
// cầm dây thẻ, #13 Hạ vẫn đeo dây thẻ đã bị giật. ~0,3¢ / khung, ghi tiền vào xv_job như mọi lượt chữ. Thiếu khoá / lỗi mạng → null (không báo đạt giả).
import 'server-only';
import { readFile } from 'node:fs/promises';
import { goiGeminiJson } from './soi-bien-dang';
import { ghiTienChu, type Db } from './doc-db';
import type { CauHoi } from './cau-hoi-khung';

/** MÃ CÂU ĐƯỢC CHẶN (báo nhầm ≤ 5% trên bộ mẫu 45 khung phim #353, hieu-chinh-hoi.mts 25/10/2026: co 3% · mat 4% · ngoai 0% · vang 0% · vat 3%);
 *  ket 10% · mo 8% · dang 12% · lung 31% · chen 33% → chỉ cảnh báo. MỘT nguồn cho soat-huong.mts và hieu-chinh-hoi.mts. */
export const MA_CHAN = /^(vang|co|ngoai|vat|mat|tay|cho):/;   // tay: tay cầm đồ theo sổ (25/10/2026)
export const laChan = (ma: string) => MA_CHAN.test(ma);
/** Hỏi `lan` lượt (mặc định 2, độ phân giải cao): BỎ SÓT không ổn định (cùng khung lỗi lần bắt lần không — #13 dây thẻ, #3 thiếu Vivian) → mỗi câu lấy
 *  "không" khi ≥ 1 lượt trả không với câu CHẶN cần độ nhạy? Không — chặn cần ít báo nhầm: câu chặn = cả hai lượt "không"; cảnh báo = một lượt "không".
 *  Trả về { chan: mã câu cả hai lượt không, canh: mã câu một lượt không }. */
export async function hoiKhung2(db: Db, phimId: number | null, anh: string, cau: CauHoi[], lan = 2): Promise<{ dap: Record<string, boolean>; motLan: Set<string> } | null> {
  const ds = await Promise.all(Array.from({ length: lan }, () => hoiKhung(db, phimId, anh, cau, 'MEDIA_RESOLUTION_HIGH'))); if (ds.some((d) => !d)) return null;
  const dap: Record<string, boolean> = {}; const motLan = new Set<string>();
  for (const c of cau) { const khong = ds.filter((d) => d![c.ma] === false).length; dap[c.ma] = khong < lan; if (khong > 0 && khong < lan) motLan.add(c.ma); }
  return { dap, motLan };
}
export async function hoiKhung(db: Db, phimId: number | null, anh: string, cau: CauHoi[], res: 'MEDIA_RESOLUTION_MEDIUM' | 'MEDIA_RESOLUTION_HIGH' = 'MEDIA_RESOLUTION_MEDIUM'): Promise<Record<string, boolean> | null> {
  if (!cau.length) return {};
  const b = /^https?:/.test(anh) ? Buffer.from(await (await fetch(anh)).arrayBuffer()) : await readFile(anh);
  const schema = { type: 'OBJECT', properties: { dap: { type: 'ARRAY', items: { type: 'OBJECT', properties: { ma: { type: 'STRING' }, co: { type: 'BOOLEAN' } }, required: ['ma', 'co'] } } }, required: ['dap'] };
  const text = ['This is ONE frame of an AI-generated film shot. Answer every yes/no question strictly from what is VISIBLE in this frame (co=true = yes, co=false = no).',
    'Answer co=false ONLY when the frame CLEARLY shows the opposite. If the thing asked about is hidden (behind a person, shoulder, box, out of frame), too small, blurred or ambiguous, answer co=true — never guess a defect.', 'Questions (Vietnamese):',
    ...cau.map((c) => `[${c.ma}] ${c.hoi}`)].join('\n');
  const r = await goiGeminiJson<{ dap?: { ma: string; co: boolean }[] }>([{ text }, { inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } }], schema, res);
  if (!r) return null;
  await ghiTienChu(db, phimId, 'soi nối cắt (hỏi khung)', r.model, r.tk, r.nguon);
  return Object.fromEntries((r.data.dap ?? []).map((x) => [x.ma, x.co]));
}
