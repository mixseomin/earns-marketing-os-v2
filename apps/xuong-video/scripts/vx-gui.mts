// GỬI LÔ video lên VideoExpress.ai qua br (anh 27/10/2026). Mỗi shot cờ `nguon:"vx"` (hoặc --so=list): nạp so-N-that.png làm khung đầu →
// prompt chuyển động từ `dien_en` (+ sfx) → Create Video. Ghi sổ {shot → uuid} vào <bang>.vx.json để vx-lay.mts lấy về.
// GỬI async nên cứ gửi hết lô rồi đi (không chờ render); dừng ngay khi gặp "limit" (hết lượt/ngày). $0.
// THUẦN API (anh 27/10/2026): upload + image2video + poll đều qua fetch trong trang (cookie phiên = token của họ) — bỏ hẳn DOM/picker chập chờn.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && ~/bin/br use 677 && ~/bin/br goto https://app.videoexpress.ai/   # mở app trước
//   VX_CHAY=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/vx-gui.mts --bang=scripts/so-do/thang-may-356.json --khung=/tmp/khung-356 --so=26,28
//   (bỏ VX_CHAY=1 = chạy thử, chỉ IN tag + prompt, không gửi)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { napKhung, guiShot, catId, trenApp, ngu } from './vx-br.mts';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tepBang = gia('bang')!, thu = gia('khung')!;
if (!tepBang || !thu) { console.error('cần --bang --khung [--so=list]'); process.exit(1); }
type Shot = { so: number; giay: number; dien_en?: string; sfx?: string; nguon?: string; thoai?: string };
const bang = JSON.parse(readFileSync(tepBang, 'utf8')) as { shot: Shot[] };
const chay = !!process.env.VX_CHAY;
const loc = (gia('so') || '').split(',').map(Number).filter(Boolean);
const ds = bang.shot.filter((s) => (loc.length ? loc.includes(s.so) : s.nguon === 'vx'));
if (!ds.length) { console.error(loc.length ? 'không có shot nào khớp --so' : 'không có shot nào cờ nguon:"vx" — dùng --so=...'); process.exit(1); }

function cauPrompt(s: Shot): string {
  const tieng = s.sfx ? ` Include a natural ${s.sfx.replace(/_/g, ' ')} sound and soft ambient room tone.` : ' Soft, natural ambient room tone.';
  // SHOT THOẠI: để VideoExpress TỰ sinh tiếng Việt từ lời thoại (anh chốt 27/10 "tạm ổn vì $0" — native, không TTS ngoài).
  // Đưa thẳng câu tiếng Việt vào prompt; dien_en cho sắc thái/động tác. enhanceVideoPrompt=0 (vx-gui) để giữ nguyên câu.
  if (s.thoai) return `Photorealistic live-action vertical short-drama clip; the first frame is exact — keep the person's face, hair, outfit and props unchanged. The person looks ahead and speaks in Vietnamese with natural lip-sync. ${s.dien_en ?? ''} They say in Vietnamese: "${s.thoai}". Locked camera.${tieng}`.replace(/\s+/g, ' ').slice(0, 1500);
  return `Photorealistic live-action vertical short-drama clip; the first frame is exact — keep the person's face, hair, outfit and props unchanged. ${s.dien_en ?? 'Subtle natural movement.'} Subtle, natural motion and weight; locked camera unless the direction says otherwise.${tieng}`.replace(/\s+/g, ' ').slice(0, 1500);
}

const soSo = `${tepBang}.vx.json`;
const so: Record<string, { uuid: string | null; mediaId?: number; luc: string; prompt: string }> =
  existsSync(soSo) ? JSON.parse(readFileSync(soSo, 'utf8')) : {};

console.log(`${chay ? '▶ GỬI THẬT' : '· CHẠY THỬ (không gửi — đặt VX_CHAY=1 để gửi)'} · ${ds.length} shot`);
if (!chay) { for (const s of ds) console.log(`#${s.so} [s${s.so}] ${existsSync(`${thu}/so-${s.so}-that.png`) ? '' : '⚠ THIẾU KHUNG '}${cauPrompt(s)}`); process.exit(0); }

if (!trenApp()) { console.error('br chưa ở app.videoexpress.ai (đăng nhập). Chạy: br use 677 && br goto https://app.videoexpress.ai/'); process.exit(2); }
const catDefault = catId('default');

let gui = 0;
for (const s of ds) {
  const f = `${thu}/so-${s.so}-that.png`;
  if (!existsSync(f)) { console.log(`#${s.so}: thiếu ${f} — bỏ`); continue; }
  if (so[s.so]?.uuid) { console.log(`#${s.so}: đã gửi (uuid ${so[s.so].uuid.slice(0, 8)}) — bỏ`); continue; }
  console.log(`#${s.so} → nạp + gửi`);
  const mediaId = await napKhung(f, catDefault);
  if (!mediaId) { console.log(`#${s.so}: ✗ nạp khung hỏng — DỪNG`); break; }
  const uuid = guiShot(mediaId, cauPrompt(s), !s.thoai); // shot thoại: enhance=0 để giữ nguyên câu tiếng Việt
  so[s.so] = { uuid, mediaId, luc: new Date().toISOString(), prompt: cauPrompt(s) };
  writeFileSync(soSo, JSON.stringify(so, null, 2));
  if (uuid) { console.log(`#${s.so}: ✓ job ${uuid.slice(0, 8)} (mediaId ${mediaId})`); gui++; }
  else { console.log(`#${s.so}: ✗ không gửi được — DỪNG (có thể hết lượt/ngày)`); break; }
  await ngu(1500);
}
console.log(`\nĐã gửi ${gui}/${ds.length} job. Sổ: ${soSo}. Chờ ~4 phút/clip rồi: tsx scripts/vx-lay.mts --bang=${tepBang} --khung=${thu}`);
process.exit(0);
