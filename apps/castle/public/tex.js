// Bề mặt sinh bằng mã: vẽ lên canvas lúc chạy, không tải tệp ảnh nào.
// Mỗi hàm trả { map, bump?, emis? } — 512 px phủ `m` mét (main.js đặt UV theo mét thế giới).
import * as THREE from 'three';

export function rngTu(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const N = 512;
function bang() { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d')]; }
function hat(g, r, n, a) { // lấm tấm cho bớt phẳng
  const d = g.getImageData(0, 0, N, N), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const k = (r() - 0.5) * n; p[i] += k; p[i + 1] += k * a; p[i + 2] += k * a; }
  g.putImageData(d, 0, 0);
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

// Đá xây: hàng khối so le, mạch vữa sẫm. `tong` = sắc chủ đạo.
export function daXay(r, tong = 30, sang = 52) {
  const [c, g] = bang();
  g.fillStyle = '#2b2622'; g.fillRect(0, 0, N, N);
  const hang = 11; const cao = N / hang;
  for (let y = 0; y < hang; y++) {
    let x = -r() * 60;
    while (x < N) {
      const w = 48 + r() * 70;
      g.fillStyle = hsl(tong + (r() - 0.5) * 20, 4 + r() * 9, sang - 16 + r() * 24);
      const x0 = x + 2, w0 = Math.min(w, N - x) - 4;
      g.fillRect(x0, y * cao + 2, w0, cao - 4);
      if (x + w > N) { g.fillRect(x0 - N, y * cao + 2, w0 + 4, cao - 4); } // nối mép cho lặp liền
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x0, y * cao + 2, w0, 3);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0, y * cao + cao - 6, w0, 4);
      x += w;
    }
  }
  hat(g, r, 26, 1);
  return { map: tex(c), bump: tex(c, false) };
}

// Bazan đen nứt dưới chân đảo.
export function bazan(r) {
  const [c, g] = bang();
  g.fillStyle = '#231c19'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) { g.fillStyle = hsl(18, 10, 8 + r() * 16); const s = 6 + r() * 34; g.beginPath(); g.ellipse(r() * N, r() * N, s, s * (0.4 + r() * 0.6), r() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
  for (let i = 0; i < 40; i++) { g.beginPath(); let x = r() * N, y = r() * N; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 70; y += r() * 50; g.lineTo(x, y); } g.stroke(); }
  hat(g, r, 22, 1);
  return { map: tex(c), bump: tex(c, false) };
}

// Đá cuội lát đường.
export function cuoi(r) {
  const [c, g] = bang();
  g.fillStyle = '#3a3029'; g.fillRect(0, 0, N, N);
  const o = 26;
  for (let y = 0; y < N / o; y++) for (let x = 0; x < N / o; x++) {
    const cx = (x + 0.5 + (y % 2) * 0.5) * o + (r() - 0.5) * 6, cy = (y + 0.5) * o + (r() - 0.5) * 6;
    const rx = o * (0.38 + r() * 0.1), ry = o * (0.36 + r() * 0.1);
    for (const dx of [-N, 0, N]) {
      g.fillStyle = hsl(28 + (r() - 0.5) * 16, 8 + r() * 10, 38 + r() * 18);
      g.beginPath(); g.ellipse(cx + dx, cy, rx, ry, r() * 3, 0, 7); g.fill();
    }
  }
  hat(g, r, 22, 1);
  return { map: tex(c), bump: tex(c, false) };
}

// Ngói nung: hàng vảy chồng.
export function ngoi(r, tong = 10) {
  const [c, g] = bang();
  g.fillStyle = '#3b1a12'; g.fillRect(0, 0, N, N);
  const w = 32, h = 24;
  for (let y = N / h; y >= -1; y--) for (let x = -1; x <= N / w; x++) {
    const cx = x * w + (y % 2) * w / 2, cy = y * h;
    const gr = g.createLinearGradient(0, cy - h, 0, cy + 4);
    const l = 30 + r() * 16;
    gr.addColorStop(0, hsl(tong + (r() - 0.5) * 10, 50, l + 10)); gr.addColorStop(1, hsl(tong, 55, l - 12));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx, cy - h); g.lineTo(cx + w, cy - h); g.lineTo(cx + w, cy - 6); g.quadraticCurveTo(cx + w / 2, cy + 6, cx, cy - 6); g.closePath(); g.fill();
  }
  hat(g, r, 18, 0.7);
  return { map: tex(c), bump: tex(c, false) };
}

