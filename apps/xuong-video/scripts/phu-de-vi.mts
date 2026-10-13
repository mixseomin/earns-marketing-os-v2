// Bản phụ đề Việt cho một tập — TỐN TIỀN (1 lượt Claude dịch ~1–3 cent; dựng MP4 0đ); cùng lõi nút 🇻🇳 trong tab Xuất.
//   --khong-dich: dựng bằng câu gốc (0đ, không gọi Claude) — thử đường dựng phụ đề.
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/phu-de-vi.mts <tap_id>
import { getDb } from '@mos2/db';
import { taoJob } from '../src/lib/xuong-video/doc-db';
import { xuatPhuDeViTap } from '../src/lib/xuong-video/review-vi';
const db = getDb()!; const tap = Number(process.argv[2]);
const job = await taoJob(db, { nhan: `Bản phụ đề Việt · tập (script)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tap, phu_de: 'vi' } });
console.log(JSON.stringify(await xuatPhuDeViTap(db, tap, job, process.argv.includes('--khong-dich'))));
process.exit(0);
