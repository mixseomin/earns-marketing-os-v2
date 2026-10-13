// Tự kiểm trên box (chỉ đọc, 0đ): cổng "đang sinh thì không bấm lại" chạy được với driver thật.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-dang-sinh-am.mts
import { getDb } from '@mos2/db';
import { canhDangSinhAm } from '../src/lib/xuong-video/doc-db';
const db = getDb()!;
const a = await canhDangSinhAm(db, [268, 269, 270], 'thoai');
const b = await canhDangSinhAm(db, [], 'sfx');
console.log('thu-dang-sinh-am ok', [...a], [...b]);
process.exit(0);
