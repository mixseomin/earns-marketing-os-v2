// Ghi Ý ĐỒ KHÁN GIẢ cho một tập từ tệp dữ liệu (scripts/du-lieu/khan-gia/tap-<id>.json) → xv_tap.khan_gia. 0đ (không gọi AI): Claude trong phiên đọc
// mục đích từng shot rồi soạn; script kiểm shot thuộc tập, in kết quả máy soát (khan-gia.ts › soatKhanGia), chụp trước để ↶ hoàn tác rồi ghi.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ap-khan-gia.mts 122 [--xem]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { lamSachKhanGia, soatKhanGia, hieuUngKG } from '../src/lib/xuong-video/khan-gia';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import type { KyThuatShot } from '../src/lib/xuong-video/dien-anh';

const tapId = Number(process.argv[2]);
if (!tapId) { console.error('dùng: ap-khan-gia.mts <tapId> [--xem]'); process.exit(2); }
const tho = JSON.parse(readFileSync(new URL(`./du-lieu/khan-gia/tap-${tapId}.json`, import.meta.url), 'utf8')) as unknown[];
const ds = lamSachKhanGia(tho);
if (ds.length !== tho.length) { console.error(`✗ ${tho.length - ds.length} đoạn bị bỏ khi làm sạch (hiệu ứng lạ / shot 0)`); process.exit(1); }
const db = getDb()!;
const canh = ((await db.execute(sql`SELECT id, thu_tu, ky_thuat FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number; ky_thuat: KyThuatShot | null }[]).map((c) => ({ ...c, id: Number(c.id) }));
const ids = new Set(canh.map((c) => c.id));
for (const x of ds) for (const id of [x.tu, x.den, ...(x.lat != null ? [x.lat] : [])]) if (!ids.has(id)) { console.error(`✗ shot ${id} không thuộc tập ${tapId}`); process.exit(1); }
for (const k of soatKhanGia(ds, canh)) {
  const h = hieuUngKG(k.yd.y);
  console.log(`${k.loi.length ? '⚠' : '✓'} ${h?.ic} ${h?.ten} #${canh[k.tu]?.thu_tu}→#${canh[k.den]?.thu_tu}${k.yd.lat != null ? ` ⟲#${canh.find((c) => c.id === k.yd.lat)?.thu_tu}` : ''} — ${k.yd.ghi ?? ''}`);
  for (const l of k.loi) console.log(`     ⚠ ${l}`);
}
if (process.argv.includes('--xem')) process.exit(0);
await chupTruoc(db as never, { bang: 'xv_tap', id: tapId, cot: ['khan_gia'], moTa: `ghi ý đồ khán giả (${ds.length} đoạn) từ ap-khan-gia.mts`, nguoi: 'claude' });
await db.execute(sql`UPDATE xv_tap SET khan_gia = ${JSON.stringify(ds)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
console.log(`ghi xong: ${ds.length} đoạn ý đồ khán giả vào tập ${tapId}`);
process.exit(0);
