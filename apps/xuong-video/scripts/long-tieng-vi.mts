// Bản lồng tiếng Việt cho một tập — TỐN TIỀN (1 lượt Claude dịch ~1–3 cent + ký tự ElevenLabs trong gói); cùng lõi nút 🇻🇳 trong tab Xuất.
//   --khong-dich: dựng bằng câu + giọng gốc (0đ, không gọi Claude/ElevenLabs) — thử đường dựng.
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/long-tieng-vi.mts <tap_id>
import { getDb } from '@mos2/db';
import { taoJob } from '../src/lib/xuong-video/doc-db';
import { xuatLongTiengTap } from '../src/lib/xuong-video/long-tieng';
const db = getDb()!; const tap = Number(process.argv[2]);
const job = await taoJob(db, { nhan: `Lồng tiếng Việt · tập ${tap} (script)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tap, long_tieng: 'vi' } });
console.log(JSON.stringify(await xuatLongTiengTap(db, tap, job, 'vi', process.argv.includes('--khong-dich'))));
process.exit(0);
