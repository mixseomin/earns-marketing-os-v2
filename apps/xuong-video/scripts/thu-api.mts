// Kiểm nhanh adapter model bằng khoá thật (tốn vài cent): ANTHROPIC_API_KEY=… GOOGLE_API_KEY=… node_modules/.bin/tsx --conditions react-server apps/xuong-video/scripts/thu-api.mts
import { tachCanh } from '../src/lib/xuong-video/claude';
import { sinhAnhMot } from '../src/lib/xuong-video/google';
const nv = [
  { id: 1, phim_id: 1, loai: 'nhan_vat' as const, ten: 'Timo', mo_ta: 'rùa con 8 tuổi, mai xanh rêu vân lục giác, mắt to nâu, khăn quàng đỏ', anh_ref: [], giong: '' },
  { id: 2, phim_id: 1, loai: 'nhan_vat' as const, ten: 'Lio', mo_ta: 'thỏ xám tai dài, áo gi-lê xanh dương, nhanh nhảu', anh_ref: [], giong: '' },
];
const t0 = Date.now();
const r = await tachCanh({ loai: 'phim', kinhThanh: { phong_cach: '3D hoạt hình kiểu Pixar, màu ấm', ti_le: '9:16' }, nhanVat: nv, soCanh: 2,
  kichBan: 'Cảnh 1: Buổi sáng trong rừng, Timo chậm rãi bò qua thảm cỏ. Cảnh 2: Lio phóng vụt qua, cười trêu: "Chậm thế bao giờ tới hồ?"' });
console.log('CLAUDE', r.ok ? { model: r.model, soCanh: r.canh.length, tokens: r.tokens, ms: Date.now() - t0, canh1: r.canh[0]?.canh, nv: r.canh[1]?.nhan_vat, promptAnh: r.canh[0]?.prompt_anh.slice(0, 120) } : r);
for (const model of ['gemini-nano-banana-2.1', 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image']) {
const t1 = Date.now();
const a = await sinhAnhMot({ model, prompt: 'Character reference sheet of a small turtle, moss-green shell with hexagon pattern, big brown eyes, red scarf, Pixar style, plain background', tiLe: '1:1', kichCo: '1K' });
console.log('GEMINI', model, a.ok ? { model: a.model, mime: a.mimeType, bytes: a.data.length, ms: Date.now() - t1 } : a.loi.slice(0, 160));
}
