// 🩹 SỬA MẶT cho keyframe LÀM TAY (file rời, chưa vào DB) — cùng cơ chế face-detailer của suaMatCanh (soi-mat.ts):
//   soi mặt tìm ô đầu → cắt RIÊNG vùng đầu (cat_vung) → ckey nano-banana nhận [vùng đầu, mặt anchor] + lệnh "chỉ vẽ lại đúng người
//   này, giữ y khung" → dán lại vào khung gốc (dan, mặt nạ elip mờ biên + khớp màu) → SOI LẠI. Đạt (match ≥ nguong) thì ghi đè;
//   chưa đạt thì thử lại TỪ ẢNH GỐC tối đa --lan lần. Vì sinh lại CẢ ảnh (keyframe-sua.mts) để mặt trôi sang người khác (đo 28/10:
//   3 người khác nhau, 39–45%) — detailer chỉ đụng vùng mặt nên giữ đúng danh tính, đúng lý do studio bỏ "vẽ cả khung".
// Chạy TRÊN box3 (có soi-mat.py + CKEY + R2):
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sua-mat-file.mts \
//       --file /root/khung-356/so-7-that.png --ten 'Lâm Hạ' \
//       --anchor 'https://img.on.tc/xuong-video/anchor/287-...png' \
//       --mat 'https://img.on.tc/xuong-video/mat/481-913525f194ec-0.jpg' --nguong 0.5 --lan 3
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sinhAnhQuaCong, taNguon } from '../src/lib/xuong-video/cong-ai';
import { uploadToR2 } from '../src/lib/r2';
import { GIU_VUNG_DAU } from '../src/lib/xuong-video/khung';

const PY = process.env.XV_SOI_MAT_PY || '/opt/xv-soi-mat/bin/python';
const KB = '/opt/earns-marketing-os-v2/apps/xuong-video/scripts/soi-mat/soi-mat.py';
function chay<T = unknown>(vao: unknown): Promise<T> {
  return new Promise((ok, hong) => {
    const p = execFile(PY, [KB], { maxBuffer: 16 << 20, timeout: 10 * 60_000 }, (e, out) => { if (e) return hong(e); try { ok(JSON.parse(out) as T); } catch (x) { hong(x); } });
    p.stdin?.end(JSON.stringify(vao));
  });
}
const A = process.argv.slice(2);
const arg = (k: string, d = '') => { const i = A.indexOf(`--${k}`); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
const FILE = arg('file'); const TEN = arg('ten'); const ANCHOR = arg('anchor'); const MAT = arg('mat', ANCHOR);
const NGUONG = Number(arg('nguong', '0.5')); const LAN = Number(arg('lan', '3'));
if (!FILE || !existsSync(FILE) || !TEN || !ANCHOR) { console.error('cần --file <đường dẫn có thật> --ten "<tên nhân vật>" --anchor <url anchor> [--mat <url mặt cắt>] [--nguong 0.5] [--lan 3]'); process.exit(1); }

type Ket = { ten: string; o?: unknown; giong?: number; dat?: boolean };
type RaSoi = { anh: { ket?: Ket[]; mat?: number; loi?: string }[] };
const mau = { [TEN]: [ANCHOR, MAT].filter((u, i, a) => u && a.indexOf(u) === i) };
async function soi(file: string): Promise<Ket | null> {
  const r = await chay<RaSoi>({ mau, anh: [{ id: 1, url: file, ten: [TEN] }] });
  return r.anh[0]?.ket?.find((k) => k.ten === TEN) ?? null;
}

const k0 = await soi(FILE);
if (!k0) { console.log(`✗ không thấy mặt ${TEN} trong ${FILE} — không sửa được`); process.exit(2); }
console.log(`trước: ${TEN} giống ${(Number(k0.giong) * 100).toFixed(0)}%  (ngưỡng ${(NGUONG * 100).toFixed(0)}%)`);
if (Number(k0.giong) >= NGUONG) { console.log('đã đạt, bỏ qua.'); process.exit(0); }

const prompt = `Image 1 is a close-up crop of a photorealistic film frame showing the person ${TEN}. Redraw ONLY the face so it is unmistakably the SAME person as in image 2 (same bone structure, eyes, nose, mouth, face shape). Image 2 shows ${TEN} for identity only — ignore its pose, gaze and expression; keep the pose, gaze and expression of image 1. Keep ${GIU_VUNG_DAU}`;
let tong = 0; let batNhat = Number(k0.giong); let okLan = 0;
for (let lan = 1; lan <= LAN; lan++) {
  // 1) cắt vùng đầu từ ẢNH GỐC (mỗi lần sửa từ bản đầu, không chồng lên bản hỏng)
  const cv = await chay<{ hop: number[] | null; b64: string | null }>({ op: 'cat_vung', url: FILE, o: k0.o });
  if (!cv.hop || !cv.b64) { console.log(`  lần ${lan}: ✗ không cắt được vùng đầu`); break; }
  const vungUrl = await uploadToR2(`xuong-video/sua-tay/vung-${randomUUID()}.jpg`, Buffer.from(cv.b64, 'base64'), 'image/jpeg');
  if (!vungUrl) { console.log(`  lần ${lan}: ✗ không đẩy vùng đầu lên kho`); break; }
  // 2) ckey vẽ lại CHỈ vùng mặt từ [vùng đầu, mặt anchor]
  const g = await sinhAnhQuaCong('nano-banana-2', { prompt, thamChieuUrl: [vungUrl, MAT], tiLe: '1:1' });
  tong += g.nguon?.vnd ?? 0;
  if (!g.anh) { console.log(`  lần ${lan}: ✗ sinh hỏng (${g.thu?.map((x) => x.loi).join(' | ') ?? '?'})`); continue; }
  // 3) dán lại vào khung gốc (mặt nạ mờ biên) — ghi ảnh sửa ra tạm để dan đọc được local path
  const tmpSua = `/tmp/sua-mat-${randomUUID()}.jpg`; writeFileSync(tmpSua, g.anh.data);
  const dg = await chay<{ b64: string | null }>({ op: 'dan', goc: FILE, sua: tmpSua, hop: cv.hop });
  if (!dg.b64) { console.log(`  lần ${lan}: ✗ dán lại hỏng`); continue; }
  const tmpGhep = `/tmp/ghep-${randomUUID()}.jpg`; writeFileSync(tmpGhep, Buffer.from(dg.b64, 'base64'));
  // 4) soi lại bản ghép
  const k1 = await soi(tmpGhep); const giong = Number(k1?.giong ?? 0);
  console.log(`  lần ${lan}: ${taNguon(g.nguon)} → ghép giống ${(giong * 100).toFixed(0)}%`);
  if (giong > batNhat) { batNhat = giong; writeFileSync(FILE, readFileSync(tmpGhep)); okLan = lan; }
  if (giong >= NGUONG) { console.log(`✓ ĐẠT lần ${lan}: ${TEN} ${(giong * 100).toFixed(0)}% ≥ ${(NGUONG * 100).toFixed(0)}% — đã ghi đè ${FILE}`); console.log(`tiền: ~${Math.round(tong)}₫`); process.exit(0); }
}
if (okLan) console.log(`△ chưa đạt ngưỡng nhưng tốt hơn (${(batNhat * 100).toFixed(0)}%), đã ghi bản tốt nhất (lần ${okLan}) vào ${FILE}`);
else console.log(`✗ ${LAN} lần đều không khá hơn (${(batNhat * 100).toFixed(0)}%) — giữ nguyên ${FILE}`);
console.log(`tiền: ~${Math.round(tong)}₫`);
process.exit(okLan ? 0 : 3);
