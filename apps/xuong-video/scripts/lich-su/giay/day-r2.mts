// ĐẨY BẢN DỰNG MẪU DÀI GHÉP GIẤY LÊN R2 (06/11/2026), chạy trên box3: tsx day-r2.mts <mp4> <thumb.jpg> <id> → in link mp4 ở dòng cuối
import { readFileSync } from 'node:fs';
import { uploadToR2 } from '../../../src/lib/r2';
const [mp4, thumb, id] = process.argv.slice(2);
await uploadToR2(`xuong-video/lich-su/dai/${id}/${id}-thumb.jpg`, readFileSync(thumb), 'image/jpeg');
console.log(await uploadToR2(`xuong-video/lich-su/dai/${id}/${id}.mp4`, { tep: mp4 }, 'video/mp4'));
