// Gắn nguồn tham khảo của creative vào phim đã tạo từ nó (0đ, không gọi model) — cùng lõi nút 🎬 Tạo phim gốc (concept-db.ts › ganNguonCreativeDb).
// Dùng cho phim tạo trước khi đường creative → phim mang nguồn (17/10/2026: phim gốc #120).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/gan-nguon-creative.mts <phim_id>
import { getDb } from '@mos2/db';
import { ganNguonCreativeDb } from '../src/lib/xuong-video/concept-db';

const phim = Number(process.argv[2]);
if (!phim) { console.error('dùng: gan-nguon-creative.mts <phim_id>'); process.exit(2); }
const kq = await ganNguonCreativeDb(getDb()!, phim);
if (!kq) { console.error(`phim #${phim} không tạo từ creative nào`); process.exit(1); }
console.log(`phim #${phim}: ${kq.shot} shot điền lại nguồn · câu còn thiếu nguồn: ${kq.thieu.length ? kq.thieu.join(' | ') : 'không'}`);
process.exit(kq.thieu.length ? 1 : 0);
