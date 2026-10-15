// "🧑 Kiểm người xem có hiểu không" cho một tập — TỐN TIỀN (2 lượt Claude, ~$0.07); cùng lõi nút trong studio.
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-nguoi-xem.mts <tap_id>
// --canh=<tên phân cảnh>: kiểm RIÊNG một cảnh (rẻ hơn) — cổng tính cảnh đó là qua khi đạt.
//   --in: chỉ IN đúng lời dặn + đầu vào người xem của cảnh (0đ) — để người kiểm trong phiên tự chấm trên cùng chữ với lượt API.
//   --tu-cham=<tệp.json> { xem: {ke_lai, ai, muon, can, lat, ket, diem, cho_kho, cat}, doi: {khop, lech}, nguoi }: ghi kết quả tự chấm (0đ, không gọi API).
import { readFileSync } from 'node:fs';
import { getDb } from '@mos2/db';
import { kiemNguoiXemTap, kiemNguoiXemCanh, dauVaoNguoiXemCanh } from '../src/lib/xuong-video/kiem-nguoi-xem';
import { heNguoiXem, vaoNguoiXem, NguoiXemSchema, NguoiXemQcSchema, DoiChieuYSchema } from '../src/lib/xuong-video/claude';
const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const tap = Number(process.argv[2]); const canh = gia('canh'); const tu = gia('tu-cham');
if (canh && process.argv.includes('--in')) {
  const v = await dauVaoNguoiXemCanh(getDb()!, tap, canh);
  if (!v.ok) { console.error(v.loi); process.exit(1); }
  console.log(`=== LỜI DẶN NGƯỜI XEM ===\n${heNguoiXem(v.kt, v.doDai, v.qc)}\n\n=== ĐẦU VÀO ===\n${vaoNguoiXem({ ban: v.ban, nhanVat: v.nvTa })}\n\n=== Ý ĐỒ (chỉ lượt đối chiếu được thấy) ===\n${v.yDo}\n${v.brief}`);
  process.exit(0);
}
let tuCham: Parameters<typeof kiemNguoiXemCanh>[3];
if (tu) { const j = JSON.parse(readFileSync(tu, 'utf8')); tuCham = { xem: (j.qc ? NguoiXemQcSchema : NguoiXemSchema).parse(j.xem), doi: DoiChieuYSchema.parse(j.doi), nguoi: String(j.nguoi || 'tự chấm') }; }
const r = canh ? await kiemNguoiXemCanh(getDb()!, tap, canh, tuCham) : await kiemNguoiXemTap(getDb()!, tap);
console.log(JSON.stringify(r, null, 2));
process.exit(0);
