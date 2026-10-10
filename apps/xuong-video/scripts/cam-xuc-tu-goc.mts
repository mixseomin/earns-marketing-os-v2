// Áp cảm xúc khán giả MỤC TIÊU từ khung QC mẫu (mau/*.json, trường cam_xuc từng shot; thiếu thì theo loại shot) vào các shot đã có của một tập,
// khớp theo thứ tự. 0đ. Có ↶ Hoàn tác (chupTruoc). Chạy trên box3:
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cam-xuc-tu-goc.mts mau/jett-husband-goc.json --tap=6
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { CAM_XUC_THEO_LOAI, type LoaiShotMau } from '../src/lib/xuong-video/kieu';

const tep = process.argv[2]; const tapId = Number((process.argv.find((a) => a.startsWith('--tap=')) ?? '').split('=')[1] || 0);
if (!tep || !tapId) { console.error('cách dùng: cam-xuc-tu-goc.mts <mau.json> --tap=<id>'); process.exit(1); }
const g = JSON.parse(readFileSync(tep, 'utf8')) as { canh: { loai: string; cam_xuc?: number }[] };
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const ds = (await db.execute(sql`SELECT id, thu_tu, cam_xuc FROM xv_canh WHERE tap_id = ${tapId} AND (nhanh IS NULL OR nhanh IN ('', 'A')) ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number; cam_xuc: number }[];
if (ds.length !== g.canh.length) { console.error(`tập có ${ds.length} shot, khung có ${g.canh.length} — không khớp, dừng`); process.exit(1); }
const nhom = randomUUID(); let doi = 0;
for (const [i, c] of ds.entries()) {
  const k = g.canh[i]!; const v = typeof k.cam_xuc === 'number' ? k.cam_xuc : CAM_XUC_THEO_LOAI[k.loai as LoaiShotMau] ?? 0;
  if (Number(c.cam_xuc) === v) continue;
  await chupTruoc(db, { bang: 'xv_canh', id: Number(c.id), cot: ['cam_xuc'], moTa: 'cảm xúc khán giả mục tiêu từ khung mẫu', nguoi: 'script cam-xuc-tu-goc', nhom });
  await db.execute(sql`UPDATE xv_canh SET cam_xuc = ${v}, updated_at = now() WHERE id = ${Number(c.id)}`);
  doi++;
}
console.log(`đổi ${doi}/${ds.length} shot · đường cảm xúc: ${ds.map((_, i) => { const k = g.canh[i]!; return typeof k.cam_xuc === 'number' ? k.cam_xuc : CAM_XUC_THEO_LOAI[k.loai as LoaiShotMau]; }).join(' ')}`);
process.exit(0);
