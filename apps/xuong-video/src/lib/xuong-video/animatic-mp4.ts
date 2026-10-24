// ANIMATIC CÓ TIẾNG (luat-dung.ts › animatic_duyet_nhip — ngành dựng storyboard có thời lượng + tiếng để duyệt nhịp TRƯỚC khi tiêu tiền quay).
// Mỗi shot thành một clip ảnh tĩnh: khung đầu → giữa → cuối (khung-doc.ts, đúng thứ tự storyboard) chia theo giây phát; tải lên kho rồi đi qua CHÍNH bộ
// dựng phim (xuat-chay.ts: giọng, SFX lệch cắt, nhạc, phụ đề) — duyệt nhịp, đáp lời, cớ cắt bằng mắt + tai khi chưa tốn đồng video nào. 0đ.
import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { khungDoc } from './khung-doc';
import { giayPhat, type Canh } from './kieu';
import { uploadToR2 } from '../r2';

const ex = promisify(execFile);
/** Tỉ lệ thời lượng từng khung theo số khung vẽ: đầu dài hơn giữa (người xem cần đọc khung mở), cuối giữ để thấy đuôi gieo cớ cắt. */
export const TI_KHUNG: Record<number, number[]> = { 1: [1], 2: [0.5, 0.5], 3: [0.35, 0.3, 0.35] };
export async function clipAnimatic(c: Canh, thuMuc: string, w = 1080, h = 1920): Promise<string | null> {
  const ks = khungDoc(c).filter((k) => !!k.url); if (!ks.length) return null;
  const phat = giayPhat(c); const ti = TI_KHUNG[ks.length] ?? ks.map(() => 1 / ks.length);
  const vao = ks.flatMap((k, i) => ['-loop', '1', '-t', (phat * ti[i]!).toFixed(3), '-i', k.url!]);
  const loc = `${ks.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p[v${i}]`).join(';')};${ks.map((_, i) => `[v${i}]`).join('')}concat=n=${ks.length}:v=1:a=0[o]`;
  await mkdir(thuMuc, { recursive: true }); const ra = join(thuMuc, `anim-${c.id}.mp4`);
  await ex('ffmpeg', ['-loglevel', 'error', '-y', ...vao, '-filter_complex', loc, '-map', '[o]', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', ra], { timeout: 180_000 });
  return uploadToR2(`xuong-video/animatic/${c.id}-${randomUUID()}.mp4`, await readFile(ra), 'video/mp4');
}
