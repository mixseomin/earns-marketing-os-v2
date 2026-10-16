// NẠP TẬP MẪU PHIM TỔNG TÀI vào studio (anh 17/10/2026: "tạo vào file video trong studio để quản lý"). Nguồn: phim.json + bo-set.json cạnh tệp này.
// Chạy lại an toàn: phim tìm theo tên, nhân vật theo (phim, tên), tập theo (phim, số) — có thì cập nhật, chưa có thì thêm. Không xoá gì.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/du-lieu/tong-tai/nap.mts
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

type Dong = { loai: string; chu?: string; ten?: string; dien?: string; loi?: string };
const d = JSON.parse(readFileSync(new URL('./phim.json', import.meta.url), 'utf8'));
const db = getDb() as never as { execute: (q: unknown) => Promise<Record<string, unknown>[]> };
const j = (x: unknown) => JSON.stringify(x);

let r = await db.execute(sql`SELECT id FROM xv_phim WHERE ten = ${d.ten} LIMIT 1`);
const phimId = r[0]
  ? (await db.execute(sql`UPDATE xv_phim SET mo_ta = ${d.mo_ta}, kinh_thanh = ${j(d.kinh_thanh)}::jsonb, updated_at = now() WHERE id = ${r[0].id} RETURNING id`))[0]!.id
  : (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES ('studio', ${d.ten}, ${d.loai}, ${d.mo_ta}, ${j(d.kinh_thanh)}::jsonb) RETURNING id`))[0]!.id;

const nv: Record<string, number> = {};
for (const v of d.nhan_vat) {
  r = await db.execute(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phimId} AND ten = ${v.ten} LIMIT 1`);
  const id = r[0]
    ? (await db.execute(sql`UPDATE xv_nhan_vat SET loai = ${v.loai}, mo_ta = ${v.mo_ta}, tieu_su = ${v.tieu_su ?? ''}, khoi_3d = ${v.khoi_3d ? j(v.khoi_3d) : null}::jsonb, updated_at = now() WHERE id = ${r[0].id} RETURNING id`))[0]!.id
    : (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, tieu_su, khoi_3d) VALUES (${phimId}, ${v.loai}, ${v.ten}, ${v.mo_ta}, ${v.tieu_su ?? ''}, ${v.khoi_3d ? j(v.khoi_3d) : null}::jsonb) RETURNING id`))[0]!.id;
  nv[v.ten] = Number(id);
}

// Kịch bản dạng screenplay chuẩn (tiêu đề cảnh: NỘI. NƠI — LÚC (ngày truyện)), dựng từ phân cảnh — một nguồn với ngăn kịch bản của studio.
const t = d.tap;
const kichBan = t.phan_canh.map((p: { ten: string; noi: string; luc: string; ngay: string; kich_ban: Dong[] }, i: number) =>
  [`CẢNH ${i + 1} · ${p.ten.toUpperCase()}`, `NỘI. ${p.noi.toUpperCase()} — ${p.luc.toUpperCase()} (${p.ngay})`, '',
   ...p.kich_ban.map((x) => (x.loai === 'nv' ? `${x.ten!.toUpperCase()}\n(${x.dien})\n${x.loi}` : x.loai === 'chuyen' ? `${x.chu}` : x.chu)), ''].join('\n')).join('\n');
r = await db.execute(sql`SELECT id FROM xv_tap WHERE phim_id = ${phimId} AND so = ${t.so} LIMIT 1`);
const tapId = r[0]
  ? (await db.execute(sql`UPDATE xv_tap SET ten = ${t.ten}, brief = ${t.brief}, kich_ban = ${kichBan}, beats = ${j(t.beats)}::jsonb, phan_canh = ${j(t.phan_canh)}::jsonb, updated_at = now() WHERE id = ${r[0].id} RETURNING id`))[0]!.id
  : (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, brief, kich_ban, beats, phan_canh) VALUES (${phimId}, ${t.so}, ${t.ten}, ${t.brief}, ${kichBan}, ${j(t.beats)}::jsonb, ${j(t.phan_canh)}::jsonb) RETURNING id`))[0]!.id;

// BỘ SET 3D (bo-set.json, sinh bằng dung-bo-set.py): mỗi bối cảnh một bộ set, gắn bo_set_id + vùng → trình xem 🧊 và Blender đọc được.
const sets: Record<string, number> = {};
for (const b of JSON.parse(readFileSync(new URL('./bo-set.json', import.meta.url), 'utf8'))) {
  r = await db.execute(sql`SELECT id FROM xv_bo_set WHERE phim_id = ${phimId} AND ten = ${b.ten} LIMIT 1`);
  const du = j({ vat: b.vat });
  const id = r[0]
    ? (await db.execute(sql`UPDATE xv_bo_set SET mo_ta = ${b.mo_ta}, du_lieu = ${du}::jsonb, updated_at = now() WHERE id = ${r[0].id} RETURNING id`))[0]!.id
    : (await db.execute(sql`INSERT INTO xv_bo_set (project, phim_id, ten, mo_ta, du_lieu) VALUES ('studio', ${phimId}, ${b.ten}, ${b.mo_ta}, ${du}::jsonb) RETURNING id`))[0]!.id;
  sets[b.ten] = Number(id);
  await db.execute(sql`UPDATE xv_nhan_vat SET bo_set_id = ${id}, vung = ${j(b.vung)}::jsonb, updated_at = now() WHERE id = ${nv[b.boi_canh]!}`);
}

console.log(JSON.stringify({ phim: Number(phimId), tap: Number(tapId), nhan_vat: nv, bo_set: sets }));
process.exit(0);
