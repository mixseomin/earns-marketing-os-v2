// NẠP TẬP MẪU PHIM TỔNG TÀI vào studio (anh 17/10/2026: "tạo vào file video trong studio để quản lý"). Nguồn: phim.json + bo-set.json + shot.json cạnh tệp này.
// Chạy lại an toàn: phim tìm theo tên, nhân vật theo (phim, tên), tập theo (phim, số) — có thì cập nhật, chưa có thì thêm. Không xoá gì.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/du-lieu/tong-tai/nap.mts
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mayShot } from './may-shot';

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
  // BIẾN THỂ (sổ trang phục — bo-set-3d.ts › lookChuaChuan): khoá (nhân vật, tên); có thì cập nhật nhóm / mô tả / dấu 3D, GIỮ ảnh đã sinh.
  for (const b of (v.bien_the ?? []) as { nhom: string; ten: string; mo_ta: string; dan_3d?: unknown }[]) {
    const c = await db.execute(sql`SELECT id FROM xv_bien_the WHERE nhan_vat_id = ${Number(id)} AND ten = ${b.ten} LIMIT 1`);
    if (c[0]) await db.execute(sql`UPDATE xv_bien_the SET nhom = ${b.nhom}, mo_ta = ${b.mo_ta}, dan_3d = ${b.dan_3d ? j(b.dan_3d) : null}::jsonb, updated_at = now() WHERE id = ${c[0].id}`);
    else await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, dan_3d) VALUES (${Number(id)}, ${b.nhom}, ${b.ten}, ${b.mo_ta}, ${b.dan_3d ? j(b.dan_3d) : null}::jsonb)`);
  }
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

// SHOT (shot.json, sinh bằng dung-shot.py): khoá = dan_dung.ma — chạy lại thì cập nhật đúng shot, không đẻ trùng. Tên nhân vật → id anchor.
type Shot = { ma: string; canh: string; phat_s: number; thoi_luong_s: number; duong_video: string; ky_thuat: Record<string, unknown>; dan_dung: Record<string, string>; hanh_dong: string;
  thoai: { nhan_vat: string; dien_xuat: string; loi: string }[]; bieu_cam: unknown[]; may_3d: unknown; nhan_vat: string[]; chu_man: string; prompt_anh: string; prompt_video: string };
const shots: Shot[] = JSON.parse(readFileSync(new URL('./shot.json', import.meta.url), 'utf8'));
const khoiCua = (ten: string) => (d.nhan_vat as { ten: string; khoi_3d?: { co: number[] } }[]).find((a) => a.ten === ten)?.khoi_3d ?? null;
const soCanh = (ten: string) => t.phan_canh.findIndex((p: { ten: string }) => p.ten === ten) + 1;
let soShot = 0;
for (const [i, c] of shots.entries()) {
  const dd = { ...c.dan_dung, duong_video: c.duong_video };
  const ids = c.nhan_vat.map((x) => nv[x]).filter(Boolean);
  const kt = c.ky_thuat as Record<string, string>;
  const gocMay = [kt.co_canh, kt.goc, kt.chuyen_dong, kt.ong_kinh].filter(Boolean).join(' · ');
  const loiThoai = c.thoai.map((d) => `${d.nhan_vat} (${d.dien_xuat}): "${d.loi}"`).join('\n');
  const pa = c.prompt_anh || `${dd.bo_cuc}. Opening moment: ${dd.mo}.`;
  const pv = c.prompt_video || `${dd.mo}, then ${dd.ket}. Natural, restrained acting; cinematic, photorealistic.`;
  r = await db.execute(sql`SELECT id, may_3d FROM xv_canh WHERE tap_id = ${tapId} AND dan_dung->>'ma' = ${c.ma} LIMIT 1`);
  const may = mayShot(c.may_3d as never, kt, khoiCua, (r[0]?.may_3d ?? null) as never);
  const vals = sql`thu_tu = ${i + 1}, canh = ${`Cảnh ${soCanh(c.canh)} · ${c.canh}`}, phan_doan = ${c.canh}, nhan_vat = ${j(ids)}::jsonb, hanh_dong = ${c.hanh_dong}, goc_may = ${gocMay},
    loi_thoai = ${loiThoai}, thoai = ${j(c.thoai)}::jsonb, thoi_luong_s = ${c.thoi_luong_s}, phat_s = ${c.phat_s}, ky_thuat = ${j(c.ky_thuat)}::jsonb, dan_dung = ${j(dd)}::jsonb,
    bieu_cam = ${j(c.bieu_cam)}::jsonb, may_3d = ${j(may)}::jsonb, chu_man = ${c.chu_man}, prompt_anh = ${pa}, prompt_video = ${pv}, updated_at = now()`;
  if (r[0]) await db.execute(sql`UPDATE xv_canh SET ${vals} WHERE id = ${r[0].id}`);
  else await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, dan_dung) VALUES (${tapId}, ${i + 1}, ${j(dd)}::jsonb)`).then(async () => {
    const n = await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND dan_dung->>'ma' = ${c.ma} ORDER BY id DESC LIMIT 1`);
    await db.execute(sql`UPDATE xv_canh SET ${vals} WHERE id = ${n[0]!.id}`);
  });
  soShot++;
}

console.log(JSON.stringify({ phim: Number(phimId), tap: Number(tapId), nhan_vat: nv, bo_set: sets, shot: soShot }));
process.exit(0);
