// ĐƯA MỘT BẢN KỂ CHUYỆN VÀO THƯ VIỆN etp (0đ — R2 + một dòng etp.thu_vien). Bước cuối của máy sinh (may-sinh-ke-chuyen.mjs) sau vx-ke-chuyen --cta.
// Nạp MP4 + ảnh bìa (khung giây 1) lên kho R2 kho/ethopex/thu-vien/, ghi dòng theo tap_id (chạy lại = cập nhật, không tạo trùng).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/thu-vien-them.mts <tap_id> <tệp.mp4> [--trang-thai=san_sang] [--chi-vnd=N] [--ghi="…"]
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tapId = Number(process.argv[2]); const tep = process.argv[3]!;
if (!tapId || !tep) { console.error('cần <tap_id> <tệp.mp4>'); process.exit(1); }
const db = getDb()!;
const p = ((await db.execute(sql`SELECT p.ten, p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as { ten: string; kinh_thanh: { ngon_ngu?: string; qc?: { ten?: string; link?: string }; ethopex?: { content_id?: number } } }[])[0];
const content = p?.kinh_thanh.ethopex?.content_id;
if (!p || !content) { console.error(`tập ${tapId}: không thấy phim Ethopex (kinh_thanh.ethopex.content_id)`); process.exit(1); }
const giay = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(tep)}`, { encoding: 'utf8' }).trim());
const anhTep = `${tep}.bia.jpg`;
execSync(`ffmpeg -v error -y -ss 1 -i ${JSON.stringify(tep)} -frames:v 1 -vf scale=540:-1 ${JSON.stringify(anhTep)}`);
const ma = `${content}-${tapId}-${randomUUID().slice(0, 8)}`;
const video = await uploadToR2(`kho/ethopex/thu-vien/${ma}.mp4`, readFileSync(tep), 'video/mp4');
const anh = await uploadToR2(`kho/ethopex/thu-vien/${ma}.jpg`, readFileSync(anhTep), 'image/jpeg');
if (!video || !anh) { console.error('✗ nạp R2 hỏng'); process.exit(1); }
const ten = String(p.kinh_thanh.qc?.ten ?? '').split(' — ')[0]!.trim() || p.ten.split(' · ')[1] || p.ten;
const lang = p.kinh_thanh.ngon_ngu === 'es' ? 'es' : 'en';
const chuQc = { headline: ten, mo_ta: lang === 'es' ? 'Episodios completos gratis' : 'Watch Full Episodes!', link: p.kinh_thanh.qc?.link ?? null };
const tt = gia('trang-thai') ?? 'san_sang';
const co = (await db.execute(sql`SELECT id FROM etp.thu_vien WHERE tap_id = ${tapId} LIMIT 1`)) as unknown as { id: number }[];
if (co.length) await db.execute(sql`UPDATE etp.thu_vien SET video = ${video}, anh = ${anh}, giay = ${giay}, ten = ${ten}, lang = ${lang}, chu_qc = ${JSON.stringify(chuQc)}::jsonb,
  trang_thai = ${tt}, chi_vnd = coalesce(${gia('chi-vnd') ? Number(gia('chi-vnd')) : null}, chi_vnd), ghi = coalesce(${gia('ghi') ?? null}, ghi), cap_nhat = now() WHERE id = ${co[0]!.id}`);
else await db.execute(sql`INSERT INTO etp.thu_vien (content_id, dang, lang, ten, video, anh, giay, nguon, tap_id, chu_qc, trang_thai, chi_vnd, ghi)
  VALUES (${content}, 'ke_chuyen_vx', ${lang}, ${ten}, ${video}, ${anh}, ${giay}, 'videoexpress', ${tapId}, ${JSON.stringify(chuQc)}::jsonb, ${tt}, ${Number(gia('chi-vnd') ?? 0)}, ${gia('ghi') ?? null})`);
console.log(`✓ thư viện: ${ten} (${lang}, ${giay.toFixed(1)}s, ${tt}) → ${video}`);
process.exit(0);
