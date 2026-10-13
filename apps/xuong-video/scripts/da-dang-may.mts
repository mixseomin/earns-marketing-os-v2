// 🎥 Đa dạng chuyển động máy cả tập (nhịp hình) — 0đ, ↶ Hoàn tác được; cùng lõi nút trong thanh 🎬 (hau-ky.ts › daDangMayTapDb).
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/da-dang-may.mts <tap_id>
import { getDb } from '@mos2/db';
import { daDangMayTapDb } from '../src/lib/xuong-video/hau-ky';
console.log(`đổi chuyển động máy ${await daDangMayTapDb(getDb()!, Number(process.argv[2]), 'claude (script)')} shot`);
process.exit(0);
