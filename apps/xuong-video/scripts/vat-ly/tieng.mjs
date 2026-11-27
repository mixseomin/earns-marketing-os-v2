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

  if (g.kieu === 'tran') return tiengTran(g, { N, L, Rr, cong, ngau, kick, kenNot, ghi: () => ghiWav(N, L, Rr) });

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

  return ghiWav(N, L, Rr);
}

// Trận bóng: tiếng sút (q), bóng đập tường (v), lưới rung (l), va người (b), còi (coi), bàn thắng = khán đài gầm + kèn; nền = tiếng đám đông.
function tiengTran(g, { N, cong, ngau, kick, kenNot, ghi }) {
  const DAI = g.DAI, x0 = g.luat.cx ?? 960;
  const nhieu = (dai, loc, env) => { const n = Math.floor(dai * SR), b = new Float32Array(n); let lp = 0; for (let k = 0; k < n; k++) { lp += (ngau() - lp) * loc; b[k] = lp * env(k / SR); } return b; };
  const sut = (vol) => { const n = Math.floor(0.12 * SR), b = new Float32Array(n); let ph = 0, lp = 0; for (let k = 0; k < n; k++) { const t = k / SR; ph += 2 * Math.PI * (70 + 160 * Math.exp(-t * 60)) / SR; lp += (ngau() - lp) * 0.5; b[k] = vol * (0.8 * Math.sin(ph) * Math.exp(-t * 35) + 0.5 * lp * Math.exp(-t * 90)); } return b; };
  const coi = (dai, vol) => { const n = Math.floor(dai * SR), b = new Float32Array(n); for (let k = 0; k < n; k++) { const t = k / SR, f = 2900 + 180 * Math.sin(2 * Math.PI * 28 * t); b[k] = vol * Math.sin(2 * Math.PI * f * t) * (0.6 + 0.4 * Math.sign(Math.sin(2 * Math.PI * 28 * t))) * Math.min(1, t * 80) * Math.min(1, (dai - t) * 30); } return b; };
  // cột kim loại: vài hoạ âm không điều hoà tắt dần; vút: nhiễu lọc quét lên xuống (chuyển cảnh phát lại)
  const coiTo = (dai) => { const n = Math.floor(dai * SR), b = new Float32Array(n); for (let k = 0; k < n; k++) { const t = k / SR; b[k] = 0.22 * Math.exp(-t * 6) * (Math.sin(2 * Math.PI * 1180 * t) + 0.6 * Math.sin(2 * Math.PI * 2950 * t) + 0.4 * Math.sin(2 * Math.PI * 4410 * t)); } return b; };
  const vut = (dai) => { const n = Math.floor(dai * SR), b = new Float32Array(n); let lp = 0; for (let k = 0; k < n; k++) { const t = k / SR, u = t / dai; lp += (ngau() - lp) * (0.05 + 0.5 * Math.sin(Math.PI * u)); b[k] = 0.3 * lp * Math.sin(Math.PI * u); } return b; };
  let sauQ = -1, sauV = -1, sauB = -1;
  for (const e of g.suKien) {
    if (e.t >= DAI) continue;
    const p = g.khung[Math.min(g.khung.length - 1, Math.round(e.t * 30))]?.p?.[e.i ?? g.bi ?? 10];
    const pan = p ? Math.max(-0.7, Math.min(0.7, (p[0] - x0) / 440)) : 0;
    if (e.k === 'q') { if (e.t - sauQ < 0.05) continue; sauQ = e.t; cong(e.t, sut(Math.min(1, (e.l ?? 4) / 8) * 0.35), pan); }
    else if (e.k === 'v') { if (e.t - sauV < 0.06) continue; sauV = e.t; cong(e.t, nhieu(0.18, 0.15, (t) => Math.min(1, (e.l ?? 4) / 9) * 0.35 * Math.exp(-t * 25)), pan); }
    else if (e.k === 'l') cong(e.t, nhieu(0.5, 0.6, (t) => 0.25 * Math.exp(-t * 7)), pan);
    else if (e.k === 'b') { if (e.t - sauB < 0.08) continue; sauB = e.t; cong(e.t, nhieu(0.05, 0.3, (t) => 0.12 * Math.exp(-t * 120)), pan); }
    else if (e.k === 'coi') {
      if (e.loai === 'kt') { cong(e.t, coi(0.35, 0.12)); cong(e.t + 0.45, coi(0.35, 0.12)); cong(e.t + 0.9, coi(1.1, 0.12)); }
      else if (e.loai === 'hiep') { cong(e.t, coi(0.35, 0.12)); cong(e.t + 0.45, coi(0.9, 0.12)); }
      else if (e.loai === 'loi') { cong(e.t, coi(0.22, 0.14)); cong(e.t + 0.28, coi(0.5, 0.13)); }   // thổi phạt: hai tiếng gắt
      else cong(e.t, coi(0.75, 0.11));   // giao bóng / cho đá: một tiếng dài
    }
    else if (e.k === 'the') cong(e.t + 0.2, nhieu(1.8, 0.05, (t) => 0.32 * Math.min(1, t / 0.25) * Math.exp(-t * 1.6)));   // khán đài la ó (dải trầm)
    else if (e.k === 'tim') { for (let k = 0; k * 0.45 < e.dai + 1.1; k++) { const t0 = e.t - 1.1 + k * 0.45; cong(t0, kick(0.32)); cong(t0 + 0.13, kick(0.2)); } }   // nhịp tim trước quả phạt đền
    else if (e.k === 'cot') { cong(e.t, coiTo(0.9)); cong(e.t + 0.12, nhieu(1.6, 0.18, (t) => 0.4 * Math.min(1, t / 0.2) * Math.exp(-t * 1.8)), pan * 0.4); }   // cột kêu keng + "ồ"
    else if (e.k === 'cuu') cong(e.t + 0.05, nhieu(1.4, 0.2, (t) => (e.loai === 'pen' ? 0.5 : 0.3) * Math.min(1, t / 0.15) * Math.exp(-t * 2)), pan * 0.4);
    else if (e.k === 'truot') cong(e.t + 0.05, nhieu(1.6, 0.06, (t) => 0.38 * Math.min(1, t / 0.2) * Math.exp(-t * 1.5)));
    else if (e.k === 'sut') cong(e.t, nhieu(0.9, 0.12, (t) => 0.14 * Math.min(1, t / 0.3) * Math.exp(-t * 2.5)), pan * 0.4);   // khán đài nín thở / ồ lên theo cú sút
    else if (e.k === 'replay') { cong(e.t, vut(0.5)); cong(e.t + e.dai - 0.35, vut(0.5)); }
    else if (e.k === 'ban') {
      // khán đài gầm: tiếng ồn dải giữa phồng lên 0,3 s rồi tắt dần trong 3 s, kèm hai nốt kèn
      cong(e.t, nhieu(3.4, 0.25, (t) => 0.55 * Math.min(1, t / 0.3) * Math.exp(-Math.max(0, t - 0.4) * 0.9)), pan * 0.4);
      [392, 523.25, 659.25].forEach((f, k) => cong(e.t + 0.1 + k * 0.12, kenNot(f, 0.1, 1.6)));
    }
  }
  // nền khán đài: tiếng rì rầm suốt trận, to hơn ở 15 phút cuối
  const tKt = g.ketThuc?.t ?? DAI, nen = nhieu(DAI, 0.08, (t) => { const m = Math.max(0, Math.min(1, (t - g.dauGiay) / 1)); const cuoi = t > tKt - 15 && t < tKt ? 1 + 0.6 * (1 - (tKt - t) / 15) : 1; return 0.07 * m * cuoi * (t > tKt ? Math.max(0.5, 1.6 - (t - tKt) * 0.2) * 1.8 : 1); });
  cong(0, nen);
  if (g.ketThuc?.thang >= 0) [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => cong(tKt + 1 + k * 0.14, kenNot(f, 0.14, 2.8 - k * 0.14)));
  return ghi();
}

function ghiWav(N, L, Rr) {
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
