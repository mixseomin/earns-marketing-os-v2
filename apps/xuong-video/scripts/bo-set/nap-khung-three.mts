// NẠP KHUNG three.js VÀO khung_xam — thay Blender (anh 13/11/2026). Đọc thư mục ảnh do xuat-khung.cjs xuất (<so>-mau.jpg, -mau-giua.jpg, -mau-ket.jpg, -sau.png),
// đẩy kho ảnh, GỘP vào khung_xam đo 3D sống của shot (giữ thay / kiem / di / mã), nguon = 'three'. Cổng keyframe chấp nhận nguon 'three' như khung Blender.
// Mã khung (ma) phải trùng mã hiện tại — khung đo sống lệch mã (set / máy đổi sau khi đo) thì bỏ qua shot đó, chạy cham-3d-song.mts trước.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nap-khung-three.mts <tap_id> <thư mục ảnh>
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../../src/lib/xuong-video/doc-db';
import { uploadToR2 } from '../../src/lib/r2';
import { chupTruoc } from '../../src/lib/xuong-video/hoan-tac';
import type { KhungXam } from '../../src/lib/xuong-video/kieu';
const db = getDb()!; const [tapS, thuMuc] = process.argv.slice(2); const tapId = Number(tapS);
if (!tapId || !thuMuc) { console.error('cần <tap_id> <thư mục ảnh>'); process.exit(1); }
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
const lan = Date.now().toString(36); let nap = 0; const loi: string[] = [];
for (const c of ds) {
  const so = Math.round(c.thu_tu); const kx0 = c.khung_xam;
  if (!kx0) { loi.push(`#${so}: chưa đo 3D sống (cham-3d-song.mts) — bỏ qua`); continue; }
  const len = async (duoi: string, dang: 'jpg' | 'png') => { const f = path.join(thuMuc, `${so}-${duoi}.${dang}`); return existsSync(f) ? uploadToR2(`xuong-video/khung-xam/${c.id}-${kx0.ma}-three-${lan}-${duoi}.${dang}`, await readFile(f), dang === 'jpg' ? 'image/jpeg' : 'image/png') : null; };
  const [mau, giua, ket, sau] = await Promise.all([len('mau', 'jpg'), len('mau-giua', 'jpg'), len('mau-ket', 'jpg'), len('sau', 'png')]);
  if (!mau || !sau) { loi.push(`#${so}: thiếu ảnh mở / độ sâu trong ${thuMuc}`); continue; }
  const dong = (c.ky_thuat?.chuyen_dong ?? 'tinh') !== 'tinh' || (c.may_3d?.vi_tri ?? []).some((v) => v.den || (v as { nhip?: unknown[] }).nhip?.length);
  const fHop = path.join(thuMuc, `${so}-hop.json`); const hop = existsSync(fHop) ? (JSON.parse(await readFile(fHop, 'utf8')) as Record<string, number[]>) : undefined;
  const kx: KhungXam = { ...kx0, nguon: 'three', xam: mau, mau, sau, ...(hop ? { hop } : {}), ...(giua ? { mau_giua: giua } : {}), ...(ket ? { mau_ket: ket, ket_dong: dong } : {}), luc: new Date().toISOString() } as KhungXam;
  await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['khung_xam'], moTa: `nạp khung three.js #${so}`, nguoi: 'nap-khung-three' });
  await db.execute(sql`UPDATE xv_canh SET khung_xam = ${JSON.stringify(kx)}::jsonb, updated_at = now() WHERE id = ${c.id}`); nap++;
}
console.log(JSON.stringify({ nap, loi }));
process.exit(0);
