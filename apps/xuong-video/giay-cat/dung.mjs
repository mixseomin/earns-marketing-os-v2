// BỘ DỰNG HOẠT HÌNH GIẤY CẮT (anh 02/11/2026, theo các phim Opus vẽ bằng code trong thư viện — "Hedgehog in the Fog", "Paper Cutout Short Film"):
// nền là MỘT ảnh đứng yên; mỗi nhân vật / vật là một mảnh PNG riêng (tach.mjs) chuyển động theo timeline của cảnh — đúng kịch bản từng mốc giây, không
// mô hình video nào vẽ lại khung. Chân người đi do code vẽ: bàn chân chạm đất đứng YÊN tới khi nhấc, mức chân là mặt đất của nền.
// Xuất: vẽ từng khung bằng @napi-rs/canvas (không trình duyệt) → ffmpeg → MP4.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { nenH264 } from '../src/lib/xuong-video/nen-video.mjs';

export const W = 1280, H = 720, FPS = 24;
export const kep = (v, a, b) => Math.max(a, Math.min(b, v));
/** tiến độ 0..1 của t trong [a, b] */
export const doan = (t, a, b) => kep((t - a) / (b - a), 0, 1);
export const em = (u) => u * u * (3 - 2 * u);            // êm hai đầu
export const roi = (u) => u * u;                         // rơi (trọng lực)
export const lerp = (a, b, u) => a + (b - a) * u;
export const tai = (p) => loadImage(p);

