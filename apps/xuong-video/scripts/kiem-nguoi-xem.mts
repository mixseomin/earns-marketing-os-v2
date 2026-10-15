// "🧑 Kiểm người xem có hiểu không" cho một tập — TỐN TIỀN (2 lượt Claude, ~$0.07); cùng lõi nút trong studio.
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-nguoi-xem.mts <tap_id>
import { getDb } from '@mos2/db';
import { kiemNguoiXemTap, kiemNguoiXemCanh } from '../src/lib/xuong-video/kiem-nguoi-xem';
// --canh=<tên phân cảnh>: kiểm RIÊNG một cảnh (rẻ hơn) — cổng tính cảnh đó là qua khi đạt.
const canh = (process.argv.find((a) => a.startsWith('--canh=')) ?? '').slice(7);
const r = canh ? await kiemNguoiXemCanh(getDb()!, Number(process.argv[2]), canh) : await kiemNguoiXemTap(getDb()!, Number(process.argv[2]));
console.log(JSON.stringify(r, null, 2));
process.exit(0);
