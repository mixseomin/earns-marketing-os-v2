// KHỚP THẺ SHOT THEO 3D (13/11/2026, anh: "luật là não của mày, không tin được — phải dùng code"): sửa phần CHỮ của thẻ shot cho khớp máy ảo đã dựng,
// thay vì người gõ tay từng shot. Ba việc, đều do hàm cổng đo ra (cùng hàm nút sinh keyframe đọc):
//   1. nhan_vat: bỏ đồ vật (đạo cụ / sản phẩm) không có trong chỗ đứng 3D của shot — thẻ chép từ shot mẫu mang theo "Tờ 5 nghìn" ở shot sau khi đã trao
//   2. ky_thuat.goc: khai lại theo góc ngẩng THẬT của máy ảo (bo-set-3d.ts › gocNgang / GOC_NGANG) khi gocMayLech báo lệch
//   3. ky_thuat.co_canh: nới một bậc (cu → mcu → ms → ws) khi coCanhLech báo nhân vật chính nhỏ hơn sàn của cỡ đang khai
//   4. ô THẺ SHOT còn trống (bố cục 3 lớp · hướng · diễn): điền từ 3D — bố cục = moTaThay(khung_xam.thay), hướng = huongVoiMay + nhinCau từng người
//      trong khung, diễn = cách diễn của thoại + hành động chính. Ô đã có chữ thì giữ (người viết thắng máy).
// Mỗi shot đổi chụp bản cũ (hoan-tac.ts). 0đ.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/khop-the-3d.mts <tap_id> [--ghi]   (không --ghi = chỉ in)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import { gocNgang, gocMayLech, coCanhLech, GOC_NGANG, moTaThay, huongVoiMay, nhinCau, chuThe } from '../src/lib/xuong-video/bo-set-3d';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
const db = getDb()!; const tapId = Number(process.argv[2]); const ghi = process.argv.includes('--ghi');
const tap = ((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0]; if (!tap) { console.error('không thấy tập'); process.exit(1); }
const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(tap.phim_id)}`)) as unknown as Row[]).map(mapNhanVat);
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
const laNv = (t: string) => nv.some((x) => x.loai === 'nhan_vat' && x.ten === t);
const laNguoi = (t: string) => nv.some((x) => x.ten === t && x.loai === 'nhan_vat' && (x.khoi_3d as { hinh?: string } | null)?.hinh === 'nguoi');
const RONG: Record<string, string> = { ecu: 'cu', cu: 'mcu', mcu: 'ms', ms: 'ws', two: 'ws', ots: 'ms' };
/** góc khai khớp góc ngẩng đo được (độ, + = máy cao nhìn xuống): khoá đầu tiên theo thứ tự ưu tiên chứa số đo */
const gocTheo = (e: number) => (['ngang', 'thap', 'cao', 'tren_xuong', 'sat_dat'] as const).find((k) => GOC_NGANG[k] && e >= GOC_NGANG[k]![0] && e <= GOC_NGANG[k]![1]) ?? 'ngang';
let doi = 0;
for (const c of ds) {
  if (!c.may_3d) continue;
  const coMat = new Set(c.may_3d.vi_tri.map((v) => v.ten));
  const nvMoi = c.nhan_vat.filter((id) => { const v = nv.find((x) => x.id === id); return !v || !['dao_cu', 'san_pham'].includes(v.loai) || coMat.has(v.ten); });
  const kt = { ...(c.ky_thuat ?? {}) } as Record<string, unknown>; const ghiChu: string[] = [];
  if (nvMoi.length !== c.nhan_vat.length) ghiChu.push(`bỏ ${c.nhan_vat.filter((id) => !nvMoi.includes(id)).map((id) => nv.find((x) => x.id === id)?.ten).join(', ')}`);
  if (gocMayLech(c.may_3d, kt.goc as string | undefined)) { const g = gocTheo(gocNgang(c.may_3d)); ghiChu.push(`góc ${kt.goc} → ${g} (máy ngẩng ${gocNgang(c.may_3d)}°)`); kt.goc = g; }
  if (coCanhLech(c, laNv, laNguoi).length && RONG[kt.co_canh as string]) { ghiChu.push(`cỡ ${kt.co_canh} → ${RONG[kt.co_canh as string]}`); kt.co_canh = RONG[kt.co_canh as string]; }
  // 4. ô thẻ trống — từ 3D
  const dd = { ...(c.dan_dung ?? {}) } as Record<string, string>; const m = c.may_3d;
  if (!dd.bo_cuc?.trim() && c.khung_xam?.thay?.length) { dd.bo_cuc = moTaThay(c.khung_xam.thay, undefined, c.khung_xam); ghiChu.push('điền bố cục từ 3D'); }
  if (!dd.huong?.trim()) {
    const nguoi = m.vi_tri.filter((v) => laNv(v.ten) && !v.an); const ct = chuThe(m).filter(laNv);
    const cau = nguoi.filter((v) => ct.includes(v.ten)).map((v) => { const h = huongVoiMay(m, v); const n = nhinCau(m, v, nguoi); return `${v.ten}: ${h?.chu ?? ''}${n ? `, ${n}` : ''}`; });
    if (cau.length) { dd.huong = cau.join('; '); ghiChu.push('điền hướng từ 3D'); }
  }
  if (!dd.dien?.trim()) { const d = [...(c.thoai ?? []).filter((x) => x.dien_xuat?.trim()).map((x) => `${x.nhan_vat}: ${x.dien_xuat}`), c.hanh_dong?.trim()].filter(Boolean).join('; '); if (d) { dd.dien = d; ghiChu.push('điền diễn từ thoại + hành động'); } }
  if (!ghiChu.length) continue;
  doi++; console.log(`#${c.thu_tu}: ${ghiChu.join(' · ')}`);
  if (!ghi) continue;
  await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['nhan_vat', 'ky_thuat', 'dan_dung'], moTa: `khớp thẻ shot theo 3D: ${ghiChu.join(' · ')}`, nguoi: 'khop-the-3d' });
  await db.execute(sql`UPDATE xv_canh SET nhan_vat = ${JSON.stringify(nvMoi)}::jsonb, ky_thuat = ${JSON.stringify(kt)}::jsonb, dan_dung = ${JSON.stringify(dd)}::jsonb, updated_at = now() WHERE id = ${c.id}`);
}
console.log(`— ${doi} shot ${ghi ? 'đã sửa' : 'sẽ sửa (thêm --ghi để ghi)'}`);
process.exit(0);
