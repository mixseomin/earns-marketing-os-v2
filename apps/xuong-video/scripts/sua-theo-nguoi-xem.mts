// "✍ Sửa kịch bản theo góp ý" cho một tập — TỐN TIỀN (1 lượt Claude ~$0.12); cùng lõi nút trong studio. Ghi DB (↶ hoàn tác được).
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sua-theo-nguoi-xem.mts <tap_id>
import { getDb } from '@mos2/db';
import { suaTheoNguoiXemTap } from '../src/lib/xuong-video/kiem-nguoi-xem';
console.log(JSON.stringify(await suaTheoNguoiXemTap(getDb()!, Number(process.argv[2]), 'script sua-theo-nguoi-xem'), null, 2));
process.exit(0);
