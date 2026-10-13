// DỰNG PHIM THỬ PHONG CÁCH (0đ): nhân bản một tập (phim + nhân vật + biến thể + tập + mọi shot) thành phim mới "<tên> (thử: <hướng>)" với
// câu phong cách của hướng đó (phong-cach-thu.ts); N shot đầu gắn sẵn keyframe thử mới nhất của hướng (scripts/thu-phong-cach.mts) →
// anh mở phim thử trong studio và bấm sinh video (Claude không tự sinh video). Phim gốc không bị đụng. Không cần nữa thì Lưu trữ.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nhan-ban-phim-thu.mts <tap_id> <huong> [so_shot=3]
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { HUONG_THU } from '../src/lib/xuong-video/phong-cach-thu';
import type { Row } from '../src/lib/xuong-video/doc-db';

const db = getDb()!;
const tapId = Number(process.argv[2]); const huong = HUONG_THU.find((h) => h.key === process.argv[3]); const so = Number(process.argv[4] ?? 3);
if (!tapId || !huong?.phong_cach) { console.error(`cần <tap_id> <huong: ${HUONG_THU.filter((h) => h.phong_cach).map((h) => h.key).join('|')}>`); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const tap = (await q(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`))[0]; if (!tap) { console.error('không thấy tập'); process.exit(1); }
const phimGoc = Number(tap.phim_id);
const ketQua = await db.transaction(async (tx) => {
  const t = async (s: ReturnType<typeof sql>) => (await tx.execute(s)) as unknown as Row[];
  const phim = (await t(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai)
    SELECT project, ten || ${` (thử: ${huong.ten.split(' (')[0]!.toLowerCase()})`}, loai, mo_ta, jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{phong_cach}', to_jsonb(${huong.phong_cach}::text)), trang_thai
    FROM xv_phim WHERE id = ${phimGoc} RETURNING id`))[0]!;
  const phimId = Number(phim.id);
  const doiNv = new Map<number, number>(); const doiBt = new Map<number, number>();
  for (const v of await t(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phimGoc} ORDER BY id`)) {
    const m = (await t(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, tieu_su, anh_ref, giong, giong_model, giong_id, giong_mau_url, doi_chieu)
      SELECT ${phimId}, loai, ten, mo_ta, tieu_su, anh_ref, giong, giong_model, giong_id, giong_mau_url, doi_chieu FROM xv_nhan_vat WHERE id = ${Number(v.id)} RETURNING id`))[0]!;
    doiNv.set(Number(v.id), Number(m.id));
    for (const b of await t(sql`SELECT id FROM xv_bien_the WHERE nhan_vat_id = ${Number(v.id)} ORDER BY id`)) {
      const mb = (await t(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, anh_url) SELECT ${Number(m.id)}, nhom, ten, mo_ta, anh_url FROM xv_bien_the WHERE id = ${Number(b.id)} RETURNING id`))[0]!;
      doiBt.set(Number(b.id), Number(mb.id));
    }
  }
  const tapMoi = Number((await t(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, trang_thai, brief, noi_khung, nhac_url, nhac_mo_ta, beats, phan_canh, nhac_phan_canh, thoi_luong_s, xuat, bai_dang, lop, thu_nguoi_xem)
    SELECT ${phimId}, so, ten, kich_ban, tom_tat, trang_thai, brief, noi_khung, nhac_url, nhac_mo_ta, beats, phan_canh, nhac_phan_canh, thoi_luong_s, '[]'::jsonb, bai_dang, lop, thu_nguoi_xem
    FROM xv_tap WHERE id = ${tapId} RETURNING id`))[0]!.id);
  const canh = await t(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`);
  let gan = 0;
  for (const c of canh) {
    const thuNay = coalesce(c.nhanh) === '' || c.nhanh === 'A' ? Number(c.thu_tu) <= so : false;
    const kf = thuNay ? (await t(sql`SELECT output_url FROM xv_job WHERE request->>'dich' = 'thu_phong_cach' AND request->>'huong' = ${huong.key} AND (request->>'canh')::int = ${Number(c.id)} AND trang_thai = 'xong' ORDER BY id DESC LIMIT 1`))[0]?.output_url : null;
    if (kf) gan++;
    const nv = ((c.nhan_vat as number[]) ?? []).map((x) => doiNv.get(Number(x))).filter((x): x is number => x != null);
    const bt = ((c.bien_the as number[]) ?? []).map((x) => doiBt.get(Number(x))).filter((x): x is number => x != null);
    await t(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, am_thanh, thoi_luong_s, nhan_vat, prompt_anh, prompt_video, keyframe_url, keyframe_uv, video_url, trang_thai, loi, chi_phi_cents, bien_the, video_cuoi_url, nguon_video, video_phien_ban, thoai_url, am_thanh_url, phan_doan, cam_xuc, ky_thuat, thoai, trang_phuc, phat_s, chu_man, nhanh, kieu_chu)
      SELECT ${tapMoi}, thu_tu, canh, goc_may, hanh_dong, loi_thoai, am_thanh, thoi_luong_s, ${JSON.stringify(nv)}::jsonb, prompt_anh, prompt_video, ${kf ?? null}, ${JSON.stringify(kf ? [kf] : [])}::jsonb, NULL, ${kf ? 'co_keyframe' : 'nhap'}, '', 0, ${JSON.stringify(bt)}::jsonb, NULL, '{}'::jsonb, '[]'::jsonb, thoai_url, am_thanh_url, phan_doan, cam_xuc, ky_thuat, thoai, trang_phuc, phat_s, chu_man, nhanh, kieu_chu
      FROM xv_canh WHERE id = ${Number(c.id)}`);
  }
  return { phimId, tapMoi, soShot: canh.length, ganKeyframe: gan };
});
function coalesce(x: unknown) { return x == null ? '' : String(x); }
console.log(JSON.stringify(ketQua));
process.exit(0);
