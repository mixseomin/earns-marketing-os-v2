// 🔍 Kiểm khung cho một tập trên box (khung.ts / kiem-khung.ts) — cùng lõi nút trên lưới.
//   mặc định: CHỈ ƯỚC (0đ) — số khối cảnh cần kiểm + giá · --chay: kiểm thật (TỐN TIỀN) · --tat-ca: kiểm lại mọi khối · --duyet-tay=<canh_id>: người nhận khung (0đ)
// cd apps/xuong-video && [DUYET_SINH_1_LAN=1] NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-khung.mts <tap_id> [--chay] [--tat-ca]
import { getDb } from '@mos2/db';
import { kiemKhungTap, duyetKhungTay } from '../src/lib/xuong-video/kiem-khung';
import { tenLoiKhung } from '../src/lib/xuong-video/khung';
const db = getDb()!; const tap = Number(process.argv[2]); const co = (k: string) => process.argv.includes(k);
const tay = process.argv.find((a) => a.startsWith('--duyet-tay='));
if (tay) { console.log(JSON.stringify(await duyetKhungTay(db, Number(tay.split('=')[1]), 'script'))); process.exit(0); }
const r = await kiemKhungTap(db, tap, { tatCa: co('--tat-ca'), uoc: !co('--chay') });
if (!r.ok) { console.error(r.loi); process.exit(1); }
console.log(`${co('--chay') ? 'đã kiểm' : 'ƯỚC'}: ${r.data.khoi} khối · ${r.data.shot} khung · $${(r.data.cents / 100).toFixed(3)}`);
for (const l of r.data.lech) for (const x of l.loi) console.log(`#${l.thu_tu} ⚠ ${tenLoiKhung(x.loai)}: ${x.mo_ta}\n     → ${x.sua}`);
process.exit(0);
