// TÁCH MẢNH từ tờ hình cắt nền xanh (scripts/to-hinh-cat.mts): tách nền xanh (khoá màu + gỡ viền xanh) → tìm vùng liền → mỗi vùng đủ lớn thành một PNG
// trong suốt, cắt sát mép. In bảng mảnh (số · khung trên tờ) để đặt tên trong cảnh. Không tốn tiền.
//   node tach.mjs <tờ.png> <thư mục ra> [--min=0.004]
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [vao, ra] = process.argv.slice(2);
const MIN = Number(process.argv.find((a) => a.startsWith('--min='))?.slice(6) ?? 0.004);
if (!vao || !ra) { console.error('node tach.mjs <tờ.png> <thư mục ra>'); process.exit(1); }
mkdirSync(ra, { recursive: true });

const anh = await loadImage(vao);
const W = anh.width, H = anh.height;
const c = createCanvas(W, H), x = c.getContext('2d');
x.drawImage(anh, 0, 0);
const d = x.getImageData(0, 0, W, H), p = d.data;

/** độ "xanh khoá" của một điểm: lục trội hẳn đỏ và lam */
export const xanh = (r, g, b) => g - Math.max(r, b);
const NGUONG = 60, MEM = 25;
for (let i = 0; i < p.length; i += 4) {
  const k = xanh(p[i], p[i + 1], p[i + 2]);
  if (k > NGUONG) p[i + 3] = 0;
  else if (k > MEM) { p[i + 3] = Math.round(255 * (NGUONG - k) / (NGUONG - MEM)); p[i + 1] = Math.max(p[i], p[i + 2]); }   // mép mềm + gỡ viền xanh
  else if (k > 0) p[i + 1] = Math.max(p[i], p[i + 2]);
}

// vùng liền (4 hướng) trên điểm còn đục
const nhan = new Int32Array(W * H).fill(-1); const vung = [];
for (let s = 0; s < W * H; s++) {
  if (nhan[s] >= 0 || p[s * 4 + 3] < 128) continue;
  const id = vung.length; const q = [s]; nhan[s] = id; let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  while (q.length) {
    const t = q.pop(); const tx = t % W, ty = (t / W) | 0; n++;
    if (tx < x0) x0 = tx; if (tx > x1) x1 = tx; if (ty < y0) y0 = ty; if (ty > y1) y1 = ty;
    for (const u of [t - 1, t + 1, t - W, t + W]) if (u >= 0 && u < W * H && nhan[u] < 0 && Math.abs((u % W) - tx) <= 1 && p[u * 4 + 3] >= 128) { nhan[u] = id; q.push(u); }
  }
  vung.push({ id, x0, y0, x1, y1, n });
}
const lon = vung.filter((v) => v.n >= W * H * MIN).sort((a, b) => a.x0 - b.x0);
x.putImageData(d, 0, 0);
const bang = [];
lon.forEach((v, i) => {
  const pad = 2, w = v.x1 - v.x0 + 1 + pad * 2, h = v.y1 - v.y0 + 1 + pad * 2;
  const m = createCanvas(w, h), mx = m.getContext('2d');
  // chỉ chép điểm thuộc đúng vùng này (vùng khác lọt trong khung chữ nhật thì bỏ)
  const src = x.getImageData(v.x0 - pad < 0 ? 0 : v.x0 - pad, v.y0 - pad < 0 ? 0 : v.y0 - pad, w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const gx = v.x0 - pad + xx, gy = v.y0 - pad + yy; const o = (yy * w + xx) * 4;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) { src.data[o + 3] = 0; continue; }
    const l = nhan[gy * W + gx];
    if (l >= 0 && l !== v.id) { src.data[o + 3] = 0; continue; }
    if (l < 0 && src.data[o + 3] > 0) {   // điểm mép mờ chưa gán vùng: giữ chỉ khi sát (≤ 2 điểm) vùng này — không mang vệt mép của mảnh bên cạnh
      let gan = false;
      for (let dy = -2; dy <= 2 && !gan; dy++) for (let dx = -2; dx <= 2; dx++) { const ux = gx + dx, uy = gy + dy; if (ux >= 0 && uy >= 0 && ux < W && uy < H && nhan[uy * W + ux] === v.id) { gan = true; break; } }
      if (!gan) src.data[o + 3] = 0;
    }
  }
  mx.putImageData(src, 0, 0);
  const ten = `manh-${i + 1}.png`;
  writeFileSync(join(ra, ten), m.toBuffer('image/png'));
  bang.push({ so: i + 1, ten, khung: [v.x0, v.y0, v.x1, v.y1], w, h, diem: v.n });
});
writeFileSync(join(ra, 'manh.json'), JSON.stringify({ to: vao, W, H, manh: bang }, null, 1));
for (const b of bang) console.log(`#${b.so} ${b.ten} khung ${b.khung.join(',')} · ${b.w}×${b.h}`);
