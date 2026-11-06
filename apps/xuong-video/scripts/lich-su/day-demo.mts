// ĐẨY VIDEO DEMO MẪU lên kho video Studio (R2 · img.on.tc) — mẫu đã duyệt của kênh phải xem được từ mos2 › Kênh nội dung (luật: video luôn qua studio.on.tc).
// Chạy trên box3: NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/day-demo.mts <kênh> <thư-mục-mp4> [nhánh = demo]  → in JSON { <tên tệp>: <url> } (dán vào so-kenh.json › mau[].demo)
// nap-tap.mjs dùng nhánh 'tap' để đẩy bản phát hành + khung hình (.jpg) của tập nạp máy đăng
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { uploadToR2 } from '../../src/lib/r2';

const [kenh, dir, nhanh = 'demo'] = process.argv.slice(2);
if (!kenh || !dir) { console.error('tsx day-demo.mts <kênh> <thư-mục>'); process.exit(2); }
const ra: Record<string, string> = {};
for (const f of readdirSync(dir).filter((x) => /\.(mp4|jpg)$/.test(x))) {
  const u = await uploadToR2(`xuong-video/${nhanh}/${kenh}/${f}`, readFileSync(join(dir, f)), f.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4');
  if (!u) { console.error(`✗ không đẩy được ${f} (R2 chưa cấu hình?)`); process.exit(3); }
  ra[f.replace(/\.(mp4|jpg)$/, '')] = u;
}
console.log(JSON.stringify(ra));
