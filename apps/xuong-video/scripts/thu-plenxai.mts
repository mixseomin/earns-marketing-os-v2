// THỬ CỔNG PLENX 0đ: đọc hồ sơ / số dư qua cổng AI chung (loai 'plenx_ho_so' — cổng giữ + xoay token) — không sinh gì:
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-plenxai.mts
import { hoSoPlenx } from '../src/lib/xuong-video/cong-plenxai';
const h = await hoSoPlenx();
const so = Object.fromEntries(Object.entries(h).filter(([k]) => /credit|balance|plan|email|username|quota|tier/i.test(k)));
console.log('PlenX qua cổng · hồ sơ:', JSON.stringify(so).slice(0, 600));
