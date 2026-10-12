// Khớp điểm cắt vào PHÁCH nhạc nền (12/10/2026) — phim nhịp nhanh cắt trúng phách thì "đã tai"; cắt lệch 0,2s là thấy cụt.
//   doPhach(pcm)          = dò nhịp: đường năng lượng khởi âm (onset) → tự tương quan tìm BPM 70–180 → chọn pha khớp nhất → lưới phách.
//   khopNhip(phat, phach) = dời từng điểm cắt tới phách gần nhất trong [cắt − 0,1s ; cắt + 0,35s] — ưu tiên dời VỀ SAU vì giây phát đã
//                           khít theo giọng đọc (rút ngắn là cụt câu). Shot sau giữ giây phát, chỉ dời theo.
//   doiLopTheoCat(...)    = lớp phủ (chữ, impact…) dời theo shot chứa nó, để vẫn đứng đúng khoảnh khắc sau khi cắt dời.
// Thuần — server action khopNhipNhac giải mã nhạc bằng ffmpeg rồi gọi. Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhip-nhac.test.mts
import type { Lop } from './kieu';

export const SR_PHACH = 11025;
const HOP = 256;   // 23 ms mỗi ô

export function doPhach(pcm: Float32Array, sr = SR_PHACH): { bpm: number; phach: number[] } | null {
  const n = Math.floor(pcm.length / HOP); if (n < 64) return null;
  const nl = new Float64Array(n);
  for (let i = 0; i < n; i++) { let e = 0; for (let j = 0; j < HOP; j++) { const v = pcm[i * HOP + j]!; e += v * v; } nl[i] = Math.log(1e-9 + e); }
  const on = new Float64Array(n);
  for (let i = 1; i < n; i++) on[i] = Math.max(0, nl[i]! - nl[i - 1]!);
  const tb = on.reduce((a, b) => a + b, 0) / n; for (let i = 0; i < n; i++) on[i] = Math.max(0, on[i]! - tb);
  const oGiay = HOP / sr;
  const diem = (lag: number) => { let s = 0; for (let i = 0; i + lag < n; i++) { const j = i + lag; const a = Math.floor(j), f = j - a; s += on[i]! * ((1 - f) * on[a]! + f * (on[a + 1] ?? 0)); } return s / (n - lag); };
  // Dò thô 0,5 BPM rồi dò tinh 0,02 BPM quanh chỗ tốt nhất — sai 0,5 BPM là phách trôi ~50 ms sau 10 giây.
  let bpmTot = 0, tot = 0;   // eslint-disable-line prefer-const
  for (let bpm = 70; bpm <= 180; bpm += 0.5) { const s = diem(60 / bpm / oGiay); if (s > tot) { tot = s; bpmTot = bpm; } }
  if (!bpmTot || tot <= 0) return null;
  for (let bpm = bpmTot - 0.5; bpm <= bpmTot + 0.5; bpm += 0.02) { const s = diem(60 / bpm / oGiay); if (s > tot) { tot = s; bpmTot = bpm; } }
  const lagTot = 60 / bpmTot / oGiay;
  let pha = 0, phaTot = -1;
  for (let p = 0; p < lagTot; p += 0.25) { let s = 0; for (let j = p; j < n; j += lagTot) s += on[Math.round(j)] ?? 0; if (s > phaTot) { phaTot = s; pha = p; } }
  // Lưới đều kéo về đỉnh khởi âm gần nhất (±2 ô = ±46 ms), rồi hồi quy thẳng qua các đỉnh thật để sửa chu kỳ (tự tương quan theo ô 23 ms
  // lệch ~1 BPM — sau 10 giây là trôi cả phách), làm lại hai vòng.
  const kepDinh = (g: number) => { let k = Math.max(0, Math.min(n - 1, Math.round(g))); const g0 = k; for (let x = Math.max(0, g0 - 2); x <= Math.min(n - 1, g0 + 2); x++) if (on[x]! > on[k]!) k = x; return k; };
  let goc = pha, ck = lagTot, dinh: number[] = [];
  for (let vong = 0; vong < 3; vong++) {
    dinh = []; const xs: number[] = [], ys: number[] = [];
    for (let i = 0; goc + i * ck < n; i++) { const k = kepDinh(goc + i * ck); dinh.push(k); if (on[k]! > 0) { xs.push(i); ys.push(k); } }
    if (xs.length < 4) break;
    const mx = xs.reduce((q, v) => q + v, 0) / xs.length, my = ys.reduce((q, v) => q + v, 0) / ys.length;
    const sxy = xs.reduce((q, v, i) => q + (v - mx) * (ys[i]! - my), 0), sxx = xs.reduce((q, v) => q + (v - mx) ** 2, 0);
    if (sxx <= 0) break; ck = sxy / sxx; goc = my - ck * mx;
  }
  const phach = dinh.map((k) => Math.round(k * oGiay * 1000) / 1000);
  bpmTot = 60 / (ck * oGiay);
  return { bpm: Math.round(bpmTot * 10) / 10, phach };
}
/** Lưới phách lặp tới hết phim (nhạc trong bản xuất cũng aloop): kéo dài theo chu kỳ từ phách cuối. */
export function luoiPhach(phach: number[], bpm: number, toi: number, tu = 0): number[] {
  const ck = 60 / bpm; const out = phach.map((p) => p + tu);
  for (let p = (out[out.length - 1] ?? tu) + ck; p <= toi; p += ck) out.push(Math.round(p * 1000) / 1000);
  return out.filter((p) => p <= toi);
}
/** Trả giây phát mới (bước 0,05s) và số điểm cắt đã khớp. Điểm cuối phim không dời. */
export function khopNhip(phat: number[], phach: number[], lui = 0.1, toi = 0.35): { phat: number[]; khop: number } {
  const moi: number[] = []; let t = 0, tGoc = 0, khop = 0;
  phat.forEach((p, i) => {
    tGoc += p;
    if (i === phat.length - 1) { moi.push(Math.round((tGoc - t) * 100) / 100); return; }
    const cat = t + p;
    const b = phach.filter((x) => x >= cat - lui && x <= cat + toi).reduce<number | undefined>((tot, x) => (tot == null || Math.abs(x - cat) < Math.abs(tot - cat) - 1e-9 ? x : tot), undefined);
    const p2 = b != null ? Math.max(0.5, Math.round((b - t) * 20) / 20) : p;
    if (b != null) khop++;
    moi.push(p2); t += p2;
  });
  return { phat: moi, khop };
}
/** batDauCu / batDauMoi = giây bắt đầu từng shot trước / sau khi dời; lớp nằm trong shot i dời đúng bằng shot i dời. */
export function doiLopTheoCat(lop: Lop[], batDauCu: number[], batDauMoi: number[]): Lop[] {
  return lop.map((l) => {
    let i = batDauCu.length - 1; while (i > 0 && l.tu + 1e-6 < batDauCu[i]! - 0.05) i--;
    const d = (batDauMoi[i] ?? 0) - (batDauCu[i] ?? 0);
    return Math.abs(d) < 1e-6 ? l : { ...l, tu: Math.round((l.tu + d) * 1000) / 1000, den: Math.round((l.den + d) * 1000) / 1000 };
  });
}
