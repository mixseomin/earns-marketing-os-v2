// HỎI KHUNG THẬT (luat-dung.ts › do_tren_hinh_that): câu hỏi kiểm khung (cau-hoi-khung.ts — dáng, đồ trên người, ai có / không có trong khung, thấy mặt)
// hỏi Gemini Flash trên MỘT khung cắt từ clip đã dùng → câu "không" = lỗi đúng loại. Bắt lớp lỗi máy đo mặt không thấy: phim #353 #8 nắm tay trống không
// cầm dây thẻ, #13 Hạ vẫn đeo dây thẻ đã bị giật. ~0,3¢ / khung, ghi tiền vào xv_job như mọi lượt chữ. Thiếu khoá / lỗi mạng → null (không báo đạt giả).
import 'server-only';
import { readFile } from 'node:fs/promises';
import { goiGeminiJson, MO_HINH_BD } from './soi-bien-dang';
import { ghiTienChu, type Db } from './doc-db';
import type { CauHoi } from './cau-hoi-khung';

export async function hoiKhung(db: Db, phimId: number | null, anh: string, cau: CauHoi[]): Promise<Record<string, boolean> | null> {
  if (!cau.length) return {};
  const b = /^https?:/.test(anh) ? Buffer.from(await (await fetch(anh)).arrayBuffer()) : await readFile(anh);
  const schema = { type: 'OBJECT', properties: { dap: { type: 'ARRAY', items: { type: 'OBJECT', properties: { ma: { type: 'STRING' }, co: { type: 'BOOLEAN' } }, required: ['ma', 'co'] } } }, required: ['dap'] };
  const text = ['This is ONE frame of an AI-generated film shot. Answer every yes/no question strictly from what is VISIBLE in this frame (co=true = yes, co=false = no).',
    'Answer co=false ONLY when the frame CLEARLY shows the opposite. If the thing asked about is hidden (behind a person, shoulder, box, out of frame), too small, blurred or ambiguous, answer co=true — never guess a defect.', 'Questions (Vietnamese):',
    ...cau.map((c) => `[${c.ma}] ${c.hoi}`)].join('\n');
  const r = await goiGeminiJson<{ dap?: { ma: string; co: boolean }[] }>([{ text }, { inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } }], schema, 'MEDIA_RESOLUTION_MEDIUM');
  if (!r) return null;
  await ghiTienChu(db, phimId, 'soi nối cắt (hỏi khung)', MO_HINH_BD, r.tk, 'google');
  return Object.fromEntries((r.data.dap ?? []).map((x) => [x.ma, x.co]));
}
