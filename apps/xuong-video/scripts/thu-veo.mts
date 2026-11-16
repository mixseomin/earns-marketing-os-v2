// Kiểm gọi Veo CHÍNH HÃNG qua cổng AI chung (ép cổng google; chỉ BẮT ĐẦU job rồi in operation, không tải video). Tốn tiền 1 clip 4s Lite (~$0,20) nếu Google
// nhận — chạy kèm --url=<ảnh khung đầu công khai> ngay sau khi anh bảo.
import { batDauVeo, docVeo } from '../src/lib/xuong-video/google';
const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
if (!url) { console.error('thiếu --url=<ảnh khung đầu công khai>'); process.exit(1); }
const r = await batDauVeo({ model: 'veo-3.1-lite-generate-preview', prompt: 'a calm forest at sunrise, slow push-in', anhDau: url, tiLe: '16:9', doPhanGiai: '720p', giay: 4 });
console.log('VEO', r);
if (r.ok) { await new Promise((ok) => setTimeout(ok, 20000)); console.log('POLL', await docVeo(r.taskId)); }
