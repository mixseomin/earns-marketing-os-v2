// 🔁 VÒNG TỰ-SỬA KHUNG (B6, anh 30/10/2026: SỬA TỪ PROMPT NGUỒN, không vá ảnh — nối siết vào pipeline thật sinhKeyframeCanh, rẻ + giữ trang phục):
//   đối chiếu khung hiện tại → lệch → sietTuLech ($0) nối vào prompt nguồn → SINH LẠI cả khung qua sinhKeyframeCanh (hai bước / ghép từng người)
//   → chờ ảnh mới → bóc + đối chiếu lại → lặp ≤ --vong vòng tới khi HẾT LỆCH (cổng). Mỗi vòng một ảnh mới vào keyframe_uv; đường ≥2 người tự promote.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/vong-sua.mts --canh=1824 [--luc=dau|cuoi] [--vong=3] [--ghi]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { bocTachKhung } from '../src/lib/xuong-video/boc-tach-khung';
import { thanhPhanDuKien, doiChieuKhung, apDungSoBang, sietTuLech } from '../src/lib/xuong-video/doi-chieu-khung';
import { sinhKeyframeCanh } from '../src/lib/xuong-video/sinh-anh';
import { lookMang } from '../src/lib/xuong-video/bo-set-3d';
import { khongGianTap } from './phieu-shot.mts';
import { arr, n, s } from '../src/lib/xuong-video/doc-db';
import type { BocTachKhung, DongDoiChieu, PhanCanh } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const canhId = Number(gia('canh') || 0);
const luc = (gia('luc') || 'dau') as 'dau' | 'cuoi';
const toiDa = Math.max(1, Math.min(3, Number(gia('vong') || 3)));
const ghi = process.argv.includes('--ghi');
if (!canhId) { console.error('cần --canh=<id>'); process.exit(1); }
if (luc === 'cuoi') { console.error('vòng tự-sửa mới nối cho keyframe MỞ (đầu) — sinhKeyframeCanh chưa sinh khung KẾT; chạy --luc=dau'); process.exit(1); }
const db = getDb()!;

const col = luc === 'cuoi' ? 'keyframe_ket' : 'keyframe_url';
const lo = (ch: DongDoiChieu[] | null | undefined) => (ch ?? []).filter((x) => x.muc !== 'khớp' && x.muc !== 'gần');
const inLo = (ch: DongDoiChieu[] | null | undefined) => lo(ch).map((x) => `${x.thanh_phan}(${x.muc})`).join(', ') || 'không';

