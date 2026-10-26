// CLIP KHOÁ ĐẦU + CUỐI cho shot ĐỔI TRẠNG THÁI (cửa khép, đồ đổi tay, người quay đi — anh 26/10/2026 "lần nào cái này cũng sai": chỉ khung đầu thì model tự
// chế đoạn kết — người bước ra, cửa mở ngược, cửa biến hình). Khung cuối SỬA từ chính khung đầu (cùng người, cùng nền, cùng ánh sáng — chỉ đổi đúng chỗ
// trạng thái), rồi Vidu Q2 Turbo nhận cả đầu lẫn cuối nên chỉ còn diễn đoạn giữa. ckey ~110₫ (khung cuối) + Vidu $0,05/giây 720p.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/clip-dau-cuoi.mts --dau=/tmp/khung-356/so-29-that.png --sua-cuoi="<chỉ thị sửa tiếng Anh>" --dien="<diễn giữa>" --giay=3 --ra=/tmp/khung-356/clip-29
//   (--cuoi=<tệp> thay --sua-cuoi khi đã có khung cuối; --chi-khung = chỉ sinh khung cuối để duyệt)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sinhAnhMotCong } from '../src/lib/xuong-video/cong-ai';
import { guiFal, docFal } from '../src/lib/xuong-video/fal';
import { uploadToR2 } from '../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const dau = gia('dau'), ra = gia('ra') ?? '/tmp/clip-dau-cuoi', giay = Math.max(2, Math.min(8, Number(gia('giay') || 3))), dien = gia('dien') ?? '';
if (!dau || (!gia('cuoi') && !gia('sua-cuoi'))) { console.error('cần --dau và --cuoi hoặc --sua-cuoi'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1'); process.exit(2); }
const len = async (f: string, k: string) => { const u = await uploadToR2(`xuong-video/thu/${k}-${randomUUID()}${f.slice(f.lastIndexOf('.'))}`, readFileSync(f), f.endsWith('.mp4') ? 'video/mp4' : 'image/png'); if (!u) throw new Error(`không tải lên được ${f}`); return u; };
const uDau = /^https?:/.test(dau) ? dau : await len(dau, 'clip-dau');

let fCuoi = gia('cuoi') ?? `${ra}-cuoi.png`;
if (!gia('cuoi')) {
  if (!existsSync(fCuoi) || process.argv.includes('--lai')) {
    const a = await sinhAnhMotCong('ckey', 'wowztools/nano-banana-2', { prompt: `Edit this photo. Keep EXACTLY the same camera position, framing, lens, lighting, colours, background and every person's face, hair, outfit and props. ONLY change this: ${gia('sua-cuoi')} Nothing else changes. No text.`, thamChieuUrl: [uDau], tiLe: '9:16' });
    if (!a.anh) { console.log(`khung cuối hỏng — ${a.loi}`); process.exit(3); }
    writeFileSync(fCuoi, a.anh.data);
  }
}
const uCuoi = /^https?:/.test(fCuoi) ? fCuoi : await len(fCuoi, 'clip-cuoi'); console.log(`khung cuối: ${uCuoi}`);
if (process.argv.includes('--chi-khung')) process.exit(0);

const g = await guiFal('fal-ai/vidu/q2/image-to-video/turbo', { prompt: `Photorealistic live-action vertical short drama. Locked-off static camera, no camera movement, no cuts. ${dien} The first and last frames are exact; only what is described moves. Natural, realistic motion and weight.`.slice(0, 3000),
  image_url: uDau, end_image_url: uCuoi, duration: giay, resolution: '720p', movement_amplitude: 'auto' });
if (!g.ok) { console.log(`Vidu từ chối — ${g.loi}`); process.exit(4); }
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 10_000)); const d = await docFal(g.taskId);
  if (d.done && d.ok) { writeFileSync(`${ra}.mp4`, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); console.log(`clip: ${await len(`${ra}.mp4`, 'clip')}`); process.exit(0); }
  if (d.done) { console.log(`Vidu hỏng — ${d.loi}`); process.exit(5); }
}
console.log('quá 20 phút'); process.exit(6);
