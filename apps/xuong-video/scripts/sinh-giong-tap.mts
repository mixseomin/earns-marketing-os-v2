// Sinh giọng cho một tập (TỐN TIỀN — chỉ chạy khi anh bảo; tiền tố DUYET_SINH_1_LAN=1). Cùng lõi nút 🗣 trong studio.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-giong-tap.mts <tap_id> [--lai <canh_id,…>]
//   mặc định: chỉ dòng còn thiếu giọng; --lai: đọc lại toàn bộ dòng của các shot nêu (vd sau khi đổi giọng nhân vật).
import { getDb } from '@mos2/db';
import { sinhGiongShots } from '../src/lib/xuong-video/sinh-giong';
const db = getDb()!;
const tap = Number(process.argv[2]);
const i = process.argv.indexOf('--lai');
if (i > 0) console.log('đọc lại', JSON.stringify(await sinhGiongShots(db, tap, process.argv[i + 1]!.split(',').map(Number))));
console.log('dòng thiếu', JSON.stringify(await sinhGiongShots(db, tap, undefined, { chiThieu: true })));
process.exit(0);
