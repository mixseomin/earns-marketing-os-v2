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
import { nenH264 } from './nen-video.mjs';
import { khungXuat } from './xuat';
import { dungFfmpeg } from './may-dung-cf';

const ex = promisify(execFile);
/** Tỉ lệ thời lượng từng khung theo số khung vẽ: đầu dài hơn giữa (người xem cần đọc khung mở), cuối giữ để thấy đuôi gieo cớ cắt. */
export const TI_KHUNG: Record<number, number[]> = { 1: [1], 2: [0.5, 0.5], 3: [0.35, 0.3, 0.35] };
/** tiLe = tỉ lệ khung của PHIM (kinh_thanh.ti_le) — trước 14/11/2026 cố định 1080×1920: phim 16:9 (#3071) bị cắt dọc rồi bộ dựng phóng lại, mất hai bên khung. */
export async function clipAnimatic(c: Canh, thuMuc: string, tiLe: string | null | undefined): Promise<string | null> {
  const { w, h } = khungXuat(tiLe);
  const ks = khungDoc(c).filter((k) => !!k.url); if (!ks.length) return null;
  const phat = giayPhat(c); const ti = TI_KHUNG[ks.length] ?? ks.map(() => 1 / ks.length);
  const vao = ks.flatMap((k, i) => ['-loop', '1', '-t', (phat * ti[i]!).toFixed(3), '-i', k.url!]);
  const loc = `${ks.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p[v${i}]`).join(';')};${ks.map((_, i) => `[v${i}]`).join('')}concat=n=${ks.length}:v=1:a=0[o]`;
  // CẤM MÃ HOÁ TRÊN BOX3 (anh 03/11/2026; 14/11/2026 animatic 20 shot mã hoá thẳng trên box3 → hết RAM, OOM giết ffmpeg + tiến trình phiên): đi máy dựng
  // Cloudflare, lỗi thì lùi về iMac (dungFfmpeg). Thư mục RIÊNG mỗi shot — máy dựng gửi kèm MỌI tệp trong thư mục, chung thư mục là gửi cả MP4 shot khác.
  const thu = join(thuMuc, `s-${c.id}`); await mkdir(thu, { recursive: true }); const ra = join(thu, `anim-${c.id}.mp4`);
  const args = ['-loglevel', 'error', '-y', ...vao, '-filter_complex', loc, '-map', '[o]', '-r', '30', ...nenH264({ preset: 'veryfast' }), ra];
  const d = await dungFfmpeg(args, { thuMuc: thu, fontsDir: '/khong-dung-font', ra, chayTaiCho: () => ex('ffmpeg', args, { timeout: 180_000 }) });
  console.log(`  animatic #${c.thu_tu}: dựng ở ${d.noi}${d.loiCf ? ` (cloudflare lỗi: ${d.loiCf})` : ''}`);
  return uploadToR2(`xuong-video/animatic/${c.id}-${randomUUID()}.mp4`, await readFile(ra), 'video/mp4');
}
