// CÚ CẮT CỨNG ĐO TRÊN CLIP CỤM (ffmpeg scene) — một nguồn cho sinh-cum.mts (Veo / Vidu) và thu-seedance-cum.mts (Seedance qua Kie). Chỉ ĐỌC clip (giải mã
// tìm khung đổi cảnh), không mã hoá — được chạy trên box3. Tách khỏi sinh-cum.mts 14/11/2026.
import { execFileSync } from 'node:child_process';
import { VAO_DAU, BO_DUOI } from './cum-shot';
/** Cú cắt cứng trong clip: thử ngưỡng scene từ chặt tới lỏng, lấy lần ra đúng n−1 cú (bỏ cú dính đầu / đuôi, gộp cú sát nhau). */
export function catThat(f: string, n: number, d: number): number[] {
  let tot: number[] = [];
  for (const nguong of [0.3, 0.22, 0.4, 0.15, 0.5]) {
    // showinfo ghi ra stderr — gộp vào stdout để đọc
    let out = ''; try { out = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i '${f}' -vf "select='gt(scene,${nguong})',showinfo" -f null - 2>&1`], { encoding: 'utf8', timeout: 120_000 }); } catch { /* clip hỏng → không có cú cắt, theo lịch prompt */ }
    const t = [...out.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((x) => x > VAO_DAU + 0.3 && x < d - BO_DUOI - 0.2)
      .reduce<number[]>((a, x) => (a.length && x - a.at(-1)! < 0.4 ? a : [...a, x]), []);
    if (t.length === n - 1) return t;
    if (!tot.length || Math.abs(t.length - (n - 1)) < Math.abs(tot.length - (n - 1))) tot = t;
  }
  return tot;
}
