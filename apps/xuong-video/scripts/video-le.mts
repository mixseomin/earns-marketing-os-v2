// VIDEO LẺ không gắn phim (thử model / clip kênh dựng nhanh): ảnh đầu [+ ảnh cuối] + prompt → một clip qua cổng video của studio (cong-ai.ts ›
// guiVideoCong / docVideoCong — cùng adapter máy sinh dùng), chờ xong, tải về tệp cục bộ trên box + R2, in link + giá sổ. Mặc định PlenX Veo 3.1 Lite
// (rẻ nhất sổ giá, ~600₫ / clip 8s 720p, có tiếng).
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/video-le.mts --anh-dau=<url> [--anh-cuoi=<url>] \
//     --prompt='…' --ra=/tmp/x.mp4 [--cong=plenxai --model=veo3-lite --giay=8 --ti-le=9:16]
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '../src/lib/r2';
import { guiVideoCong, docVideoCong, giaVideoCong, donVideoCong, type CongKey } from '../src/lib/xuong-video/cong-ai';
import '../src/lib/xuong-video/cong-plenxai';

const arg = (k: string, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const cong = arg('cong', 'plenxai') as CongKey, model = arg('model', 'veo3-lite'), ra = arg('ra'), prompt = arg('prompt');
const anhDau = arg('anh-dau'), anhCuoi = arg('anh-cuoi') || null, giay = Number(arg('giay', '8')), tiLe = arg('ti-le', '9:16');
if (!anhDau || !prompt || !ra) { console.error('thiếu --anh-dau --prompt --ra'); process.exit(1); }
const g = await guiVideoCong(cong, model, { tiLe, prompt, anhDau, anhCuoi, giay });
if (!g.ok) { console.error('gửi hỏng:', g.loi); process.exit(1); }
const taoLuc = new Date().toISOString(), t0 = Date.now();
console.log(`gửi ${cong}:${model} → ${g.taskId}`);
for (;;) {
  await new Promise((r) => setTimeout(r, 10_000));
  const d = await docVideoCong(cong, g.taskId, taoLuc);
  if (!d.done) continue;
  if (!d.ok) { console.error('hỏng:', d.loi); process.exit(1); }
  const buf = Buffer.from(await (await fetch(d.uri)).arrayBuffer());
  writeFileSync(ra, buf);
  const url = await uploadToR2(`xuong-video/video-le/${randomUUID()}.mp4`, buf, 'video/mp4');
  await donVideoCong(cong, d.uri);
  console.log(`${ra} · ${url} · ${Math.round((Date.now() - t0) / 1000)}s · ${giaVideoCong(cong, model).vnd ?? '?'}₫ (sổ)`);
  process.exit(0);
}