async function nap() {
  const row = ((await db.execute(sql`SELECT c.*, t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[])[0];
  if (!row) { console.error(`không thấy canh ${canhId}`); process.exit(1); }
  const c = mapCanh(row); const phimId = Number(row.phim_id);
  const nhanVat = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const kg = await khongGianTap(c.tap_id, c.phan_doan ?? '').catch(() => null);
  // SỔ TRANG PHỤC CARRY (bo-set-3d.ts › lookMang): áo + VẾT của shot — cùng nguồn với prompt (boiCanhCanh.look), để đối chiếu có lá Vết áo từ biến thể nhóm `vet`
  const pc = ((await db.execute(sql`SELECT phan_canh FROM xv_tap WHERE id = ${c.tap_id}`)) as unknown as Row[])[0]?.phan_canh;
  const dsLook = ((await db.execute(sql`SELECT id, canh, nhan_vat, bien_the FROM xv_canh WHERE tap_id = ${c.tap_id} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[])
    .map((x) => ({ id: n(x.id), canh: s(x.canh), nhan_vat: arr<number>(x.nhan_vat).map(Number), bien_the: arr<number>(x.bien_the).map(Number) }));
  const look = lookMang(dsLook, nhanVat, (pc ?? []) as PhanCanh[]).get(canhId);
  return { c, phimId, nhanVat, kg, look };
}

// ĐỐI CHIẾU một keyframe url → danh sách lệch (bóc Gemini + so dự kiến + SO BẰNG enum). null = bóc hỏng.
async function doiChieu(phimId: number, url: string, c: Awaited<ReturnType<typeof nap>>['c'], nhanVat: Awaited<ReturnType<typeof nap>>['nhanVat'], kg: Awaited<ReturnType<typeof nap>>['kg'], look: Awaited<ReturnType<typeof nap>>['look']): Promise<DongDoiChieu[] | null> {
  const rb = await bocTachKhung(db, phimId, url, nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten));
  if (!rb) return null;
  const d = await doiChieuKhung(db, phimId, thanhPhanDuKien(c, nhanVat, kg, luc, look), rb as BocTachKhung);
  return d ? apDungSoBang(d, c, nhanVat, kg, luc, rb as BocTachKhung) : null;
}

// Chờ ảnh mới sau sinhKeyframeCanh: đường ≥2 người ghi đồng bộ (keyframe_url đổi ngay); hai bước chạy nền → poll keyframe_uv dài thêm / keyframe_url đổi / loi.
async function choAnhMoi(urlCu: string | null, uvLen: number): Promise<{ url: string | null; loi: string }> {
  for (let i = 0; i < 100; i++) {   // ~300s
    const r = ((await db.execute(sql`SELECT ${sql.raw(col)} AS url, keyframe_uv, loi FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[])[0];
    const url = r?.url ? String(r.url) : null; const uv = (r?.keyframe_uv ?? []) as string[]; const loi = String(r?.loi ?? '');
    if (loi) return { url: null, loi };
    if (url && url !== urlCu) return { url, loi: '' };          // promote đồng bộ (ghép từng người)
    if (uv.length > uvLen) return { url: uv[uv.length - 1]!, loi: '' };   // biến thể mới (hai bước / một bước)
    await new Promise((s) => setTimeout(s, 3000));
  }
  return { url: null, loi: 'quá giờ chờ ảnh mới (300s)' };
}

const giaCanh = async () => Number(((await db.execute(sql`SELECT chi_phi_cents FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[])[0]?.chi_phi_cents ?? 0);

let { c, phimId, nhanVat, kg, look } = await nap();
const urlDau = luc === 'cuoi' ? c.keyframe_ket : c.keyframe_url;
if (!urlDau) { console.error(`canh ${canhId} chưa có keyframe ${luc}`); process.exit(1); }

// LỆCH ĐẦU: bản đã lưu nếu có, không thì bóc ảnh hiện tại
let lech = c.boc_tach?.doi_chieu?.[luc] ?? null;
if (!lech) lech = await doiChieu(phimId, urlDau, c, nhanVat, kg, look);
if (lech === null) { console.error('bóc ảnh đầu hỏng'); process.exit(1); }
const lechDau = lech;
console.log(`\n=== #${canhId} · khung ${luc.toUpperCase()} · tối đa ${toiDa} vòng ===`);
console.log(`LỆCH ĐẦU (${lo(lechDau).length}): ${inLo(lechDau)}`);

// Sinh lại từ prompt nguồn mỗi vòng là MỘT lần sinh gần như ngẫu nhiên (sửa điểm siết nhưng có thể đẻ lệch mới) + bóc đối chiếu không ổn định →
// vòng lặp KHÔNG hội tụ đơn điệu (#1824 30/10/2026: 5→3→5→4, có vòng đẻ người thừa). Nên: GIỮ bản ít-lệch-nhất qua mọi vòng (không lấy vòng cuối),
// DỪNG khi 2 vòng liền không hạ được kỷ lục (chững) — không đốt tiền thêm vào bản xấu hơn. Promote bản ít-lệch-nhất.
const giaTruoc = await giaCanh();
let best = { url: urlDau, lech: lechDau };   // bản ít lệch nhất từng thấy (gồm cả ảnh đầu)
lech = lechDau; let vong = 0; let chung = 0;   // `lech` đã khai ở LỆCH ĐẦU — chỉ gán lại giá trị chạy vòng (không khai trùng)
const nhatKy: string[] = [];
while (lo(lech).length && vong < toiDa && chung < 2) {
  vong++;
  const siet = sietTuLech(lech);
  if (!siet) break;
  console.log(`\n--- VÒNG ${vong}: siết ${lo(lech).length} lệch → sinh lại qua pipeline thật ---`);
  const rCanh = ((await db.execute(sql`SELECT ${sql.raw(col)} AS url, keyframe_uv FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[])[0];
  const urlCu = rCanh?.url ? String(rCanh.url) : null; const uvLen = ((rCanh?.keyframe_uv ?? []) as string[]).length;
  const r = await sinhKeyframeCanh(db, canhId, 1, undefined, undefined, true, siet);   // thu=true: shot đã có keyframe, sinh lại — bỏ qua cổng "tập chưa qua quy trình"
  if (!r.ok) { console.error(`sinh lại hỏng: ${r.loi}`); break; }
  const { url, loi } = await choAnhMoi(urlCu, uvLen);
  if (!url) { console.error(`chờ ảnh hỏng: ${loi}`); break; }
  ({ c, phimId, nhanVat, kg, look } = await nap());   // nạp lại trạng thái (keyframe_url có thể đã đổi)
  const lechMoi = await doiChieu(phimId, url, c, nhanVat, kg, look);
  if (lechMoi === null) { console.error('bóc ảnh mới hỏng'); break; }
  const kyLuc = lo(lechMoi).length < lo(best.lech).length;   // hạ kỷ lục ít-lệch?
  if (kyLuc) { best = { url, lech: lechMoi }; chung = 0; } else chung++;
  nhatKy.push(`vòng ${vong}: ${lo(lech).length} → ${lo(lechMoi).length} lệch${kyLuc ? ' ✓ ít nhất' : ` (chững ${chung})`}${lo(lechMoi).length ? ` · còn: ${inLo(lechMoi)}` : ' — ĐẠT'} · ${url}`);
  lech = lechMoi;
}

const dat = lo(best.lech).length === 0;
console.log(`\n--- KẾT ---`);
nhatKy.forEach((x) => console.log(`  ${x}`));
console.log(`\nLỆCH ĐẦU ${lo(lechDau).length} → ÍT NHẤT ${lo(best.lech).length} sau ${vong} vòng${chung >= 2 ? ' (dừng vì 2 vòng liền không giảm)' : ''} · ${dat ? '✅ ĐẠT (cổng mở — cho ráp clip)' : '⛔ CHƯA ĐẠT (cổng đóng — còn ' + inLo(best.lech) + ')'}`);
console.log(`chi phí ${vong} vòng: ${(await giaCanh()) - giaTruoc}¢ · bản ít lệch nhất: ${best.url}`);

if (ghi && best.url !== urlDau) {
  await db.execute(sql`UPDATE xv_canh SET ${sql.raw(col)} = ${best.url}, updated_at = now() WHERE id = ${canhId}`);
  console.log(`✓ đã promote ${col} = ${best.url} (bản ít lệch nhất)`);
} else if (!ghi) console.log('(test, chưa promote keyframe — thêm --ghi để chốt bản ít lệch nhất)');
process.exit(0);
