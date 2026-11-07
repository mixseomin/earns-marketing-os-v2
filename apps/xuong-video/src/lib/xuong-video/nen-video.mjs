// BỘ NÉN H.264 THEO MÁY — một chỗ cho mọi lệnh ffmpeg của studio (anh 07/11/2026: "phải áp dụng mặc định cho mọi việc có thể dùng đến nó").
// Mac (iMac M4 / MacBook): VideoToolbox — chip mã hoá riêng, không ăn CPU, không bị ưu tiên nền (taskpolicy -b) bóp như libx264.
// Linux (box3, máy dựng Cloudflare): libx264 như cũ. Bản Python cùng luật: scripts/nen_video.py — đổi mức ở đây thì đổi cả bên đó.
// Đo 07/11/2026, 30 giây phim giấy 1080p ở ưu tiên nền: libx264 crf20 veryfast 85 s · VideoToolbox 40 s · VideoToolbox + giải mã phần cứng 18 s.
// Cùng nội dung: libx264 crf 20 SSIM 0,961 ≈ VideoToolbox q 68 SSIM 0,962 (tệp lớn hơn ~2 lần — đổi lấy tốc độ) → q = 100 − 1,6 × crf.
const MAC = process.platform === 'darwin';

/** Mức chất lượng VideoToolbox tương đương một crf libx264. */
export const qTuCrf = (crf) => String(Math.max(30, Math.min(90, Math.round(100 - 1.6 * Number(crf)))));

/**
 * Tham số mã hoá H.264 cho `-c:v`, gồm luôn `-pix_fmt yuv420p`.
 * @param {{ crf?: number|string, preset?: string, threads?: number|string, bit?: string, maxrate?: string, bufsize?: string }} [o]
 *   crf: chất lượng kiểu libx264 (mặc định 20) · bit: ép bitrate cố định (Mac dùng -b:v, Linux vẫn crf) · preset/threads: chỉ libx264
 * @returns {string[]}
 */
export function nenH264(o = {}) {
  const crf = String(o.crf ?? 20);
  if (MAC) return ['-c:v', 'h264_videotoolbox', ...(o.bit ? ['-b:v', o.bit] : ['-q:v', qTuCrf(crf)]), ...(o.maxrate ? ['-maxrate', o.maxrate, '-bufsize', o.bufsize ?? o.maxrate] : []), '-pix_fmt', 'yuv420p', '-allow_sw', '1'];
  return ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', o.preset ?? 'medium', ...(o.threads ? ['-threads', String(o.threads)] : []), ...(o.maxrate ? ['-maxrate', o.maxrate, '-bufsize', o.bufsize ?? o.maxrate] : [])];
}

/** Đặt TRƯỚC `-i <video>` khi đầu vào là video H.264/HEVC: Mac giải mã bằng phần cứng (khung về bộ nhớ thường, filter vẫn chạy bình thường). */
export const giaiMaHw = () => (MAC ? ['-hwaccel', 'videotoolbox'] : []);
