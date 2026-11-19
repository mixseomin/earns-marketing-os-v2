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

// ffmpeg chạy TRÊN box3 chung máy với các next-server (cty, etp2, studio, mos2): NI 0 + libx264 tự lấy mọi nhân thì một bản xuất 30 giây
// ăn 222% CPU / 1,1 GB RAM, gặp lúc deploy khởi động lại web → swap 7,8 MB/s, tải 14 trên 4 nhân (etp:qua-tai-ffmpeg-xuat 19/11/2026).
// Luật: ffmpeg chạy trong tiến trình web/script trên box3 đi qua ffmpegNhe → nice 10 (web luôn được ưu tiên); bản mã hoá nặng thêm TRAN_LUONG.
/** Số luồng tối đa cho một lệnh ffmpeg mã hoá trên máy chủ chung (2 nhân / 4). */
export const TRAN_LUONG = 2;
/** Mức nice của ffmpeg nền — thấp hơn web (0), cao hơn việc vứt được (soi-chu dùng 19). */
export const NICE_FFMPEG = 10;
/**
 * [lệnh, tham số] để gọi ffmpeg ở ưu tiên nền: `const [l, a] = ffmpegNhe(args); run(l, a, opts)`.
 * @param {string[]} args
 * @returns {[string, string[]]}
 */
export const ffmpegNhe = (args) => ['nice', ['-n', String(NICE_FFMPEG), 'ffmpeg', ...args]];

/** Đặt TRƯỚC `-i <video>` khi đầu vào là video H.264/HEVC: Mac giải mã bằng phần cứng (khung về bộ nhớ thường, filter vẫn chạy bình thường). */
export const giaiMaHw = () => (MAC ? ['-hwaccel', 'videotoolbox'] : []);
