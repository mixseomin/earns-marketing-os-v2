// ANCHOR TỪ ẢNH THẬT (anh 01/11/2026: "phố đường tàu phải sinh dựa vào ảnh thực"): tệp khai báo khu → ảnh thật (tham-khao/pho/<phố>/, nguồn + giấy phép
// ở nguon.json) → tải lên R2 → gắn xv_nhan_vat.anh_that (sửa anchor có id, hoặc tạo mới) → sinh ảnh gốc = VẼ LẠI từng ảnh thật theo phong cách phim
// (sinh-anh.ts › sinhAnhGoc nhánh anh_that). Ảnh thật không vào anh_ref. Chạy trên box3:
//   cd apps/xuong-video && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/anchor-anh-that.mts mau/ha-noi-duong-tau-khu.json [--chay]
// Không --chay = in kế hoạch + số ảnh sẽ vẽ (0đ). --chay TỐN TIỀN (mỗi ảnh vẽ một lượt model ảnh của phim).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
import { sinhAnhGoc } from '../src/lib/xuong-video/sinh-anh';

type Khu = { id?: number; ten: string; loai: string; mo_ta: string; anh: string[]; so_ve: number };
const tep = process.argv[2]; if (!tep) { console.error('thiếu tệp khai báo'); process.exit(1); }
const kb = JSON.parse(readFileSync(tep, 'utf8')) as { phim: number; goc_anh: string; khu: Khu[] };
const chay = process.argv.includes('--chay');
const db = getDb()!;
console.log(`phim #${kb.phim} · ${kb.khu.length} khu · ${kb.khu.reduce((a, k) => a + k.so_ve, 0)} ảnh vẽ lại`);
for (const k of kb.khu) console.log(`  ${k.id ? `#${k.id}` : 'mới'} [${k.loai}] ${k.ten} ← ${k.anh.join(', ')} · vẽ ${k.so_ve}`);
if (!chay) process.exit(0);
const t0 = new Date().toISOString(); const ids: number[] = [];
for (const k of kb.khu) {
  const url: string[] = [];
  for (const a of k.anh) { const u = await uploadToR2(`xuong-video/anh-that/${kb.phim}/${a}`, readFileSync(join(kb.goc_anh, a)), 'image/jpeg'); if (!u) { console.error(`không đẩy được ${a}`); process.exit(1); } url.push(u); }
  let id = k.id;
  if (id) await db.execute(sql`UPDATE xv_nhan_vat SET ten = ${k.ten}, mo_ta = ${k.mo_ta}, anh_that = ${JSON.stringify(url)}::jsonb, updated_at = now() WHERE id = ${id} AND phim_id = ${kb.phim}`);
  else {
    const cu = (await db.execute(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${kb.phim} AND ten = ${k.ten}`)) as unknown as { id: number }[];
    if (cu[0]) { id = Number(cu[0].id); await db.execute(sql`UPDATE xv_nhan_vat SET mo_ta = ${k.mo_ta}, anh_that = ${JSON.stringify(url)}::jsonb, updated_at = now() WHERE id = ${id}`); }
    else id = Number(((await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, anh_that) VALUES (${kb.phim}, ${k.loai}, ${k.ten}, ${k.mo_ta}, '[]'::jsonb, ${JSON.stringify(url)}::jsonb) RETURNING id`)) as unknown as { id: number }[])[0]!.id);
  }
  const r = await sinhAnhGoc(db, id, k.so_ve);
  console.log(`  #${id} ${k.ten}: ${url.length} ảnh thật · ${r.ok ? `đã đẩy ${k.so_ve} lượt vẽ` : `✗ ${r.loi}`}`);
  ids.push(id);
}
for (let i = 0; i < 120; i++) {   // đợi hàng ảnh xong (tối đa 10 phút)
  const r = ((await db.execute(sql`SELECT count(*) FILTER (WHERE trang_thai = 'cho')::int cho, count(*) FILTER (WHERE trang_thai = 'xong')::int xong, count(*) FILTER (WHERE trang_thai = 'loi')::int loi, coalesce(sum(chi_phi_cents), 0)::float tien
    FROM xv_job WHERE nhan_vat_id = ANY(${`{${ids.join(',')}}`}::int[]) AND created_at >= ${t0}::timestamptz`)) as unknown as { cho: number; xong: number; loi: number; tien: number }[])[0]!;
  if (!r.cho) { console.log(`xong ${r.xong} · lỗi ${r.loi} · ${r.tien.toFixed(2)}¢`); break; }
  await new Promise((o) => setTimeout(o, 5000));
}
for (const id of ids) { const x = ((await db.execute(sql`SELECT ten, anh_ref->>0 a FROM xv_nhan_vat WHERE id = ${id}`)) as unknown as { ten: string; a: string }[])[0]!; console.log(`  #${id} ${x.ten}: ${x.a}`); }
process.exit(0);
