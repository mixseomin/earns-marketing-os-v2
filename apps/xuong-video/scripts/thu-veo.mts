// Kiểm gọi Veo có ảnh khung đầu (chỉ BẮT ĐẦU job rồi in operation; không tải video). Tốn tiền 1 clip 4s Lite (~$0,20) nếu Google nhận.
import { batDauVeo, docVeo } from '../src/lib/xuong-video/google';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const r = await batDauVeo({ model: 'veo-3.1-lite-generate-preview', prompt: 'a calm forest at sunrise, slow push-in', anhDau: { mimeType: 'image/png', data: png }, tiLe: '16:9', doPhanGiai: '720p', giay: 4 });
console.log('VEO', r);
if (r.ok) { await new Promise((ok) => setTimeout(ok, 20000)); console.log('POLL', await docVeo(r.taskId)); }
