// KEYFRAME = ẢNH RENDER BLENDER (anh 16/10/2026: "sinh lại keyframe = gen ảnh từ blender, không tiêu tiền"). Mesh nhân vật thật + Cycles
// (dung-set.py XV_MESH_THAT=1, chạy bằng chay-imac.sh) → khung_xam.mau / mau_ket đúng tuyệt đối góc máy, bố cục, cỡ, nhân dạng — không còn gì
// được model "sinh" ra. Lệnh này gán ảnh đó làm keyframe mở (+ khung kết làm keyframe_ket), ghi một job 0đ (model blender:cycles — luật một cảnh
// một model nhìn thấy cả cảnh cùng một tay vẽ), chụp hoàn tác như nút chọn keyframe. Ảnh cũ vẫn trong dải ứng viên. 0đ.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/keyframe-tu-3d.mts --tap=<id> [--chi=<thu_tu,…>]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { taoJob } from '../../src/lib/xuong-video/doc-db';
import { chupTruoc } from '../../src/lib/xuong-video/hoan-tac';
const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const tap = Number(gia('tap')); const chi = gia('chi') ? gia('chi').split(',').map(Number) : null;
if (!tap) { console.log('cần --tap=<id>'); process.exit(1); }
const db = getDb()!;
const ds = (await db.execute(sql`SELECT id, thu_tu, khung_xam->>'mau' AS mau, khung_xam->>'mau_ket' AS ket FROM xv_canh WHERE tap_id = ${tap} AND khung_xam->>'mau' IS NOT NULL ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number; mau: string; ket: string | null }[];
let n = 0;
for (const c of ds) {
  if (chi && !chi.includes(Number(c.thu_tu))) continue;
  await chupTruoc(db, { bang: 'xv_canh', id: Number(c.id), cot: ['keyframe_url', 'keyframe_uv', 'keyframe_ket', 'trang_thai'], moTa: 'keyframe = ảnh render Blender', nguoi: 'script keyframe-tu-3d' });
  await taoJob(db, { nhan: `Keyframe · render Blender · cảnh #${c.thu_tu}`, canh_id: Number(c.id), loai: 'anh', provider: 'blender', model: 'blender:cycles', request: { dich: 'keyframe_3d', mau: c.mau, ket: c.ket }, xong: true });
  await db.execute(sql`UPDATE xv_job SET output_url = ${c.mau}, chi_phi_cents = 0 WHERE id = (SELECT max(id) FROM xv_job WHERE canh_id = ${Number(c.id)} AND model = 'blender:cycles')`);
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${c.mau}, keyframe_ket = ${c.ket},
    keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([c.mau])}::jsonb THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([c.mau])}::jsonb END,
    trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi', 'duyet', 'xong') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${Number(c.id)}`);
  n++;
}
console.log(JSON.stringify({ ok: true, tap, gan: n }));
process.exit(0);
