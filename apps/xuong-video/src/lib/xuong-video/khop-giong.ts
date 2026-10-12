// Giây phát theo GIỌNG (12/10/2026 — trước đây làm tay: lời dẫn dài hơn shot thì giọng đè nhau/bị tăng tốc, phim #7). Thuần:
//   canPhat(c, dai)   = giây phát tối thiểu để đọc hết các dòng của shot (nối tiếp, cách 0,15s, tôn trọng tre) ở tốc ≤ TOC_DOC, cộng đệm 0,2s.
//   coGianMoc(chu, k) = co giãn mốc "@giây" của chữ màn theo tỉ lệ giây phát mới/cũ, để chữ vẫn đổi đúng nhịp câu đọc.
// Phần máy chủ (đo độ dài file giọng, ghi DB, dời lớp phủ) ở hau-ky.ts. Tự kiểm: khop-giong.test.mts
import type { Canh, NhanVat } from './kieu';
import { dongThoai } from './am-thanh';

/** Tốc đọc tối đa chấp nhận (bản xuất cũng cho lời dẫn nhanh tới mức này trước khi đè câu). */
export const TOC_DOC = 1.1;
export function canPhat(c: Pick<Canh, 'thoai' | 'loi_thoai' | 'nhan_vat' | 'thoai_url'>, nv: NhanVat[], dai: (url: string) => number | null): number | null {
  let t = 0, co = false;
  for (const d of dongThoai(c, nv)) {
    if (!d.url) continue; const g = dai(d.url); if (g == null) return null;
    t = Math.max(t + (co ? 0.15 : 0), d.tre ?? 0) + g / TOC_DOC; co = true;
  }
  return co ? Math.ceil((t + 0.2) * 10) / 10 : null;
}
/** Bộ lọc ffmpeg gọn giọng: cắt lặng đầu + cuối (dưới -40 dB), rút mọi quãng ngắt > 0,3s về 0,25s — giọng TTS kiểu trailer để
 *  0,3–0,9s lặng đầu file và 0,4–0,6s giữa câu (đo phim #9: ~10s chết trong 67s). */
export const LOC_GON_GIONG = 'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.04,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-40dB:stop_silence=0.25,areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.08,areverse';
export const coGianMoc = (chu: string, k: number): string =>
  Math.abs(k - 1) < 1e-6 ? chu : chu.replace(/^(\s*)@(\d+(?:[.,]\d+)?)s?(\s)/gm, (_, a: string, g: string, b: string) => `${a}@${Math.round(Number(g.replace(',', '.')) * k * 10) / 10}${b}`);
