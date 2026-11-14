// CANH GIỌNG THEO MIỆNG (anh 15/11/2026: "việc thay đổi này phải chuẩn hoá cho những clip khác về sau, không chắp vá"). Clip sinh KÈM giọng tham chiếu (Seedance
// @Audio1) có tiếng do chính model đọc lại — tiếng đó khớp miệng model vẽ, nhưng có thể TRỄ so với chỗ ta đặt câu (shot #4 phim #3071: miệng mở trễ ~0,8 s).
// Đo độ trễ bằng tương quan ĐƯỜNG ÂM LƯỢNG (100 điểm / giây) giữa từng câu giọng gốc và tiếng clip quanh chỗ đặt câu → dời điểm vào clip của shot đúng độ trễ:
// giọng gốc phát đúng lúc miệng mở. Thuần (nhận mảng âm lượng), tự kiểm: can-giong.test.mts. Script: thu-seedance-cum.mts (sau khi sinh / --chinh-giong).
export const DIEM_GIAY = 100;   // điểm âm lượng / giây

/** Đường âm lượng: trung bình |mẫu| mỗi 10 ms từ PCM 16-bit mono (tần số mẫu sr). */
export function duongAmLuong(pcm: Int16Array, sr: number): Float32Array {
  const buoc = Math.max(1, Math.round(sr / DIEM_GIAY)); const n = Math.floor(pcm.length / buoc); const o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = i * buoc; k < (i + 1) * buoc; k++) s += Math.abs(pcm[k]!); o[i] = s / buoc; }
  return o;
}

/** Độ trễ (giây) của đoạn `mau` (giọng gốc của MỘT câu) trong `clip` (tiếng clip), quanh vị trí kỳ vọng `t` (giây), tìm trong ±khoang giây.
 *  Tương quan chuẩn hoá (trừ trung bình, chia độ lệch chuẩn) — trả lệch có tương quan cao nhất. lech > 0 = clip nói TRỄ hơn chỗ đặt câu. */
export function doLech(clip: Float32Array, mau: Float32Array, t: number, khoang = 1.5): { lech: number; tq: number } {
  const n = mau.length; if (!n) return { lech: 0, tq: 0 };
  const tb = (a: Float32Array, i0: number) => { let s = 0; for (let k = 0; k < n; k++) s += a[i0 + k] ?? 0; return s / n; };
  const mM = tb(mau, 0); let sM = 0; for (let k = 0; k < n; k++) sM += (mau[k]! - mM) ** 2; sM = Math.sqrt(sM) || 1;
  const goc = Math.round(t * DIEM_GIAY); const r = Math.round(khoang * DIEM_GIAY); let tot = { lech: 0, tq: -2 };
  for (let d = -r; d <= r; d++) {
    const i0 = goc + d; if (i0 < 0 || i0 + n > clip.length) continue;
    const mC = tb(clip, i0); let sC = 0, c = 0; for (let k = 0; k < n; k++) { const x = clip[i0 + k]! - mC; sC += x * x; c += x * (mau[k]! - mM); }
    const tq = c / ((Math.sqrt(sC) || 1) * sM); if (tq > tot.tq) tot = { lech: d / DIEM_GIAY, tq };
  }
  return tot;
}

/** Điểm vào mới của shot sau khi canh: vao + trung bình độ trễ các câu (chỉ câu tương quan ≥ 0,3). Kẹp trong clip; kẹp lệch > 0,25 s hoặc không câu nào đo được → lỗi. */
export function vaoSauCanh(vao: number, lech: { lech: number; tq: number }[], daiClip: number, phat: number, duoi = 0.45): { vao: number; loi: string | null; lech: number } {
  const tot = lech.filter((x) => x.tq >= 0.3);
  if (!tot.length) return { vao, lech: 0, loi: `không đo được độ trễ giọng (tương quan tốt nhất ${Math.max(...lech.map((x) => x.tq), 0).toFixed(2)} < 0,3) — model không đọc lại giọng, miệng có thể không theo câu: sinh lại` };
  const l = tot.reduce((a, x) => a + x.lech, 0) / tot.length; const muon = vao + l; const kep = Math.max(0, Math.min(muon, daiClip - phat - duoi));
  return { vao: +kep.toFixed(2), lech: +l.toFixed(2), loi: Math.abs(kep - muon) > 0.25 ? `miệng lệch ${l.toFixed(2)} s so với câu, clip không đủ dài để bù (thiếu ${Math.abs(kep - muon).toFixed(2)} s) — sinh lại` : null };
}
