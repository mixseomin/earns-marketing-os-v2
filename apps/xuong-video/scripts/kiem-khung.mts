// 🔍 Kiểm khung cho một tập trên box (khung.ts / kiem-khung.ts) — cùng lõi nút trên lưới.
//   mặc định: CHỈ ƯỚC (0đ) — số khối cảnh cần kiểm + giá · --chay: kiểm thật (TỐN TIỀN) · --tat-ca: kiểm lại mọi khối · --duyet-tay=<canh_id>: người nhận khung (0đ)
//   TỰ CHẤM 0đ (Claude trong phiên, cùng lời dặn + cùng ảnh như lượt API): --in → in lời dặn + thẻ shot + URL ảnh từng khối; xem ảnh rồi
//   --tu-cham=<tệp.json> { shot: [{ shot, loi: [{ loai, mo_ta, sua }] }] } (+ --nguoi=<tên>) → ghi kiem_khung như lượt API
// cd apps/xuong-video && [DUYET_SINH_1_LAN=1] NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-khung.mts <tap_id> [--chay] [--tat-ca]
import { getDb } from '@mos2/db';
import { readFileSync } from 'node:fs';
import { kiemKhungTap, duyetKhungTay, dauVaoKiemKhung, ghiKiemKhung } from '../src/lib/xuong-video/kiem-khung';
import { heKiemKhung, KiemKhungSchema } from '../src/lib/xuong-video/claude';
import { tenLoiKhung } from '../src/lib/xuong-video/khung';
const db = getDb()!; const tap = Number(process.argv[2]); const co = (k: string) => process.argv.includes(k);
const tay = process.argv.find((a) => a.startsWith('--duyet-tay='));
if (tay) { console.log(JSON.stringify(await duyetKhungTay(db, Number(tay.split('=')[1]), 'script'))); process.exit(0); }
if (co('--in')) {
  const v = await dauVaoKiemKhung(db, tap, co('--tat-ca')); if (!v) { console.error('không thấy tập'); process.exit(1); }
  console.log(`=== LỜI DẶN ===\n${heKiemKhung(v.kt.phong_cach, v.kt.ban_do ?? '')}\n`);
  for (const k of v.khoi) {
    console.log(`=== KHỐI · CẢNH: ${k.canh} ===`);
    if (k.truoc) console.log(`── KHUNG CUỐI CẢNH TRƯỚC #${k.truoc.so} (chỉ để so cú chuyển): ${k.truoc.url}\n${k.truoc.the}`);
    for (const x of k.shot) console.log(`── SHOT #${x.so}\nảnh: ${x.url}\nkhung xám 3D: ${x.xam ?? '—'}\n${x.the}`);
  }
  process.exit(0);
}
const tu = process.argv.find((a) => a.startsWith('--tu-cham='));
if (tu) {
  const ds = KiemKhungSchema.shape.shot.parse(JSON.parse(readFileSync(tu.slice('--tu-cham='.length), 'utf8')).shot);
  const nguoi = (process.argv.find((a) => a.startsWith('--nguoi=')) ?? '--nguoi=Claude trong phiên (tự chấm)').slice(8);
  const lech = await ghiKiemKhung(db, tap, ds, nguoi);
  console.log(`tự chấm: ghi ${ds.length} khung · lệch ${lech.length}`); for (const l of lech) for (const x of l.loi) console.log(`#${l.thu_tu} ⚠ ${tenLoiKhung(x.loai)}: ${x.mo_ta}`);
  process.exit(0);
}
const r = await kiemKhungTap(db, tap, { tatCa: co('--tat-ca'), uoc: !co('--chay') });
if (!r.ok) { console.error(r.loi); process.exit(1); }
console.log(`${co('--chay') ? 'đã kiểm' : 'ƯỚC'}: ${r.data.khoi} khối · ${r.data.shot} khung · $${(r.data.cents / 100).toFixed(3)}`);
for (const l of r.data.lech) for (const x of l.loi) console.log(`#${l.thu_tu} ⚠ ${tenLoiKhung(x.loai)}: ${x.mo_ta}\n     → ${x.sua}`);
process.exit(0);
