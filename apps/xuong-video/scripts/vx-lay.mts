// LẤY VỀ video đã render từ VideoExpress.ai (anh 27/10/2026) — đọc sổ <bang>.vx.json {shot → uuid}, khớp uuid trong My AI Videos,
// tải mp4 về <khung>/vx-N.mp4 (dung-tu-video.mts ưu tiên dùng file này). $0: chỉ ĐỌC thư viện của chính mình + tải mp4.
// Chạy sau vx-gui.mts, cách ~4-5 phút để render xong. Item còn isPending=true thì báo "đang render", chạy lại sau.
// LƯU Ý: VideoExpress chỉ giữ file 40 ngày → lấy về rồi là xong, không trông vào bản trên họ.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && ~/bin/br use 677 \
//     && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/vx-lay.mts --bang=scripts/so-do/thang-may-356.json --khung=/tmp/khung-356
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { getMedia, catId, trenApp } from './vx-br.mts';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tepBang = gia('bang')!, thu = gia('khung')!;
if (!tepBang || !thu) { console.error('cần --bang --khung'); process.exit(1); }
const soSo = `${tepBang}.vx.json`;
if (!existsSync(soSo)) { console.error(`chưa có sổ ${soSo} — chạy vx-gui.mts trước`); process.exit(1); }
const so = JSON.parse(readFileSync(soSo, 'utf8')) as Record<string, { uuid: string | null }>;
if (!trenApp()) { console.error('br chưa ở app.videoexpress.ai. Chạy: br use 677 && br goto https://app.videoexpress.ai/'); process.exit(2); }

const catVideo = catId('my_ai_videos');
const list = getMedia(catVideo, 100).results;
const theoUuid = new Map(list.map((r) => [r.uuid, r]));

let lay = 0, cho = 0, thieu = 0;
for (const [shot, { uuid }] of Object.entries(so)) {
  if (!uuid) { console.log(`#${shot}: chưa có uuid (gửi hỏng) — bỏ`); thieu++; continue; }
  const it = theoUuid.get(uuid);
  if (!it) { console.log(`#${shot}: không thấy job ${uuid.slice(0, 8)} trong thư viện (quá 40 ngày?) — bỏ`); thieu++; continue; }
  if (it.isPending || !it.mediaPath) { console.log(`#${shot}: đang render (${uuid.slice(0, 8)}) — chạy lại sau`); cho++; continue; }
  const ra = `${thu}/vx-${shot}.mp4`;
  if (existsSync(ra)) { console.log(`#${shot}: đã có ${ra} — bỏ`); continue; }
  execFileSync('curl', ['-sfL', '-o', ra, it.mediaPath]);
  console.log(`#${shot}: ✓ ${ra}  (${it.frameSize}, ${(it.duration / 1000).toFixed(2)}s)`);
  lay++;
}
console.log(`\nLấy ${lay} · đang render ${cho} · thiếu ${thieu}. ${cho ? 'Còn clip đang render — chạy lại sau vài phút.' : 'Xong. Dựng: tsx scripts/dung-tu-video.mts (vx-N.mp4 đã ưu tiên).'}`);
process.exit(0);
