// 🧊 Bộ set 3D trên box (bo-set-3d.ts / bo-set-3d-may.ts) — 0đ:
//   --nap=<set.json> --phim=<id> [--tap=<id>]  nạp bộ set: vat → xv_bo_set (cùng tên thì cập nhật), vung → anchor bối cảnh của phim,
//                                              khoi → khối 3D nhân vật / đạo cụ, may (theo mã shot) → xv_canh.may_3d của tập
//   --dung --tap=<id> [--tat-ca]               dựng khung xám (Blender) cho shot có may_3d mà khung xám thiếu / cũ
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set.mts …
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { dungKhungXamTap } from '../src/lib/xuong-video/bo-set-3d-may';
import { datMayTuDong, type DatMay, BAN_MAY } from '../src/lib/xuong-video/bo-set-3d';
import type { Row } from '../src/lib/xuong-video/doc-db';

const db = getDb()!; const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? '';
const tap = Number(gia('tap')) || null;
if (gia('nap')) {
  const d = JSON.parse(readFileSync(gia('nap'), 'utf8'));
  const phim = Number(gia('phim'));
  const project = String(((await db.execute(sql`SELECT project FROM xv_phim WHERE id = ${phim}`)) as unknown as Row[])[0]?.project ?? 'studio');
  const co = (await db.execute(sql`SELECT id FROM xv_bo_set WHERE project = ${project} AND ten = ${d.ten}`)) as unknown as Row[];
  const du = { vat: d.vat, ghi_chu: d.ghi_chu };
  const setId = co[0] ? Number(co[0].id) : Number(((await db.execute(sql`INSERT INTO xv_bo_set (project, phim_id, ten, du_lieu) VALUES (${project}, ${phim}, ${d.ten}, ${JSON.stringify(du)}::jsonb) RETURNING id`)) as unknown as Row[])[0]!.id);
  if (co[0]) await db.execute(sql`UPDATE xv_bo_set SET du_lieu = ${JSON.stringify(du)}::jsonb, updated_at = now() WHERE id = ${setId}`);
  const nv = (await db.execute(sql`SELECT id, ten FROM xv_nhan_vat WHERE phim_id = ${phim}`)) as unknown as Row[];
  const idTen = (t: string) => nv.find((v) => String(v.ten).trim().toLowerCase() === t.trim().toLowerCase())?.id;
  const thieu: string[] = []; let vung = 0, khoi = 0, may = 0;
  for (const [t, tam] of Object.entries(d.vung ?? {}) as [string, number[]][]) {
    const id = idTen(t); if (!id) { thieu.push(t); continue; }
    await chupTruoc(db, { bang: 'xv_nhan_vat', id: Number(id), cot: ['bo_set_id', 'vung'], moTa: 'nạp bộ set 3D', nguoi: 'bo-set' });
    await db.execute(sql`UPDATE xv_nhan_vat SET bo_set_id = ${setId}, vung = ${JSON.stringify({ tam })}::jsonb WHERE id = ${Number(id)}`); vung++;
  }
  for (const [t, k] of Object.entries(d.khoi ?? {})) {
    const id = idTen(t); if (!id) { thieu.push(t); continue; }
    await chupTruoc(db, { bang: 'xv_nhan_vat', id: Number(id), cot: ['khoi_3d'], moTa: 'nạp bộ set 3D', nguoi: 'bo-set' });
    await db.execute(sql`UPDATE xv_nhan_vat SET khoi_3d = ${JSON.stringify(k)}::jsonb WHERE id = ${Number(id)}`); khoi++;
  }
  if (tap) for (const [ma, m] of Object.entries(d.may ?? {})) {
    const r = (await db.execute(sql`SELECT id, ky_thuat, may_3d FROM xv_canh WHERE tap_id = ${tap} AND dan_dung->>'ma' = ${ma}`)) as unknown as Row[];
    if (!r[0]) { thieu.push(`shot ${ma}`); continue; }
    // Không ghi máy → ĐẶT MÁY TỰ ĐỘNG từ chỗ đứng + phía + cỡ cảnh / góc / ống kính của thẻ shot.
    const dm = m as DatMay & { dat?: number[] };
    if (!dm.dat) {
      const kt = (r[0].ky_thuat ?? {}) as Record<string, string>;
      // Khoá gồm TOÀN BỘ khai của shot (dm: chỗ đứng, phía, khung, nhảy, qua_truc, them, den_ban…) — trước đây chỉ vài trường nên khai qua_truc / them
      // không vào DB khi chỗ đứng giữ nguyên (5.2 / 7.5 tập 19).
      const vao = JSON.stringify([BAN_MAY, dm, kt.co_canh, kt.goc, kt.ong_kinh, dm.vi_tri.map((v) => d.khoi?.[v.ten] ?? null)]);
      // Đầu vào không đổi → giữ máy cũ (có thể đã được bộ giải trong Blender dời) — khỏi dựng + giải lại mỗi lần nạp.
      if ((r[0].may_3d as { tu_dong?: { vao?: string } } | null)?.tu_dong?.vao === vao) { may++; continue; }
      const t = datMayTuDong(dm, kt, (x) => d.khoi?.[x] ?? null);
      Object.assign(m as object, { ...t, tu_dong: { ...t.tu_dong, vao } }); delete (m as Record<string, unknown>).phia;
    }
    await chupTruoc(db, { bang: 'xv_canh', id: Number(r[0].id), cot: ['may_3d'], moTa: 'nạp máy ảo 3D', nguoi: 'bo-set' });
    await db.execute(sql`UPDATE xv_canh SET may_3d = ${JSON.stringify(m)}::jsonb WHERE id = ${Number(r[0].id)}`); may++;
  }
  console.log(JSON.stringify({ bo_set: setId, vung, khoi, may, thieu }));
}
if (process.argv.includes('--dung')) {
  if (!tap) { console.error('--dung cần --tap=<id>'); process.exit(1); }
  const chi = gia('chi') ? gia('chi').split(',').map(Number) : undefined;   // --chi=<id,…>: chỉ dựng các shot này (thử nhanh)
  // --xuat=<thư mục>: chỉ chuẩn bị đầu vào cho máy ngoài render (iMac) + ghi danh sách shot vào viec.json; --nhap=<thư mục>: nhận kết quả máy ngoài.
  const xuat = gia('xuat'), nhap = gia('nhap');
  if (nhap) {
    const v = JSON.parse(readFileSync(path.join(nhap, 'viec.json'), 'utf8')) as { ids: number[] };
    console.log(JSON.stringify(await dungKhungXamTap(db, tap, { tatCa: true, ids: v.ids, che: 'nhap', thuMuc: nhap })));
  } else {
    const kq = await dungKhungXamTap(db, tap, { tatCa: process.argv.includes('--tat-ca'), ids: chi, ...(xuat ? { che: 'xuat' as const, thuMuc: xuat } : {}) });
    if (xuat && kq.ok) writeFileSync(path.join(xuat, 'viec.json'), JSON.stringify({ ids: kq.data.ids }));
    console.log(JSON.stringify(kq));
  }
}
process.exit(0);
