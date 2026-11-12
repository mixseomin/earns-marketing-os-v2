// NGỌC CHẤM THUMBNAIL (02/11/2026): ảnh thumb.mjs dựng → R2 (tên theo nội dung, ảnh đổi là xét lại) → cham-dang › xetThumbAi. Chạy trên box3:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/xet-thumb.mts <id> "<tiêu đề>" <thumb.jpg> ["<chủ đề>" "<tệp Commons ảnh nền>"]
// In JSON { url, chan: string[], canh: string[] } — chan rỗng = qua.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { uploadToR2 } from '../../src/lib/r2';
import { xetThumbAi } from '../../../cty/worker/cham-dang.mjs';

const [id, title, tep, chuDe, nguon] = process.argv.slice(2);
if (!id || !title || !tep) { console.error('xet-thumb.mts <id> "<tiêu đề>" <thumb.jpg>'); process.exit(2); }
const b = readFileSync(tep), url = await uploadToR2(`xuong-video/lich-su/tap/${id}/thumb-${createHash('md5').update(b).digest('hex').slice(0, 12)}.jpg`, b, 'image/jpeg');
if (!url) { console.error('✗ tải R2 hỏng'); process.exit(1); }
// THỬ LẠI KHI NGỌC TRƯỢT VÌ LỖI MÁY (12/11/2026, ynt-20261112): fal/gemini thỉnh thoảng không lấy được ảnh dù img.on.tc trả 200 → xetThumbAi trả null
// (cham-dang coi là "ảnh không tới", không lưu sổ) → trước đây exit 1 giết CẢ TẬP sau khi đã tốn giọng + kho + dựng. kq null = lỗi máy (url luôn có vì vừa tải R2),
// KHÁC với bị chặn nội dung (kq có, kq.chan đầy) — nên chỉ null mới thử lại, chặn nội dung thả về ngay cho vòng đổi ảnh của thumb.mjs xử. Giãn 4 / 8 / 16s.
let kq: Awaited<ReturnType<typeof xetThumbAi>>[number] = null;
for (let i = 0; i < 4; i++) {
  [kq] = await xetThumbAi([{ title, url, chu_de: chuDe || null, nguon: nguon || null }]);
  if (kq) break;
  if (i < 3) { console.error(`· Ngọc trượt (lỗi máy) lần ${i + 1}/4 — thử lại sau ${4 << i}s`); await new Promise((ok) => setTimeout(ok, (4 << i) * 1000)); }
}
if (!kq) { console.error('✗ Ngọc không trả lời (proxy cty) sau 4 lần — chưa chấm được thumbnail'); process.exit(1); }
console.log(JSON.stringify({ url, chan: kq.chan, canh: kq.canh }));
process.exit(0);
