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
const [kq] = await xetThumbAi([{ title, url, chu_de: chuDe || null, nguon: nguon || null }]);
if (!kq) { console.error('✗ Ngọc không trả lời (proxy cty) — chưa chấm được thumbnail'); process.exit(1); }
console.log(JSON.stringify({ url, chan: kq.chan, canh: kq.canh }));
process.exit(0);
