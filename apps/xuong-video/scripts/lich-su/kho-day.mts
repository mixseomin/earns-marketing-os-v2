// ĐẨY KHO KÊNH LỊCH SỬ LÊN R2 + STUDIO (02/11/2026). Chạy trên box3:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/kho-day.mts <thư-mục-png> <id> <loại> "<tên>" "<mô tả>" <năm-từ> <năm-đến>
// <thư-mục-png>: goc.png + <dáng>.png (nền trong). Ghi R2 xuong-video/lich-su/kho/<id>/<dáng>.png, rồi upsert vào phim Studio "Kênh lịch sử · kho
// tài sản" (thành phần = tài sản, biến thể nhóm 'dang' = từng dáng) để anh xem / quản trong Studio. In JSON {id, dang:{tên: url}} cho kho.json.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';

const [dir, id, loai, ten, moTa, tu, den] = process.argv.slice(2);
if (!dir || !id || !loai || !ten) { console.error('tsx kho-day.mts <dir> <id> <loại> <tên> <mô tả> <từ> <đến>'); process.exit(2); }
const db = getDb()!;
const PHIM = 'Kênh lịch sử · kho tài sản';
let phim = ((await db.execute(sql`SELECT id FROM xv_phim WHERE ten = ${PHIM} LIMIT 1`)) as unknown as { id: number }[])[0]?.id;
if (!phim) phim = ((await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai) VALUES ('studio', ${PHIM}, 'short',
  'Kho dùng chung mọi tập kênh lịch sử dựng bằng code: nhân vật, phương tiện, cờ, huy hiệu — mỗi món có khoảng năm dùng được và bộ dáng. Nguồn máy: apps/xuong-video/scripts/lich-su/kho.json',
  ${JSON.stringify({ chat_lieu: 've_2d', the_loai: 'hoat_hinh', ti_le: '9:16', phong_cach: 'Flat 2D illustrated history documentary style: clean ink outlines, soft cel shading, muted earthy palette' })}::jsonb, 'nhap') RETURNING id`)) as unknown as { id: number }[])[0]!.id;
const dang: Record<string, string> = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.png'))) {
  const u = await uploadToR2(`xuong-video/lich-su/kho/${id}/${f}`, readFileSync(join(dir, f)), 'image/png');
  if (u) dang[f.replace(/\.png$/, '')] = u;
}
const thoi = `${tu}–${den}`;
let nv = ((await db.execute(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phim} AND ten = ${ten} LIMIT 1`)) as unknown as { id: number }[])[0]?.id;
const loaiSt = loai === 'nhan_vat' ? 'nhan_vat' : 'dao_cu';
if (!nv) nv = ((await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, tieu_su) VALUES (${phim}, ${loaiSt}, ${ten}, ${moTa}, ${JSON.stringify(dang.goc ? [dang.goc] : [])}::jsonb, ${`Dùng được ${thoi} · mã kho ${id}`}) RETURNING id`)) as unknown as { id: number }[])[0]!.id;
else await db.execute(sql`UPDATE xv_nhan_vat SET mo_ta = ${moTa}, anh_ref = ${JSON.stringify(dang.goc ? [dang.goc] : [])}::jsonb, tieu_su = ${`Dùng được ${thoi} · mã kho ${id}`}, updated_at = now() WHERE id = ${nv}`);
for (const [d, u] of Object.entries(dang)) {
  if (d === 'goc') continue;
  const co = ((await db.execute(sql`SELECT id FROM xv_bien_the WHERE nhan_vat_id = ${nv} AND nhom = 'dang' AND ten = ${d} LIMIT 1`)) as unknown as { id: number }[])[0];
  if (co) await db.execute(sql`UPDATE xv_bien_the SET anh_url = ${u}, updated_at = now() WHERE id = ${co.id}`);
  else await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, anh_url) VALUES (${nv}, 'dang', ${d}, ${`Dáng ${d} của ${ten}`}, ${u})`);
}
console.log(JSON.stringify({ id, phim, thanh_phan: nv, dang }));
process.exit(0);
