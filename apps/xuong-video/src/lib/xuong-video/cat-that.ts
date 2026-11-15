// CÚ CẮT CỨNG ĐO TRÊN CLIP CỤM (ffmpeg scene) — một nguồn cho sinh-cum.mts (Veo / Vidu) và thu-seedance-cum.mts (Seedance qua Kie). Chỉ ĐỌC clip (giải mã
// tìm khung đổi cảnh), không mã hoá — được chạy trên box3. Tách khỏi sinh-cum.mts 14/11/2026.
import { execFileSync } from 'node:child_process';
import { VAO_DAU, BO_DUOI } from './cum-shot';
/** MỌI cú cắt cứng THẬT trong clip ở một ngưỡng cố định (bỏ cú dính đầu / đuôi, gộp cú sát nhau < 0,4 s). KHÔNG ép theo số cú mong đợi: trước 16/11/2026 hàm dò
 *  ngưỡng tới khi ra đúng n − 1 cú — clip cụm #11–15 phim #3071 (job 8371) có 5 cú thật, ngưỡng 0,3 bỏ cú yếu nhất (1,21 s, bánh xe → cận chú) để "khớp" 4,
 *  các shot sau gắn lệch nội dung. Số cú không khớp thì vaoTuCatThat quyết: cắt thừa ở đuôi → cứu shot đạt, lệch giữa cụm → không đo (không gắn). */
export const NGUONG_CAT = 0.15;   // scene ffmpeg: cú cắt thật yếu nhất đo được ở ca trên ~0,17 (scdet 12,4)
export function catThat(f: string, d: number): number[] {
  let out = ''; try { out = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i '${f}' -vf "select='gt(scene,${NGUONG_CAT})',showinfo" -f null - 2>&1`], { encoding: 'utf8', timeout: 120_000 }); } catch { /* ffmpeg lỗi → không cú nào: vaoTuCatThat báo không đo */ }
  return [...out.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((x) => x > VAO_DAU + 0.3 && x < d - BO_DUOI - 0.2)
    .reduce<number[]>((a, x) => (a.length && x - a.at(-1)! < 0.4 ? a : [...a, x]), []);
}
