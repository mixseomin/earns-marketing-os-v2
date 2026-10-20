// THỬ CỔNG PLENX 0đ (cong-plenxai.ts): xoay token (refresh) + đọc hồ sơ / số dư — không sinh gì. Chạy trên box3 (tệp token ở đó):
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-plenxai.mts
import { layToken, hoSoPlenx, TOKEN_TEP } from '../src/lib/xuong-video/cong-plenxai';
await layToken(true);
const h = await hoSoPlenx();
const so = Object.fromEntries(Object.entries(h).filter(([k]) => /credit|balance|plan|email|username|quota/i.test(k)));
console.log(`token ${TOKEN_TEP} xoay được · hồ sơ:`, JSON.stringify(so).slice(0, 600));
