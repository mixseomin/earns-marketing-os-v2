#!/usr/bin/env node
// DỰNG PHIM CẮT GIẤY từ một tệp biên đạo (01/11/2026, anh: "thử 1 tập gag"). 0đ, chạy trên iMac (Chromium cục bộ, box cấm trình duyệt).
//   node phim-cat-giay.mjs --bd gag-1148.json --tai /Users/htuan/.cache/shot-code/gag-1148 --ra ra.mp4 [--khung 1.2,8,20 --khung-ra to.jpg] [--shot g1]
// --tai: thư mục tài nguyên (keyframe gốc kfN.jpg · lN/ của tach-lop.swift · vN/ vật nhấc theo vùng). Lớp 'lN/i' / 'vN/i' trong biên đạo được
// đổi thành ảnh + khung từ lop.json. Tiếng (nhạc gảy + tiếng động) tổng hợp bằng số học ngay đây, không tải gì, rồi ghép vào hình.
// --shot <id>: chỉ dựng một shot (soát nhanh).
// Biên đạo có nen_video (clip nền sống của video AI, trong thư mục --tai) → lớp vẽ trên nền TRONG rồi ghép lên clip đó, giữ tiếng của clip;
// RONG/CAO/fps theo clip. Đây là khuôn anime: vật đi xa là lớp riêng, không để video AI tự đoán đường đi.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const DIR = dirname(fileURLToPath(import.meta.url)), TAI = resolve(arg('tai')), RA = resolve(arg('ra', join(TAI, 'phim.mp4')));
const BD = JSON.parse(readFileSync(resolve(DIR, arg('bd')), 'utf8'));
if (arg('shot')) BD.shots = BD.shots.filter((s) => s.id === arg('shot'));
const url = (f) => pathToFileURL(join(TAI, f)).href;

// ---------- CAU cho trang ----------
const hop = {};
const khung = (ref) => { const [d, i] = ref.split('/'); hop[d] ||= JSON.parse(readFileSync(join(TAI, d, 'lop.json'), 'utf8')); const b = hop[d].find((x) => x.i === Number(i)); if (!b) throw new Error(`không có lớp ${ref}`); return { src: url(`${d}/lop-${i}.png`), x: b.x, y: b.y, w: b.w, h: b.h }; };
const shots = BD.shots.map((s) => ({
  ...s, nen: s.nen ? url(s.nen) : null, con_lai: s.con_lai ? url(s.con_lai) : null,
  lop: s.lop.map((l) => (l.src ? { ...l, ...khung(l.src) } : { ...l, cat: url(l.cat) })),
}));
const DAI = shots.reduce((a, s) => a + s.dai, 0);
const cauTep = join(TAI, 'cau.json');
writeFileSync(cauTep, JSON.stringify({ W: BD.W, H: BD.H, RONG: BD.RONG, CAO: BD.CAO, trong: !!BD.nen_video, mo_lop: BD.mo_lop, DAI, shots }));

