// ĐẨY TẬP ĐÃ DỰNG LÊN STUDIO (02/11/2026). Chạy trên box3 — lam-tap.mjs gọi sau khi dựng xong:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/tap-day.mts <tập.json> <video.mp4>
// MỖI KÊNH MỘT PHIM Studio ("Kênh lịch sử · <tên kênh>" theo kenh.json) để anh quản trong Studio; mỗi tập = một xv_tap (khoá ho_so.ma_tap = id tập):
// video R2 xuong-video/lich-su/tap/<id>.mp4, kịch bản (lời đọc từng câu + nguồn), thời lượng. Chạy lại = cập nhật đúng tập đó, không đẻ tập mới.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';

const [tepTap, mp4, ...tepKhung] = process.argv.slice(2);   // khung (jpg) tuỳ chọn → R2 xuong-video/lich-su/tap/<id>-khung-<i>.jpg, trả về khung[] cho máy đăng
if (!tepTap || !mp4) { console.error('tsx tap-day.mts <tập.json> <video.mp4> [khung.jpg…]'); process.exit(2); }
const tap = JSON.parse(readFileSync(tepTap, 'utf8'));
const kenhId = tap.kenh ?? 'saga', K = JSON.parse(readFileSync(new URL('./kenh.json', import.meta.url), 'utf8'))[kenhId];
const db = getDb()!, q = async <T,>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
const PHIM = `Kênh lịch sử · ${K.ten}`;
let phim = (await q<{ id: number }>(sql`SELECT id FROM xv_phim WHERE ten = ${PHIM} LIMIT 1`))[0]?.id;
if (!phim) phim = (await q<{ id: number }>(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai) VALUES ('studio', ${PHIM}, 'short',
  ${`Các tập kênh "${kenhId}" dựng bằng code (bản đồ + nhân vật kho chung). Khuôn: ${K.do_dai}; giọng đọc ${K.giong}; theme ${K.theme}. Máy: apps/xuong-video/scripts/lich-su/lam-tap.mjs --kenh ${kenhId}; hồ sơ kênh: kenh.json`},
  ${JSON.stringify({ chat_lieu: 've_2d', the_loai: 'tai_lieu', ti_le: '9:16', kenh: kenhId, theme: K.theme })}::jsonb, 'nhap') RETURNING id`))[0]!.id;
const giay = Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' })));
const url = await uploadToR2(`xuong-video/lich-su/tap/${tap.id}.mp4`, readFileSync(mp4), 'video/mp4');
if (!url) { console.error('✗ tải R2 hỏng'); process.exit(1); }
const kichBan = tap.cau.map((c: { chu: string; su_that?: unknown[] }, i: number) => `${i + 1}. ${c.chu}${c.su_that?.length ? '' : '  [câu đùa]'}`).join('\n') + `\n\nNguồn:\n${(tap.nguon || []).join('\n')}`;
const hoSo = { ma_tap: tap.id, kenh: kenhId, ngon_ngu: tap.ngon_ngu, chu_de: tap.chu_de, tep: `apps/xuong-video/scripts/lich-su/tap/${tap.id}.json` };
const co = (await q<{ id: number }>(sql`SELECT id FROM xv_tap WHERE phim_id = ${phim} AND ho_so->>'ma_tap' = ${tap.id} LIMIT 1`))[0]?.id;
let tapId = co;
if (co) await db.execute(sql`UPDATE xv_tap SET ten = ${tap.tieu_de}, kich_ban = ${kichBan}, tom_tat = ${tap.chu_de ?? tap.tieu_de}, video_url = ${url}, thoi_luong_s = ${giay}, ho_so = ${JSON.stringify(hoSo)}::jsonb, trang_thai = 'nhap', updated_at = now() WHERE id = ${co}`);
else { const so = (await q<{ n: number }>(sql`SELECT COALESCE(MAX(so), 0) + 1 AS n FROM xv_tap WHERE phim_id = ${phim}`))[0]!.n;
  tapId = (await q<{ id: number }>(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, trang_thai, video_url, thoi_luong_s, ho_so) VALUES (${phim}, ${so}, ${tap.tieu_de}, ${kichBan}, ${tap.chu_de ?? tap.tieu_de}, 'nhap', ${url}, ${giay}, ${JSON.stringify(hoSo)}::jsonb) RETURNING id`))[0]!.id; }
const khung: string[] = [];
for (const [i, f] of tepKhung.entries()) { const u = await uploadToR2(`xuong-video/lich-su/tap/${tap.id}-khung-${i}.jpg`, readFileSync(f), 'image/jpeg'); if (u) khung.push(u); }
console.log(JSON.stringify({ phim, tap: tapId, url, giay, khung }));
process.exit(0);
