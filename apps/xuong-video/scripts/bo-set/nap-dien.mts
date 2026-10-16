// NẠP BẢN DIỄN BLENDER của một shot (anh 16/10/2026: "thêm khung chuyển động vật lý cho chúng để đồng bộ"). dung-set.py XV_DIEN=1 render cả clip
// (f####.png, 12 khung/giây) → lệnh này đẩy lên kho: clip mp4 + 5 khung khoá (đầu · ¼ · ½ · ¾ · cuối) rồi gán khung đầu làm keyframe, khung cuối
// làm keyframe_ket, ba khung giữa vào khung_xam.giua (video nhiều khung — Pikaframes — nhận đủ 5). Ghi job 0đ, chụp hoàn tác như keyframe-tu-3d. 0đ.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nap-dien.mts --canh=<id> --thu-muc=<dir>
//   <dir> chứa f0001.png … + dien.mp4 (ghep-dien.sh <dir>: ghép + hậu kỳ ống kính). Clip vào làm video của shot (video_url).
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';
import { taoJob } from '../../src/lib/xuong-video/doc-db';
import { chupTruoc } from '../../src/lib/xuong-video/hoan-tac';
import type { KhungXam } from '../../src/lib/xuong-video/kieu';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const canh = Number(gia('canh')); const dir = gia('thu-muc');
if (!canh || !dir) { console.log('cần --canh=<id> --thu-muc=<dir>'); process.exit(1); }
// Dạng gọn (dien-tap.sh gửi từ máy render — đường lên máy chủ chậm): khoa-0..4.jpg đã cắt sẵn + so-khung.txt; không cần cả trăm PNG.
const tep = await readdir(dir);
const gon = tep.includes('khoa-0.jpg') && tep.includes('so-khung.txt');
const khung = gon ? Array.from({ length: Number((await readFile(path.join(dir, 'so-khung.txt'), 'utf8')).trim()) }, (_, i) => `f${String(i + 1).padStart(4, '0')}.png`) : tep.filter((f) => /^f\d{4}\.png$/.test(f)).sort();
if (khung.length < 2) { console.log('thư mục không có khung f####.png (hoặc khoa-*.jpg + so-khung.txt)'); process.exit(1); }
const db = getDb()!;
const r = (await db.execute(sql`SELECT thu_tu, khung_xam FROM xv_canh WHERE id = ${canh}`)) as unknown as { thu_tu: number; khung_xam: KhungXam | null }[];
if (!r[0]?.khung_xam) { console.log('shot chưa có khung_xam (render bộ set trước)'); process.exit(1); }
const ma = Date.now().toString(36);
// 5 khung khoá cùng công thức dung-set.py › dien_shot (in 'KHOA i f'): f = 1 + round(t·(N−1)).
const chon = [0, 0.25, 0.5, 0.75, 1].map((t) => khung[Math.round(t * (khung.length - 1))]!);
const url: string[] = [];
for (const [i, f] of chon.entries()) {
  // JPEG như ve_mau: nhẹ cho mô hình video.
  const ra = path.join(dir, `khoa-${i}.jpg`);
  if (!gon) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, f), '-q:v', '3', ra]);
  const u = await uploadToR2(`xuong-video/khung-xam/${canh}-${ma}-dien-${i}.jpg`, await readFile(ra), 'image/jpeg');
  if (!u) { console.log('không đẩy được ảnh lên kho'); process.exit(1); }
  url.push(u);
}
const clip = await uploadToR2(`xuong-video/khung-xam/${canh}-${ma}-dien.mp4`, await readFile(path.join(dir, 'dien.mp4')), 'video/mp4');
const kx: KhungXam = { ...r[0].khung_xam, mau: url[0]!, mau_ket: url[4]!, giua: url.slice(1, 4), ...(clip ? { dien: clip } : {}) };
await chupTruoc(db, { bang: 'xv_canh', id: canh, cot: ['keyframe_url', 'keyframe_uv', 'keyframe_ket', 'khung_xam', 'trang_thai', 'video_url', 'video_phien_ban', 'nguon_video'], moTa: 'keyframe + video = bản diễn Blender', nguoi: 'script nap-dien' });
await taoJob(db, { nhan: `Keyframe · bản diễn Blender (${khung.length} khung) · cảnh #${r[0].thu_tu}`, canh_id: canh, loai: 'anh', provider: 'blender', model: 'blender:cycles', request: { dich: 'dien_3d', khoa: url, clip }, xong: true });
await db.execute(sql`UPDATE xv_job SET output_url = ${url[0]!}, chi_phi_cents = 0 WHERE id = (SELECT max(id) FROM xv_job WHERE canh_id = ${canh} AND model = 'blender:cycles')`);
await db.execute(sql`UPDATE xv_canh SET khung_xam = ${JSON.stringify(kx)}::jsonb, keyframe_url = ${url[0]!}, keyframe_ket = ${url[4]!},
  keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([url[0]])}::jsonb THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([url[0]])}::jsonb END,
  trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi', 'duyet', 'xong') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${canh}`);
// CLIP DIỄN = VIDEO CỦA SHOT (anh 16/10/2026: "làm sao tao xem được cái mày vừa làm"): phim làm bằng Blender thì clip render chính là video —
// vào đúng video_url + danh sách phiên bản như clip AI, nên lưới / timeline / trình phát / bản xuất hiện ngay, không cần đường hiển thị riêng. 0đ.
if (clip) {
  const job = (await db.execute(sql`SELECT max(id) AS id FROM xv_job WHERE canh_id = ${canh} AND model = 'blender:cycles'`)) as unknown as { id: number }[];
  const pb = JSON.stringify([{ url: clip, ban: 'nhap', model: 'blender:cycles', job: Number(job[0]?.id ?? 0), luc: new Date().toISOString() }]);
  const nguon = { model: 'blender:cycles', prompt: '', khung_dau: url[0], khung_cuoi: url[4], giay: khung.length / 12, job: Number(job[0]?.id ?? 0) };
  await db.execute(sql`UPDATE xv_canh SET video_url = ${clip}, video_phien_ban = video_phien_ban || ${pb}::jsonb, nguon_video = ${JSON.stringify(nguon)}::jsonb,
    trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${canh}`);
}
console.log(JSON.stringify({ ok: true, canh, khoa: url, clip }));
process.exit(0);
