// NGỌC SOI HÌNH TRƯỚC KHI DỰNG CẢ TẬP (02/11/2026, anh: "tăng tốc dựng"): 8 khung giữa cảnh (dung-tap --soat) → R2 (tên theo nội dung, sổ xet-hinh.json
// của Ngọc không đọc nhầm kết quả cũ) → đúng hàm xetHinhAi của Phòng Nội dung. Chặn ở đây thì lam-tap dừng trước 5.000+ khung, không phải dựng xong mới bị SỬA LẠI.
// Chạy trên box3 (proxy cty + R2):
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/xet-truoc.mts <id> "<tiêu đề>" k-0.jpg k-1.jpg …
// In JSON { chan: string[], canh: string[] } — chan rỗng = qua.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { uploadToR2 } from '../../src/lib/r2';
import { xetHinhAi } from '../../../cty/worker/cham-dang.mjs';

const [id, title, ...tep] = process.argv.slice(2);
if (!id || !title || !tep.length) { console.error('xet-truoc.mts <id> "<tiêu đề>" <khung.jpg>…'); process.exit(2); }
const anh: string[] = [];
for (const f of tep) {
  const b = readFileSync(f), u = await uploadToR2(`xuong-video/lich-su/tap/${id}/truoc-${createHash('md5').update(b).digest('hex').slice(0, 12)}.jpg`, b, 'image/jpeg');
  if (!u) { console.error(`✗ tải R2 hỏng: ${f}`); process.exit(1); }
  anh.push(u);
}
const [kq] = await xetHinhAi([{ title, anh }]);
console.log(JSON.stringify({ chan: kq?.chan ?? [], canh: kq?.canh ?? [], anh }));
process.exit(0);
