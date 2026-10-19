// THỬ CHUỖI CLAUDE (claude.ts › client: ckey → ShopAIKey → Anthropic) bằng một lượt rất nhỏ (< 1¢ kể cả khi rơi tới Anthropic — chot-tien tự cho chạy).
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-chuoi-claude.mts [--bo=ckey,shopaikey]
// --bo: tạm bỏ đường (xoá khoá khỏi tiến trình này) để thử đường dự phòng. In: đường đã đi · khuôn JSON đọc được · token · tiền thật.
import { goiYThu } from '../src/lib/xuong-video/claude';
const bo = (process.argv.find((a) => a.startsWith('--bo=')) ?? '').slice(5).split(',').filter(Boolean);
if (bo.includes('ckey')) delete process.env.CKEY_API_KEY;
if (bo.includes('shopaikey')) delete process.env.SHOPAIKEY_API_KEY;
const r = await goiYThu();
console.log(JSON.stringify(r));
