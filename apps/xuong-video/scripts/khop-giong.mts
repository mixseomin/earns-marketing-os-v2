// Khớp giây phát theo giọng cho một tập (0đ: chỉ ffmpeg cắt lặng trên box + ghi giây; ↶ hoàn tác được) — cùng lõi nút ⏱ và lúc giọng vừa về.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/khop-giong.mts <tap_id>
import { getDb } from '@mos2/db';
import { khopGiongTap } from '../src/lib/xuong-video/hau-ky';
const tap = Number(process.argv[2]);
console.log(JSON.stringify(await khopGiongTap(getDb()!, tap, 'script khop-giong')));
process.exit(0);
