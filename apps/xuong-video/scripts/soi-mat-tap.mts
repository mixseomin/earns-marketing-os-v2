// 👤 Soi mặt cả tập trên box (0đ — OpenCV YuNet + SFace chạy CPU, soi-mat.ts › soiMatTap) — cùng lõi nút "Soi mặt" trên lưới kịch bản.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soi-mat-tap.mts <tap_id> [--tat-ca] [--thu]
//   --tat-ca: soi lại cả keyframe đã soi · --thu: chạy thử, không ghi DB
import { getDb } from '@mos2/db';
import { soiMatTap } from '../src/lib/xuong-video/soi-mat';
const tap = Number(process.argv[2]);
if (!tap) { console.error('thiếu <tap_id>'); process.exit(1); }
const r = await soiMatTap(getDb()!, tap, { tatCa: process.argv.includes('--tat-ca'), ghi: !process.argv.includes('--thu') });
console.log(JSON.stringify(r, null, 2));
process.exit(r.ok ? 0 : 1);