// Tường vữa khung gỗ + cửa sổ; `emis` = cửa sổ có đèn (bật ngẫu nhiên). 512 px = 6 m: mỗi tầng 3 m = 256 px, mỗi gian 1,5 m = 128 px.
export function vuaGo(r, tong = 38) {
  const [c, g] = bang(); const [ce, ge] = bang();
  g.fillStyle = hsl(tong, 30, 72); g.fillRect(0, 0, N, N);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, N, N);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,70,50,${r() * 0.08})`; g.beginPath(); g.arc(r() * N, r() * N, 4 + r() * 26, 0, 7); g.fill(); }
  const go = hsl(22, 35, 20);
  g.fillStyle = go;
  for (const y of [0, 248, 256 - 8, 504]) g.fillRect(0, y, N, 12);
  for (let x = 0; x < N; x += 128) g.fillRect(x, 0, 12, N);
  for (let t = 0; t < 2; t++) for (let x = 0; x < N; x += 128) {
    const y0 = t * 256;
    if (r() < 0.62) {
      const wx = x + 40, wy = y0 + 70, ww = 50, wh = 78;
      g.fillStyle = go; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      g.fillStyle = '#1d2630'; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = go; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh / 2 - 2, ww, 4);
      if (r() < 0.55) {
        const gr = ge.createRadialGradient(wx + ww / 2, wy + wh / 2, 4, wx + ww / 2, wy + wh / 2, 50);
        gr.addColorStop(0, '#ffd29a'); gr.addColorStop(1, '#c46a20');
        ge.fillStyle = gr; ge.fillRect(wx, wy, ww, wh);
        ge.fillStyle = '#000'; ge.fillRect(wx + ww / 2 - 2, wy, 4, wh); ge.fillRect(wx, wy + wh / 2 - 2, ww, 4);
      }
    } else { // giằng chéo
      g.strokeStyle = go; g.lineWidth = 10;
      g.beginPath(); g.moveTo(x + 10, y0 + 250); g.lineTo(x + 124, y0 + 12); g.stroke();
    }
  }
  hat(g, r, 16, 1);
  return { map: tex(c), bump: tex(c, false), emis: tex(ce) };
}

// Ván gỗ (thùng, cửa, cầu).
export function van(r, tong = 28) {
  const [c, g] = bang();
  for (let y = 0; y < N; y += 64) {
    g.fillStyle = hsl(tong + (r() - 0.5) * 8, 40, 26 + r() * 12); g.fillRect(0, y, N, 64);
    for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(30,15,5,${0.15 + r() * 0.2})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const yy = y + r() * 64; g.moveTo(0, yy); g.bezierCurveTo(N / 3, yy + (r() - 0.5) * 10, 2 * N / 3, yy + (r() - 0.5) * 10, N, yy); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, y, N, 3);
  }
  hat(g, r, 14, 0.8);
  return { map: tex(c), bump: tex(c, false) };
}

export function vai(r) { // cờ
  const [c, g] = bang();
  const s = hsl(r() * 360, 60, 38);
  g.fillStyle = s; g.fillRect(0, 0, N, N);
  g.fillStyle = hsl(45, 70, 62); g.fillRect(0, N * 0.42, N, N * 0.16);
  g.beginPath(); g.arc(N * 0.35, N * 0.5, N * 0.16, 0, 7); g.fill();
  hat(g, r, 12, 1);
  return { map: tex(c) };
}

export function cham() { // hạt lửa tròn mờ
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,150,50,.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function co(r) { // cỏ: nền xanh loang + nét lá ngắn
  const [c, g] = bang();
  g.fillStyle = hsl(92, 38, 30); g.fillRect(0, 0, N, N);
  for (let k = 0; k < 90; k++) { g.fillStyle = hsl(80 + r() * 30, 30 + r() * 20, 22 + r() * 16); g.globalAlpha = 0.25; g.beginPath(); g.arc(r() * N, r() * N, 20 + r() * 60, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  for (let k = 0; k < 5000; k++) { const x = r() * N, y = r() * N; g.strokeStyle = hsl(75 + r() * 40, 35 + r() * 25, 18 + r() * 30); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6); g.stroke(); }
  hat(g, r, 16, 0.9);
  return { map: tex(c), bump: tex(c, false) };
}