// ---------- lớp ghép lên clip nền (khuôn anime) ----------
const RONG = String(BD.RONG || 1920), CAO = String(BD.CAO || 1080);
if (BD.nen_video) {
  const r = spawnSync(process.execPath, [join(DIR, 'dung.mjs'), '--trang', join(DIR, 'cat-giay.html'), '--cau', cauTep, '--rong', RONG, '--cao', CAO, '--fps', String(BD.fps || 24),
    '--nen-video', join(TAI, BD.nen_video), ...(arg('khung') ? ['--khung', arg('khung'), '--khung-ra', resolve(arg('khung-ra'))] : ['--ra', RA])], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
  console.log(`${RA} · ${DAI.toFixed(1)}s · ghép lớp lên ${BD.nen_video}`); process.exit(0);
}

// ---------- tiếng ----------
const SR = 48000, N = Math.ceil((DAI + 0.5) * SR), mix = new Float32Array(N);
let hat = 7; const rnd = () => ((hat = (hat * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const them = (t, buf, vol = 1) => { const o = Math.round(t * SR); for (let i = 0; i < buf.length && o + i < N; i++) if (o + i >= 0) mix[o + i] += buf[i] * vol; };
const tao = (dai, f) => { const b = new Float32Array(Math.round(dai * SR)); for (let i = 0; i < b.length; i++) b[i] = f(i / SR, i); return b; };
const thapQua = (b, a) => { let y = 0; for (let i = 0; i < b.length; i++) b[i] = y += a * (b[i] - y); return b; };
const gay = (f, dai) => {   // dây gảy Karplus-Strong (nghe như đàn tranh/đàn bầu gảy)
  const p = Math.max(2, Math.round(SR / f)), d = Array.from({ length: p }, () => rnd() * 0.5), b = new Float32Array(Math.round(dai * SR));
  for (let i = 0; i < b.length; i++) { const k = i % p, k2 = (i + 1) % p; b[i] = d[k]; d[k] = 0.5 * (d[k] + d[k2]) * 0.997; }
  return b;
};
const AM = {
  keng: () => tao(0.9, (t) => [1, 2.76, 5.4, 8.93].reduce((a, h, j) => a + Math.sin(2 * Math.PI * 1480 * h * t) * [1, 0.55, 0.35, 0.2][j] * Math.exp(-t * (5 + j * 3)), 0) * 0.5),
  coi: (xa) => { const b = tao(1.5, (t) => { const env = Math.min(1, t / 0.06) * Math.min(1, (1.5 - t) / 0.35), v = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t); let s = 0; for (const f of [311, 370]) for (let k = 1; k <= 6; k++) s += Math.sin(2 * Math.PI * f * k * v * t) / k; return s * env * 0.18; }); return xa ? thapQua(b, 0.08) : b; },
  tau: () => { const b = tao(2.2, (t) => rnd() * Math.min(1, t / 0.8) * Math.min(1, (2.2 - t) / 0.5)); thapQua(b, 0.015); const c = tao(2.2, (t) => { const p = (t % 0.34); return (p < 0.03 || (p > 0.09 && p < 0.12)) ? rnd() * Math.min(1, t / 0.8) : 0; }); thapQua(c, 0.12); return b.map((x, i) => x * 2.4 + c[i] * 0.5); },
  vut: () => { const b = tao(0.4, (t) => rnd() * Math.sin(Math.PI * t / 0.4)); const l = thapQua(Float32Array.from(b), 0.25); return b.map((x, i) => (x - l[i]) * 0.45); },
  bop: () => tao(0.22, (t) => Math.sin(2 * Math.PI * (160 - 100 * t / 0.22) * t) * Math.exp(-t * 18) * 0.9 + (t < 0.006 ? rnd() * 0.3 : 0)),
  boing: () => tao(0.55, (t) => Math.sin(2 * Math.PI * (280 + 220 * t) * t + 3 * Math.sin(2 * Math.PI * 16 * t)) * Math.exp(-t * 4) * 0.5),
  nhip: () => tao(0.14, (t) => (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1320 * t)) * Math.exp(-t * 38) * 0.6),
  cach: () => { const a = AM.nhip(), b = new Float32Array(a.length + 4000); b.set(a, 0); for (let i = 0; i < a.length; i++) b[i + 4000] += a[i] * 0.8; return b; },
  meo: () => tao(0.6, (t) => { const f = 620 + 220 * Math.sin(Math.PI * t / 0.6) + 12 * Math.sin(2 * Math.PI * 7 * t); const e = Math.sin(Math.PI * t / 0.6); return (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.sin(6 * Math.PI * f * t)) * e * 0.3; }),
  vo_tay: () => { const b = new Float32Array(Math.round(1.0 * SR)); for (let k = 0; k < 14; k++) { const o = Math.round(((k * 0.137 + 0.05 * Math.abs(rnd())) % 0.95) * SR); for (let i = 0; i < 1300 && o + i < b.length; i++) b[o + i] += rnd() * Math.exp(-i / 260) * 0.5; } const l = thapQua(Float32Array.from(b), 0.3); return b.map((x, i) => x - l[i] * 0.6); },
  ngay: () => thapQua(tao(1.4, (t) => rnd() * Math.max(0, Math.sin(Math.PI * (t % 0.7) / 0.7)) * 1.6), 0.03),
  gay: () => tao(0.3, (t) => (t < 0.05 ? rnd() : 0) * 0.9 + Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t * 20) * 0.6),
  chim: () => tao(0.5, (t) => { const k = Math.floor(t / 0.13), p = t - k * 0.13; return p < 0.07 && k < 3 ? Math.sin(2 * Math.PI * (2600 + 1600 * p / 0.07) * p) * Math.sin(Math.PI * p / 0.07) * 0.25 : 0; }),
  chuong: () => tao(2.2, (t) => (Math.sin(2 * Math.PI * 1568 * t) + 0.4 * Math.sin(2 * Math.PI * 2352 * t)) * Math.exp(-t * 2.2) * 0.3),
};
let bd = 0;
const kieu = [];
for (const s of BD.shots) {
  for (const [t, ten, vol] of s.am || []) { const f = AM[ten === 'coi_xa' ? 'coi' : ten]; if (f) them(bd + t, f(ten === 'coi_xa'), vol ?? 1); else console.warn(`tiếng lạ: ${ten}`); }
  kieu.push([bd, bd + s.dai, s.nhac || 'gag']);
  bd += s.dai;
}
// nhạc gảy: lưới phách chung cả tập, mỗi phách lấy kiểu của shot đang chiếu
const BEAT = 60 / (BD.nhac?.bpm || 112), G = [196, 220, 246.9, 293.7, 329.6, 392, 440, 493.9, 587.3, 659.3], E = [164.8, 196, 220, 246.9, 293.7, 329.6, 392, 440];
let bac = 4;
for (let n = 0; n * BEAT / 2 < DAI; n++) {
  const t = n * BEAT / 2, k = kieu.find((x) => t >= x[0] && t < x[1])?.[2] || 'gag';
  bac = Math.max(0, Math.min(9, bac + [-1, 1, 2, -2, 0, 1, -1][Math.abs(Math.round(rnd() * 6))]));
  if (k === 'gag') {
    if (n % 2 === 0 || n % 4 === 3) them(t, gay(G[bac], 0.6), 0.2);
    if (n % 4 === 0) them(t, gay([98, 146.8][(n / 4) % 2], 0.9), 0.32);
    them(t, thapQua(tao(0.05, () => rnd()), 0.6).map((x, i, a) => x - (a[i - 1] || 0)), n % 2 ? 0.05 : 0.08);
  } else if (k === 'mo') { if (n % 4 === 0) them(t, gay(G[Math.min(9, 3 + (n / 4) % 5)], 1.4), 0.2); }
  else if (k === 'dao') { if (n % 4 === 0) { them(t, gay(E[bac % 8], 2.0), 0.18); them(t, gay(E[0] / 2, 2.2), 0.22); } }
  else if (k === 'ket') { const tk = t - kieu.find((x) => x[2] === 'ket')[0]; if (n % 8 === 0 && tk < 4) them(t, gay(G[[5, 4, 3][Math.floor(tk / (4 * BEAT))] ?? 5], 2.5), 0.2); }
}
const nen = thapQua(tao(DAI + 0.5, () => rnd()), 0.02); for (let i = 0; i < N; i++) mix[i] += nen[i] * 0.09;
let dinh = 0; for (const x of mix) dinh = Math.max(dinh, Math.abs(x));
const wav = Buffer.alloc(44 + N * 2), g = 0.89 / (dinh || 1);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) wav.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(mix[i] * g * 32767))), 44 + i * 2);
const wavTep = join(TAI, 'tieng.wav'); writeFileSync(wavTep, wav);

// ---------- hình ----------
const dung = (them) => { const r = spawnSync(process.execPath, [join(DIR, 'dung.mjs'), '--trang', join(DIR, 'cat-giay.html'), '--cau', cauTep, '--rong', RONG, '--cao', CAO, ...them], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
if (arg('khung')) { dung(['--ra', '/dev/null', '--khung', arg('khung'), '--khung-ra', resolve(arg('khung-ra'))]); process.exit(0); }
const hinh = join(TAI, 'hinh.mp4');
dung(['--ra', hinh]);
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', hinh, '-i', wavTep, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(DAI), '-movflags', '+faststart', RA], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log(`${RA} · ${DAI.toFixed(1)}s · ${shots.length} shot`);
