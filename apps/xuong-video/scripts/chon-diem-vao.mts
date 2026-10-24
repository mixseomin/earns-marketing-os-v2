// CHỌN ĐIỂM VÀO THEO CHUYỂN ĐỘNG (luat-dung.ts › cat_giua_dong_tac — ngành cắt GIỮA động tác: mắt người xem đang bám chuyển động thì không thấy cú cắt).
// Đường cắt nối bằng động tác (dan_dung.noi = 'dong_tac'): shot trước nên KẾT lúc đang chuyển động mạnh, shot sau MỞ lúc đang chuyển động. Đo độ chuyển
// động từng 0,1 s (lệch khung xám 24×42), tìm điểm vào trong vùng dùng được (bỏ 0,2 s đầu + đuôi clip AI DUOI_CLIP_BO) cho điểm cao nhất. 0đ.
// Mặc định chỉ IN gợi ý (điểm vào còn phải hợp nội dung — người lạ, đồ sai… nên chạy soat-huong.mts sau); --ghi để ghi ky_thuat.vao_s.
//   … tsx scripts/chon-diem-vao.mts <tap_id> [--ghi]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { giayPhat } from '../src/lib/xuong-video/kieu';
import { DUOI_CLIP_BO } from '../src/lib/xuong-video/xuat';

const ex = promisify(execFile);
const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const ghi = process.argv.includes('--ghi'); const db = getDb()!;
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
const FPS = 10, W = 24, H = 42;
/** độ chuyển động mỗi 1/FPS giây (0–255) */
async function chuyenDong(url: string): Promise<number[]> {
  const { stdout } = await ex('ffmpeg', ['-v', 'error', '-i', url, '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1 << 26, timeout: 120_000 }) as unknown as { stdout: Buffer };
  const n = Math.floor(stdout.length / (W * H)); const m: number[] = [0];
  for (let i = 1; i < n; i++) { let s = 0; for (let j = 0; j < W * H; j++) s += Math.abs(stdout[i * W * H + j]! - stdout[(i - 1) * W * H + j]!); m.push(s / (W * H)); }
  return m;
}
const tb = (m: number[], a: number, b: number) => { const x = m.slice(Math.max(0, Math.round(a * FPS)), Math.max(Math.round(a * FPS) + 1, Math.round(b * FPS))); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0; };
for (let i = 0; i < ds.length; i++) {
  const c = ds[i]!; const a = i > 0 && ds[i - 1]!.phan_doan === c.phan_doan ? ds[i - 1]! : null;
  const vaoNoi = a?.dan_dung?.noi === 'dong_tac', raNoi = c.dan_dung?.noi === 'dong_tac';
  if (!c.video_url || (!vaoNoi && !raNoi)) continue;
  const m = await chuyenDong(c.video_url).catch(() => null); if (!m) { console.log(`#${c.thu_tu}: không đo được clip`); continue; }
  const dai = m.length / FPS, phat = giayPhat(c); const hi = dai - DUOI_CLIP_BO - phat; if (hi < 0.2) continue;
  const diem = (v: number) => (vaoNoi ? tb(m, v, v + 0.3) : 0) + (raNoi ? tb(m, v + phat - 0.3, v + phat) : 0);
  let tot = 0.2; for (let v = 0.2; v <= hi + 1e-9; v += 0.1) if (diem(v) > diem(tot)) tot = Math.round(v * 10) / 10;
  const nay = Number(c.ky_thuat?.vao_s ?? 0.5); const dn = diem(Math.min(Math.max(nay, 0), hi)), dt = diem(tot);
  console.log(`#${c.thu_tu} ${vaoNoi ? 'mở giữa động tác' : ''}${vaoNoi && raNoi ? ' + ' : ''}${raNoi ? 'kết giữa động tác' : ''}: điểm vào hiện ${nay}s (chuyển động ${dn.toFixed(1)}) → gợi ý ${tot}s (${dt.toFixed(1)})${dt > dn * 1.3 ? '' : ' — giữ nguyên'}`);
  if (ghi && dt > dn * 1.3) await db.execute(sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('vao_s', ${tot}::numeric), updated_at = now() WHERE id = ${c.id}`);
}
process.exit(0);
