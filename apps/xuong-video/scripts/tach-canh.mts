// ✂ Tách cảnh một tập trên box — TỐN TIỀN (1 lượt Claude); cùng lõi nút ✂ Tách cảnh (tach-canh-tap.ts).
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tach-canh.mts <tap_id> [so_canh=0 (tự)] [giay]
import { getDb } from '@mos2/db';
import { tachCanhTapDb } from '../src/lib/xuong-video/tach-canh-tap';
const [tap, so, giay] = process.argv.slice(2).map(Number);
console.log(JSON.stringify(await tachCanhTapDb(getDb()!, tap!, so || 0, 'claude (script)', giay || undefined)));
process.exit(0);
