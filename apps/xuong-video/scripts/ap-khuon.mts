// Áp khuôn chuỗi shot cho một tập từ tệp dữ liệu (scripts/du-lieu/khuon/tap-<id>.json) → xv_tap.khuon_chuoi. 0đ (không gọi AI): người / Claude
// trong phiên đọc shot rồi gán bước, script chỉ kiểm khoá + in kết quả kiemKhuon rồi ghi.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ap-khuon.mts 122 [--xem]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { kiemKhuon, khuonTheoKey, type ApKhuon } from '../src/lib/xuong-video/khuon-chuoi';
import type { KyThuatShot, TheLoai } from '../src/lib/xuong-video/dien-anh';

const tapId = Number(process.argv[2]);
if (!tapId) { console.error('dùng: ap-khuon.mts <tapId> [--xem]'); process.exit(2); }
const ds = JSON.parse(readFileSync(new URL(`./du-lieu/khuon/tap-${tapId}.json`, import.meta.url), 'utf8')) as ApKhuon[];
for (const a of ds) if (!khuonTheoKey(a.khuon)) { console.error(`✗ khuôn lạ: ${a.khuon}`); process.exit(1); }
const db = getDb()!;
const canh = (await db.execute(sql`SELECT id, thu_tu, ky_thuat FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number; ky_thuat: KyThuatShot | null }[];
const tl = ((await db.execute(sql`SELECT p.kinh_thanh->>'the_loai' AS tl FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as { tl: string }[])[0]?.tl as TheLoai | undefined;
const ids = new Set(canh.map((c) => String(c.id)));
for (const a of ds) for (const id of Object.keys(a.shots)) if (!ids.has(id)) { console.error(`✗ shot ${id} không thuộc tập ${tapId}`); process.exit(1); }
for (const a of ds) {
  const k = kiemKhuon(a, canh.map((c) => ({ ...c, id: Number(c.id) })), tl)!;
  console.log(`${k.muc === 'tot' ? '✓' : k.muc === 'vang' ? '◐' : '✗'} ${k.kh.ten} — ${a.ghi ?? ''}`);
  for (const s of k.shots) console.log(`   #${canh.find((c) => Number(c.id) === s.id)?.thu_tu} ${s.tenBuoc}${s.loi.length ? ` · ${s.loi.join(' · ')}` : ''}${s.goiY.length ? ` (${s.goiY.join(' · ')})` : ''}`);
  for (const l of k.loi) console.log(`   ⚠ ${l}`);
}
if (process.argv.includes('--xem')) process.exit(0);
await db.execute(sql`UPDATE xv_tap SET khuon_chuoi = ${JSON.stringify(ds)}::jsonb WHERE id = ${tapId}`);
console.log(`ghi xong: ${ds.length} lần áp khuôn vào tập ${tapId}`);
process.exit(0);
