// THỬ ĐƯỜNG CLAUDE của studio (claude.ts › client → CỔNG AI CHUNG: donk → ckey → fal → chính hãng cuối) bằng một lượt rất nhỏ (< 1¢ — chot-tien tự cho chạy).
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-chuoi-claude.mts
// In: tuyến cổng đã đi · khuôn JSON đọc được · token · tiền thật. Muốn thử tuyến dự phòng: bỏ tuyến ở cổng (bo_tuyen), không xoá khoá trong tiến trình này.
import { goiYThu } from '../src/lib/xuong-video/claude';
const r = await goiYThu();
console.log(JSON.stringify(r));
