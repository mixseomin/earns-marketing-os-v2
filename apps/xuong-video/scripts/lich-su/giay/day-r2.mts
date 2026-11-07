// ĐẨY BẢN DỰNG MẪU DÀI GHÉP GIẤY LÊN R2 (06/11/2026), chạy trên box3: tsx day-r2.mts <mp4> <thumb.jpg> <id> [khung.jpg …]
// → dòng cuối là JSON { url, thumb, khung: [url…] } (khung = ảnh soát cho Phòng Nội dung chấm, nap-dai.mjs nạp kèm)
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { uploadToR2 } from '../../../src/lib/r2';
const [mp4, thumb, id, ...khung] = process.argv.slice(2);
const goc = `xuong-video/lich-su/dai/${id}`;
const th = await uploadToR2(`${goc}/${id}-thumb.jpg`, readFileSync(thumb), 'image/jpeg');
const kh = []; for (const f of khung) kh.push(await uploadToR2(`${goc}/${basename(f)}`, readFileSync(f), 'image/jpeg'));
console.log(JSON.stringify({ url: await uploadToR2(`${goc}/${id}.mp4`, { tep: mp4 }, 'video/mp4'), thumb: th, khung: kh }));
