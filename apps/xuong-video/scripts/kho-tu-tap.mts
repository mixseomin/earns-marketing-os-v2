// Đưa tài sản ĐẠT của một tập vào kho (0đ — chỉ ghi dữ liệu): keyframe + clip đang dùng của mọi shot, khuôn QC của cả tập,
// kiểu chữ của phim làm preset thương hiệu. Chạy trên box3 khi anh đã duyệt tập đó là đạt:
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kho-tu-tap.mts --tap=6 [--khong-khuon]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { luuShotVaoKho, luuKhuonQc, luuKieuChuThuongHieu } from '../src/lib/xuong-video/kho';

const tapId = Number((process.argv.find((a) => a.startsWith('--tap=')) ?? '').split('=')[1] || 0);
if (!tapId) { console.error('thiếu --tap=<id>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const ds = (await db.execute(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number }[];
let so = 0;
for (const c of ds) { const r = await luuShotVaoKho(db, Number(c.id)); if (r.ok) so += r.data; else console.log(`  shot #${c.thu_tu}: ${r.loi}`); }
console.log(`  ${so} tệp (keyframe + clip) từ ${ds.length} shot → kho`);
if (!process.argv.includes('--khong-khuon')) { const k = await luuKhuonQc(db, tapId); console.log(k.ok ? `  khuôn QC #${k.data}` : `  khuôn: ${k.loi}`); }
const p = (await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as { phim_id: number }[];
if (p[0]) { await luuKieuChuThuongHieu(db, Number(p[0].phim_id)); console.log('  kiểu chữ thương hiệu: đã ghi'); }
const tk = (await db.execute(sql`SELECT loai, thuong_hieu, count(*) AS n FROM xv_tai_san WHERE xoa_luc IS NULL GROUP BY 1, 2 ORDER BY 1`)) as unknown as Record<string, unknown>[];
for (const r of tk) console.log(`  kho: ${String(r.loai)} · ${String(r.thuong_hieu)} · ${String(r.n)}`);
process.exit(0);
