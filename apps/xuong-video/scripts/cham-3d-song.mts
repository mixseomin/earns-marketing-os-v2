// ĐO KHUNG 3D SỐNG CẢ TẬP (do-3d-song.ts) — 0đ, không render: shot có máy ảo mà khung xám thiếu / cũ (mã đổi sau khi sửa set / máy / chỗ đứng)
// được đo trên cảnh three.js rồi ghi vào khung_xam (nguon: 'song', đúng mã hiện tại) → kiem-cong-shot.mts / cham-dan-dat.mts / lưới chấm ngay.
// Shot có khung Blender còn đúng mã thì giữ (số Blender chính xác hơn: dáng mocap, người MPFB). Sinh keyframe vẫn cần dựng Blender (cổng chặn).
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cham-3d-song.mts <tap_id> [--tat-ca]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, mapNhanVat, boiCanhCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { mapBoSet } from '../src/lib/xuong-video/bo-set-3d-may';
import { boSetCuaShot, maKhungXam } from '../src/lib/xuong-video/bo-set-3d';
import { do3dSong } from '../src/lib/xuong-video/do-3d-song';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { locNhanh, type KhungXam } from '../src/lib/xuong-video/kieu';
import type { KhoiNv } from '../src/lib/xuong-video/bo-set-three';

const tapId = Number(process.argv[2]); if (!tapId) { console.error('cần <tap_id>'); process.exit(1); }
const tatCa = process.argv.includes('--tat-ca');
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const tap = (await q(sql`SELECT phim_id, phan_canh FROM xv_tap WHERE id = ${tapId}`))[0]; if (!tap) { console.error('không thấy tập'); process.exit(1); }
const nv = (await q(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(tap.phim_id)} ORDER BY id`)).map(mapNhanVat);
const sets = (await q(sql`SELECT * FROM xv_bo_set WHERE phim_id = ${Number(tap.phim_id)} OR phim_id IS NULL`)).map(mapBoSet);
const ds = locNhanh((await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)).map(mapCanh), 'A');
const khoiCua = (t: string) => (nv.find((v) => v.ten === t)?.khoi_3d ?? undefined) as KhoiNv | undefined;
const laNguoi = (t: string) => nv.some((v) => v.ten === t && v.loai === 'nhan_vat');
let doMoi = 0, giu = 0;
for (const c of ds) {
  // máy ĐẦY ĐỦ + nhân vật (kèm biến thể) lấy ĐÚNG đường cổng keyframe dùng (doc-db.ts › boiCanhCanh) — tự tính lại thì mã khung lệch cổng
  const sid = boSetCuaShot(c, nv); const set = sets.find((s) => s.id === sid); if (!set || !c.may_3d) continue;
  const bc = await boiCanhCanh(db, c.id); const m = bc?.mayDu ?? c.may_3d; const nvP = bc?.nvPhim ?? nv;
  const ma = maKhungXam(set, m, nvP, c.bieu_cam, c.ky_thuat?.chuyen_dong, c.ky_thuat?.anh_sang);
  if (process.argv.includes('--so')) {   // SO với khung Blender còn đúng mã — không ghi gì (kiểm độ tin của đo sống)
    if (c.khung_xam?.ma !== ma || c.khung_xam.nguon) continue;
    const s = do3dSong(set, m, khoiCua, laNguoi); const b = c.khung_xam;
    const k1 = (x: KhungXam['kiem']) => x.filter((k) => k.bat_buoc).map((k) => `${k.nhan_vat}:${k.trong_khung ? 'trong' : 'NGOAI'}${k.bi_che_boi.length ? `/che ${k.bi_che_boi.join('+')}` : ''}/${Math.round(k.cao_khung_pt)}%`).join(' ');
    const t1 = (x: KhungXam['thay']) => (x ?? []).filter((t) => t.pt >= 3).slice(0, 5).map((t) => `${t.ten} ${Math.round(t.pt)}`).join(', ');
    console.log(`#${c.thu_tu}\n  blender: ${k1(b.kiem)} | ${t1(b.thay)}\n  song   : ${k1(s.kiem ?? [])} | ${t1(s.thay)}`); continue;
  }
  if (!tatCa && c.khung_xam?.ma === ma) { giu++; continue; }
  const kx: KhungXam = { ma, luc: new Date().toISOString(), nguon: 'song', ...do3dSong(set, m, khoiCua, laNguoi) } as KhungXam;
  await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['khung_xam'], moTa: `đo khung 3D sống #${c.thu_tu}`, nguoi: 'cham-3d-song' });
  await db.execute(sql`UPDATE xv_canh SET khung_xam = ${JSON.stringify(kx)}::jsonb WHERE id = ${c.id}`);
  doMoi++;
  const loi = (kx.kiem ?? []).filter((k) => k.bat_buoc && (!k.trong_khung || k.bi_che_boi.length)).map((k) => `${k.nhan_vat} ${!k.trong_khung ? 'ngoài khung' : `bị ${k.bi_che_boi.join(', ')} che`}`);
  console.log(`#${c.thu_tu} đo sống · ${(kx.thay ?? []).slice(0, 4).map((t) => `${t.ten} ${t.pt}%`).join(', ')}${loi.length ? ` · ✗ ${loi.join('; ')}` : ''}`);
}
console.log(`— đo sống ${doMoi} shot · giữ khung Blender ${giu}`);
process.exit(0);