/** Vẽ một mảnh: (x, y) = điểm neo trên khung; neo [ax, ay] tính theo tỉ lệ mảnh (0..1); xoay độ; lật ngang; bóng giấy mềm như lớp giấy chồng. */
export function manh(ctx, img, { x, y, co = 1, coX = 1, coY = 1, xoay = 0, neo = [0.5, 1], lat = false, bong = true, mo = 1 }) {
  const w = img.width * co, h = img.height * co;
  ctx.save();
  ctx.globalAlpha = mo;
  ctx.translate(x, y); ctx.rotate((xoay * Math.PI) / 180); ctx.scale((lat ? -1 : 1) * coX, coY);
  if (bong) { ctx.shadowColor = 'rgba(40,25,10,0.28)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4; }
  ctx.drawImage(img, -neo[0] * w, -neo[1] * h, w, h);
  ctx.restore();
}

/** Bóng đổ dưới chân (elip mềm trên mặt đất). */
export function bongDat(ctx, x, y, rong, dam = 0.22) {
  ctx.save(); const g = ctx.createRadialGradient(x, y, 0, x, y, rong);
  g.addColorStop(0, `rgba(30,20,10,${dam})`); g.addColorStop(1, 'rgba(30,20,10,0)');
  ctx.fillStyle = g; ctx.scale(1, 0.28); ctx.beginPath(); ctx.arc(x, y / 0.28, rong, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/** DÁNG ĐI chân bám đất: hông đi tới hx; mỗi chân một nhịp lệch nửa chu kỳ. Pha đứng: bàn chân cố định tại điểm đặt (không trượt); pha bước: nhấc
 *  cong lên rồi đặt xuống trước hông nửa sải. Chiều cao hông tự hạ / nâng theo chân đang đứng (nhún tự nhiên). Trả hông + hai bàn chân. */
export function diBo(hx, { mat, sai, dai }) {
  const ban = [0, 1].map((i) => {
    const c = hx / (2 * sai) + i * 0.5, f = c - Math.floor(c);
    const dat = hx - f * 2 * sai + sai / 2;                                   // điểm đặt chân của chu kỳ này (cố định suốt pha đứng)
    if (f < 0.5) return { x: dat, y: mat, dung: true };
    const u = (f - 0.5) / 0.5;                                               // pha bước: từ điểm đặt cũ tới điểm đặt kế (+ 2 nửa sải)
    return { x: dat + u * 2 * sai, y: mat - Math.sin(Math.PI * u) * sai * 0.22, dung: false };
  });
  const dungs = ban.filter((b) => b.dung);
  const hy = Math.min(...(dungs.length ? dungs : ban).map((b) => mat - Math.sqrt(Math.max(0, dai * dai - (b.x - hx) ** 2))));
  return { hy, ban };
}

/** Vẽ hai ống quần rộng + dép từ hông tới bàn chân (chân sau vẽ trước). */
export function veChan(ctx, hx, hy, ban, { mauQuan = '#1d1b1e', mauDep = '#7a5232', rong = 22 }) {
  const ds = [...ban].sort((a, b) => (a.dung === b.dung ? 0 : a.dung ? 1 : -1));
  for (const b of ds) {
    const dx = b.x - hx, dy = b.y - hy, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.28)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    ctx.fillStyle = mauQuan; ctx.beginPath();
    ctx.moveTo(hx + nx * rong * 0.6, hy + ny * rong * 0.6); ctx.lineTo(b.x + nx * rong * 0.45, b.y - 10 + ny * rong * 0.45);
    ctx.lineTo(b.x - nx * rong * 0.45, b.y - 10 - ny * rong * 0.45); ctx.lineTo(hx - nx * rong * 0.6, hy - ny * rong * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9c9a3'; ctx.beginPath(); ctx.ellipse(b.x + 4, b.y - 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill();   // mu bàn chân
    ctx.fillStyle = mauDep; ctx.beginPath(); ctx.ellipse(b.x + 5, b.y - 1, 15, 4, 0, 0, Math.PI * 2); ctx.fill();   // dép
    ctx.restore();
  }
}

/** Xuất cảnh: ve(ctx, t) vẽ một khung tại giây t. → MP4 (H.264, 24 khung/giây). */
export async function xuat(ve, giay, ra) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', ...nenH264({ crf: 18 }), ra], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(giay * FPS);
  for (let i = 0; i < n; i++) {
    ctx.clearRect(0, 0, W, H); ve(ctx, i / FPS);
    const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (code) => (code ? j(new Error(`ffmpeg ${code}`)) : r())));
  return ra;
}

/** Xuất ẢNH MỐC (PNG) tại các giây cho trước — khung đầu / cuối của từng đoạn khi vẽ lại bằng mô hình khung đầu → cuối (VideoExpress first_last_frame). */
export async function xuatKhung(ve, ts, thuMuc) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(thuMuc, { recursive: true });
  const c = createCanvas(W, H), ctx = c.getContext('2d'); const ra = [];
  for (const t of ts) { ctx.clearRect(0, 0, W, H); ve(ctx, t); const p = `${thuMuc}/moc-${String(t).replace('.', '_')}.png`; writeFileSync(p, c.toBuffer('image/png')); ra.push(p); }
  return ra;
}
/** Chạy một cảnh: `node canh/x.mjs [ra.mp4]` xuất video · `--moc=0,1.62,2.6,5.5` xuất ảnh mốc vào ra/<tên>-moc/. */
export async function chay(ve, giay, ten) {
  const moc = process.argv.find((a) => a.startsWith('--moc='));
  const goc = new URL('./ra/', import.meta.url).pathname;
  if (moc) return console.log((await xuatKhung(ve, moc.slice(6).split(',').map(Number), `${goc}${ten}-moc`)).join('\n'));
  const { mkdirSync } = await import('node:fs'); mkdirSync(goc, { recursive: true });
  console.log(await xuat(ve, giay, process.argv.find((a, i) => i > 1 && a.endsWith('.mp4')) ?? `${goc}${ten}.mp4`));
}

/** Xuất MỘT LỚP trong suốt (.mov, PNG có kênh alpha) — vẽ đè lên video người bằng ffmpeg overlay (vật chạy quỹ đạo: tàu, xe, ghế bay). */
export async function xuatLop(ve, giay, ra) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'png', '-pix_fmt', 'rgba', ra], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0, n = Math.round(giay * FPS); i < n; i++) {
    ctx.clearRect(0, 0, W, H); ve(ctx, i / FPS);
    const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (code) => (code ? j(new Error(`ffmpeg ${code}`)) : r())));
  return ra;
}
