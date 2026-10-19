// NHÂN BẢN MỘT TẬP thành PHIM MỚI để dựng / chấm lại mà không đụng phim gốc (anh 19/10/2026: "clone từ phim 122 sang một phiên bản mới với các
// shot 3D … review, chấm điểm trên chúng"). 0đ. Chép phim + bộ set + nhân vật + biến thể + tập + mọi shot, nối lại khoá (phim_id, bo_set_id,
// nhan_vat_id, nhan_vat[] / bien_the[] của shot). Cột lấy từ information_schema — bảng thêm cột thì bản sao tự mang theo (nhan-ban-phim-thu.mts
// chép tay danh sách cột nên sót may_3d, dan_dung, khoi_3d, bộ set…). Phần ĐÃ SINH của shot (keyframe, video, khung 3D, kết quả soi / kiểm, chi phí)
// để trống: bản sao dựng lại từ đầu theo mã hiện tại.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nhan-ban-tap.mts <tap_id> [--ten="(bản 3D)"]
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import type { Row } from '../src/lib/xuong-video/doc-db';

const tapId = Number(process.argv[2]); if (!tapId) { console.error('cần <tap_id>'); process.exit(1); }
const duoi = (process.argv.find((a) => a.startsWith('--ten=')) ?? '--ten=(bản 3D)').slice(6);
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
/** Cột của shot là KẾT QUẢ SINH / ĐO — bản sao để trống (giá trị = biểu thức SQL). */
const SHOT_TRONG: Record<string, string> = {
  keyframe_url: 'NULL', keyframe_uv: `'[]'::jsonb`, keyframe_ket: 'NULL', keyframe_giua: 'NULL', video_url: 'NULL', video_cuoi_url: 'NULL', nguon_video: 'NULL',
  video_phien_ban: `'[]'::jsonb`, thoai_url: 'NULL', am_thanh_url: 'NULL', khung_xam: 'NULL', kiem_khung: 'NULL', soi_mat: 'NULL', soi_clip: 'NULL', diem_prompt: 'NULL',
  soat: 'NULL', trang_thai: `'nhap'`, loi: `''`, chi_phi_cents: '0',
};

const ketQua = await db.transaction(async (tx) => {
  const q = async (s: ReturnType<typeof sql>) => (await tx.execute(s)) as unknown as Row[];
  const cot = async (bang: string) => (await q(sql`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = ${bang} ORDER BY ordinal_position`))
    .map((r) => ({ ten: String(r.column_name), kieu: String(r.data_type), rong: r.is_nullable === 'YES', mac: r.column_default == null ? null : String(r.column_default) }))
    .filter((c) => !['id', 'created_at', 'updated_at'].includes(c.ten));
  /** INSERT … SELECT mọi cột, đè một số cột bằng biểu thức SQL; trả id mới. */
  const chep = async (bang: string, id: number, de: Record<string, string>): Promise<number> => {
    const cs = await cot(bang);
    const ten = cs.map((c) => `"${c.ten}"`).join(', ');
    // để trống (NULL) cột KHÔNG nhận NULL → lấy giá trị mặc định của chính cột (vd nguon_video)
    const gt = cs.map((c) => (c.ten in de ? (de[c.ten] === 'NULL' && !c.rong ? (c.mac ?? `''`) : `${de[c.ten]}`) : `"${c.ten}"`)).join(', ');
    return Number((await q(sql.raw(`INSERT INTO ${bang} (${ten}) SELECT ${gt} FROM ${bang} WHERE id = ${Number(id)} RETURNING id`)))[0]!.id);
  };
  const lit = (x: unknown) => `'${JSON.stringify(x).replace(/'/g, "''")}'::jsonb`;
  const tap = (await q(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`))[0]; if (!tap) throw new Error('không thấy tập');
  const phimGoc = Number(tap.phim_id);
  const phim = await chep('xv_phim', phimGoc, { ten: `ten || ' ' || '${duoi.replace(/'/g, "''")}'`, poster_url: 'NULL', poster_uv: `'[]'::jsonb` });
  const doiSet = new Map<number, number>();
  for (const s of await q(sql`SELECT id FROM xv_bo_set WHERE phim_id = ${phimGoc} ORDER BY id`)) doiSet.set(Number(s.id), await chep('xv_bo_set', Number(s.id), { phim_id: String(phim) }));
  const doiNv = new Map<number, number>(); const doiBt = new Map<number, number>();
  for (const v of await q(sql`SELECT id, bo_set_id FROM xv_nhan_vat WHERE phim_id = ${phimGoc} ORDER BY id`)) {
    const bs = v.bo_set_id != null ? doiSet.get(Number(v.bo_set_id)) : undefined;
    const m = await chep('xv_nhan_vat', Number(v.id), { phim_id: String(phim), bo_set_id: bs != null ? String(bs) : v.bo_set_id != null ? String(v.bo_set_id) : 'NULL' });
    doiNv.set(Number(v.id), m);
    for (const b of await q(sql`SELECT id FROM xv_bien_the WHERE nhan_vat_id = ${Number(v.id)} ORDER BY id`)) doiBt.set(Number(b.id), await chep('xv_bien_the', Number(b.id), { nhan_vat_id: String(m) }));
  }
  const tapMoi = await chep('xv_tap', tapId, { phim_id: String(phim), xuat: `'[]'::jsonb`, video_url: 'NULL' });
  const canh = await q(sql`SELECT id, nhan_vat, bien_the FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`);
  const cotShot = new Set((await cot('xv_canh')).map((c) => c.ten));
  const trong = Object.fromEntries(Object.entries(SHOT_TRONG).filter(([k]) => cotShot.has(k)));
  for (const c of canh) {
    const nv = ((c.nhan_vat as number[]) ?? []).map((x) => doiNv.get(Number(x))).filter((x): x is number => x != null);
    const bt = ((c.bien_the as number[]) ?? []).map((x) => doiBt.get(Number(x))).filter((x): x is number => x != null);
    await chep('xv_canh', Number(c.id), { ...trong, tap_id: String(tapMoi), nhan_vat: lit(nv), bien_the: lit(bt) });
  }
  return { phim_goc: phimGoc, phim_moi: phim, tap_moi: tapMoi, shot: canh.length, nhan_vat: doiNv.size, bien_the: doiBt.size, bo_set: doiSet.size };
});
console.log(JSON.stringify(ketQua));
process.exit(0);
