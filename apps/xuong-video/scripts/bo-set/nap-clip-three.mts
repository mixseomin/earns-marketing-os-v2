// NẠP CLIP 3D CHUYỂN ĐỘNG vào khung_xam.clip (anh 13/11/2026: chế độ xem 🧊 3D trên timeline — "film dạng 3D có đủ chuyển động, rồi các keyframe, sau đó
// mới đến video"). Đọc thư mục xuat-clip.cjs xuất (shot-NN.mp4 + shot-NN.json {vao, ra}), đẩy kho, ghi clip kèm mã khung hiện tại (đổi set / máy → mã lệch →
// timeline coi là clip cũ). Chỉ GỘP khoá clip, không đụng phần đo / ảnh của khung_xam. 0đ.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nap-clip-three.mts <tap_id> <thư mục clip>
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../../src/lib/xuong-video/doc-db';
import { uploadToR2 } from '../../src/lib/r2';
const db = getDb()!; const [tapS, thuMuc] = process.argv.slice(2); const tapId = Number(tapS);
if (!tapId || !thuMuc) { console.error('cần <tap_id> <thư mục clip>'); process.exit(1); }
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
const lan = Date.now().toString(36); let nap = 0; const loi: string[] = [];
for (const c of ds) {
  const so = Math.round(c.thu_tu); const kx = c.khung_xam; const ten = path.join(thuMuc, `shot-${String(so).padStart(2, '0')}`);
  if (!kx) { loi.push(`#${so}: chưa có khung 3D`); continue; }
  if (!existsSync(`${ten}.mp4`) || !existsSync(`${ten}.json`)) { loi.push(`#${so}: thiếu clip trong ${thuMuc}`); continue; }
  const m = JSON.parse(await readFile(`${ten}.json`, 'utf8')) as { vao: number; ra: number; sach?: boolean };
  const url = await uploadToR2(`xuong-video/khung-xam/${c.id}-${kx.ma}-clip3d-${lan}.mp4`, await readFile(`${ten}.mp4`), 'video/mp4');
  if (!url) { loi.push(`#${so}: đẩy kho hỏng (R2 chưa bật?)`); continue; }
  const clip = { url, vao: m.vao, ra: m.ra, ma: kx.ma, luc: new Date().toISOString(), sach: m.sach === true };
  await db.execute(sql`UPDATE xv_canh SET khung_xam = khung_xam || ${JSON.stringify({ clip })}::jsonb, updated_at = now() WHERE id = ${c.id} AND khung_xam->>'ma' = ${kx.ma}`); nap++;
}
console.log(JSON.stringify({ nap, loi }));
process.exit(0);
