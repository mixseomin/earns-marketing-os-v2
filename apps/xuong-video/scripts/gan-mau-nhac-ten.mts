// (0đ) Gắn bù vào từng shot của tập mọi anchor có NHẮC TÊN trong prompt ảnh / hành động mà chưa gắn (quy-trinh.ts › mauNhacTen) — cho tập tách
// trước khi luu-canh.ts tự gắn. Chụp trước để ↶ Hoàn tác.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/gan-mau-nhac-ten.mts <tap_id>
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { mapCanh, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import { mauNhacTen } from '../src/lib/xuong-video/quy-trinh';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
const db = getDb()!; const tapId = Number(process.argv[2]);
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
const phim = ((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0]?.phim_id;
const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(phim)}`)) as unknown as Row[]).map(mapNhanVat);
let n = 0;
for (const c of ds) {
  const them = mauNhacTen(c, nv);
  if (!them.length) continue;
  await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['nhan_vat'], moTa: 'gắn anchor có nhắc tên trong prompt', nguoi: 'claude (script)' });
  await db.execute(sql`UPDATE xv_canh SET nhan_vat = ${JSON.stringify([...c.nhan_vat, ...them.map((v) => v.id)])}::jsonb, updated_at = now() WHERE id = ${c.id}`);
  console.log(`#${c.thu_tu}: + ${them.map((v) => v.ten).join(', ')}`); n++;
}
console.log(`gắn bù ${n} shot`);
process.exit(0);
