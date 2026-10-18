// DỰNG PHIM THỬ "NHIỀU SHOT / MỘT CLIP" (0đ; anh 19/10/2026: "phải tạo film mới, cấm động vào cái đang làm"): chép MỘT phân cảnh của một tập
// (nhân vật xuất hiện trong cảnh + biến thể + các shot của cảnh, giữ keyframe làm ảnh bối cảnh) sang phim mới "<tên> (thử: nhiều shot / một clip)".
// Anh mở phim thử trong studio → khối phân cảnh trên timeline → 🧪 xem giá → bấm sinh thử (Claude không tự sinh video). Phim gốc không bị đụng.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nhan-ban-phim-ref2v.mts <tap_id> "<phân cảnh>"
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import type { Row } from '../src/lib/xuong-video/doc-db';

const db = getDb()!;
const tapId = Number(process.argv[2]); const pd = String(process.argv[3] ?? '').trim();
if (!tapId || !pd) { console.error('cần <tap_id> "<phân cảnh>"'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const tap = (await q(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`))[0]; if (!tap) { console.error('không thấy tập'); process.exit(1); }
const canh = await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} AND phan_doan = ${pd} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`);
if (!canh.length) { console.error(`tập ${tapId} không có phân cảnh "${pd}"`); process.exit(1); }
const phimGoc = Number(tap.phim_id);
const nvDung = [...new Set(canh.flatMap((c) => ((c.nhan_vat as number[]) ?? []).map(Number)))];
const ketQua = await db.transaction(async (tx) => {
  const t = async (s: ReturnType<typeof sql>) => (await tx.execute(s)) as unknown as Row[];
  const phimId = Number((await t(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai)
    SELECT project, ten || ${` (thử: nhiều shot / một clip · ${pd})`}, loai, mo_ta, kinh_thanh, trang_thai FROM xv_phim WHERE id = ${phimGoc} RETURNING id`))[0]!.id);
  const doiNv = new Map<number, number>(); const doiBt = new Map<number, number>();
  for (const id of nvDung) {
    const m = (await t(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, tieu_su, anh_ref, anh_mat, khoi_3d, giong, giong_model, giong_id, giong_mau_url, doi_chieu)
      SELECT ${phimId}, loai, ten, mo_ta, tieu_su, anh_ref, anh_mat, khoi_3d, giong, giong_model, giong_id, giong_mau_url, doi_chieu FROM xv_nhan_vat WHERE id = ${id} RETURNING id`))[0];
    if (!m) continue;
    doiNv.set(id, Number(m.id));
    for (const b of await t(sql`SELECT id FROM xv_bien_the WHERE nhan_vat_id = ${id} ORDER BY id`)) {
      const mb = (await t(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, anh_url) SELECT ${Number(m.id)}, nhom, ten, mo_ta, anh_url FROM xv_bien_the WHERE id = ${Number(b.id)} RETURNING id`))[0]!;
      doiBt.set(Number(b.id), Number(mb.id));
    }
  }
  const pc = ((tap.phan_canh as { ten: string }[]) ?? []).filter((p) => p.ten === pd);
  const tapMoi = Number((await t(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, trang_thai, brief, beats, phan_canh)
    SELECT ${phimId}, 1, ten || ${` · ${pd}`}, kich_ban, tom_tat, trang_thai, brief, beats, ${JSON.stringify(pc)}::jsonb FROM xv_tap WHERE id = ${tapId} RETURNING id`))[0]!.id);
  for (const [i, c] of canh.entries()) {
    const nv = ((c.nhan_vat as number[]) ?? []).map((x) => doiNv.get(Number(x))).filter((x): x is number => x != null);
    const bt = ((c.bien_the as number[]) ?? []).map((x) => doiBt.get(Number(x))).filter((x): x is number => x != null);
    await t(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, hanh_dong_vi, loi_thoai, am_thanh, thoi_luong_s, nhan_vat, prompt_anh, prompt_video, keyframe_url, keyframe_uv, trang_thai, bien_the, phan_doan, cam_xuc, ky_thuat, thoai, trang_phuc, phat_s, chu_man, dan_dung, bieu_cam)
      SELECT ${tapMoi}, ${i + 1}, canh, goc_may, hanh_dong, hanh_dong_vi, loi_thoai, am_thanh, thoi_luong_s, ${JSON.stringify(nv)}::jsonb, prompt_anh, prompt_video, keyframe_url, ${JSON.stringify(c.keyframe_url ? [c.keyframe_url] : [])}::jsonb,
        ${c.keyframe_url ? 'co_keyframe' : 'nhap'}, ${JSON.stringify(bt)}::jsonb, phan_doan, cam_xuc, ky_thuat, thoai, trang_phuc, phat_s, chu_man, dan_dung, bieu_cam
      FROM xv_canh WHERE id = ${Number(c.id)}`);
  }
  return { phimId, tapMoi, soShot: canh.length, soNhanVat: doiNv.size };
});
console.log(JSON.stringify(ketQua));
process.exit(0);
