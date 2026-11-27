// Tiếng cho video mô phỏng vật lý — tổng hợp WAV từ sự kiện của bản ghi (không dùng mẫu âm, không tốn tiền).
// tra-repo-ok: bộ tổng hợp nhỏ dán keo cho bản ghi mo-phong.mjs, không có thư viện nào đọc đúng khuôn sự kiện này.
//   node tieng.mjs --cau ghi.json --ra tieng.wav
// Lớp tiếng:
//   v (bóng chạm vòng)  → nốt marimba ngũ cung, cao độ theo nước, to nhỏ theo lực chạm, giãn ≥ 45 ms
//   b (bóng chạm bóng)  → tiếng gõ gỗ nhỏ, giãn ≥ 30 ms
//   loai                → "pốp" + trượt xuống + tiếng thịch
//   thang               → kèn chiến thắng (rải hợp âm rồi ngân)
//   nhịp nền            → tiếng trống trầm, nhanh dần khi còn ít nước (căng dần về cuối)
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SR = 44100;

export function tongHop(g) {
  const DAI = g.DAI, N = Math.ceil(DAI * SR) + SR;
  const L = new Float32Array(N), Rr = new Float32Array(N);
  const tong = g.suKien.filter((e) => e.k === 'loai').length + 1;
  const dau = g.dauGiay ?? 3;

  const cong = (t, buf, pan = 0) => {
    const s0 = Math.floor(t * SR);
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let k = 0; k < buf.length; k++) { const j = s0 + k; if (j < 0 || j >= N) continue; L[j] += buf[k] * gl; Rr[j] += buf[k] * gr; }
  };
  const marimba = (f, vol, dai = 0.35) => {
    const n = Math.floor(dai * SR), b = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      b[k] = vol * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9) + 0.35 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 30))
        * Math.min(1, t * 2000);
    }
    return b;
  };
  let hat = 12345;
  const ngau = () => { hat = (hat * 1103515245 + 12345) & 0x7fffffff; return hat / 0x7fffffff * 2 - 1; };
  const go = (vol) => {
    const n = Math.floor(0.03 * SR), b = new Float32Array(n);
    let lp = 0;
    for (let k = 0; k < n; k++) { const t = k / SR; lp += (ngau() - lp) * 0.35; b[k] = vol * (lp * 0.6 + 0.4 * Math.sin(2 * Math.PI * 1800 * t)) * Math.exp(-t * 160); }
    return b;
  };
  const pop = () => {
    const n = Math.floor(0.5 * SR), b = new Float32Array(n);
    let ph = 0, ph2 = 0;
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      ph += 2 * Math.PI * (700 * Math.exp(-t * 7) + 120) / SR;
      ph2 += 2 * Math.PI * (110 * Math.exp(-t * 12) + 45) / SR;
      b[k] = 0.45 * Math.sin(ph) * Math.exp(-t * 6) + 0.6 * Math.sin(ph2) * Math.exp(-t * 14) + 0.15 * ngau() * Math.exp(-t * 60);
    }
    return b;
  };
  const kick = (vol) => {
    const n = Math.floor(0.25 * SR), b = new Float32Array(n);
    let ph = 0;
    for (let k = 0; k < n; k++) { const t = k / SR; ph += 2 * Math.PI * (40 + 90 * Math.exp(-t * 30)) / SR; b[k] = vol * Math.sin(ph) * Math.exp(-t * 14); }
    return b;
  };
  const kenNot = (f, vol, dai) => {
    const n = Math.floor(dai * SR), b = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const t = k / SR, env = Math.min(1, t * 60) * Math.exp(-t * 1.2);
      let s = 0; for (let h = 1; h <= 6; h += 1) s += Math.sin(2 * Math.PI * f * h * t * (1 + 0.002 * Math.sin(t * 30))) / (h * h * 0.8);
      b[k] = vol * env * s;
    }
    return b;
  };

  // ngũ cung C: C D E G A trên 3 quãng tám
  const NGU = []; for (const o of [0, 1, 2]) for (const s of [0, 2, 4, 7, 9]) NGU.push(261.63 * Math.pow(2, (s + 12 * o) / 12));
  const x0 = 540;
  const loaiT = g.suKien.filter((e) => e.k === 'loai').map((e) => e.t).sort((a, b) => a - b);
  const conLaiLuc = (t) => tong - loaiT.filter((x) => x <= t).length;
  // ít bóng = ít tiếng chạm, nên mỗi tiếng to dần về cuối (0,6 → 1,6)
  const hsCuoi = (t) => 0.6 + (1 - (conLaiLuc(t) - 1) / Math.max(1, tong - 1));

  let sauV = -1, sauB = -1;
  for (const e of g.suKien) {
    if (e.t >= DAI) continue;
    const viTri = g.khung[Math.min(g.khung.length - 1, Math.round(e.t * 30))]?.p?.[e.i];
    const pan = viTri ? Math.max(-0.7, Math.min(0.7, (viTri[0] - x0) / 440)) : 0;
    if (e.k === 'v') {
      if (e.t - sauV < 0.045) continue; sauV = e.t;
      const vol = Math.min(1, (e.l ?? 4) / 9) * 0.32 * hsCuoi(e.t);
      cong(e.t, marimba(NGU[(e.i * 7) % NGU.length], vol), pan);
    } else if (e.k === 'b') {
      if (e.t < dau || e.t - sauB < 0.03) continue; sauB = e.t;
      cong(e.t, go(Math.min(1, (e.l ?? 3) / 10) * 0.18), pan);
    } else if (e.k === 'loai') {
      cong(e.t, pop().map((x) => x * 0.5), pan * 0.5);
    } else if (e.k === 'thang') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => cong(e.t + k * 0.14, kenNot(f, 0.16, 2.8 - k * 0.14)));
      [261.63, 329.63, 392].forEach((f) => cong(e.t + 0.6, kenNot(f, 0.12, 3.5)));
    }
  }

  // nhịp nền: BPM 84 → 140 khi số nước còn lại giảm; dừng khi có người thắng
  const loai = loaiT;
  const tThang = g.suKien.find((e) => e.k === 'thang')?.t ?? DAI;
  for (let t = dau, nhip = 0; t < tThang; nhip++) {
    const conLai = tong - loai.filter((x) => x <= t).length;
    const bpm = 84 + 56 * (1 - (conLai - 1) / Math.max(1, tong - 1));
    cong(t, kick(nhip % 4 === 0 ? 0.3 : 0.18));
    t += 60 / bpm;
  }
  // chung kết (còn 2): nền ngân trầm quãng năm, phồng dần tới lúc có người thắng
  const tHai = loaiT[tong - 3];
  if (tHai != null && tThang > tHai) {
    const n = Math.floor((tThang - tHai) * SR), b = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const t = k / SR, env = Math.min(1, t / 2) * (0.5 + 0.5 * t / (n / SR)) * Math.min(1, (n / SR - t) / 0.3);
      b[k] = 0.07 * env * (Math.sin(2 * Math.PI * 65.41 * t) + 0.7 * Math.sin(2 * Math.PI * 98 * t) + 0.3 * Math.sin(2 * Math.PI * 130.81 * t * (1 + 0.003 * Math.sin(t * 2))));
    }
    cong(tHai, b);
  }
  // mở cổng sau đoạn giới thiệu
  [783.99, 1046.5].forEach((f, k) => cong(dau + k * 0.1, marimba(f, 0.3, 0.6)));

  // chuẩn hoá + giới hạn mềm
  let dinh = 0; for (let k = 0; k < N; k++) dinh = Math.max(dinh, Math.abs(L[k]), Math.abs(Rr[k]));
  const he = dinh > 0 ? 1.4 / dinh : 1;
  const out = Buffer.alloc(44 + N * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
  for (let k = 0; k < N; k++) {
    out.writeInt16LE(Math.round(Math.tanh(L[k] * he) * 0.9 * 32767), 44 + k * 4);
    out.writeInt16LE(Math.round(Math.tanh(Rr[k] * he) * 0.9 * 32767), 46 + k * 4);
  }
  return out;
}

if (process.argv[1]?.endsWith('tieng.mjs')) {
  const g = JSON.parse(readFileSync(arg('cau'), 'utf8'));
  writeFileSync(arg('ra'), tongHop(g));
  console.log(arg('ra'));
}
