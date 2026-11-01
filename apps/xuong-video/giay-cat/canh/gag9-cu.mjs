// Phim #1156 tập 1 · shot #11 [GAG 9] Kiệu ghế đưa cụ — kịch bản (chiều, đèn lồng bật):
//   0–1.35s  cụ ông ngủ gật trên ghế đẩu ngay mép ray, tay vẫn múa dưỡng sinh; bà Lụa đi vào từ trái
//   1.35–1.9 bà không dừng, luồn đầu đòn dưới ghế, hẩy cả ghế lẫn cụ lùi gọn lên thềm
//   1.9–4.0  bà đi ra khỏi khung; cụ vẫn ngủ
//   4.0–5.1  tàu lướt qua đúng chỗ cụ vừa ngồi
//   5.1–6.5  cụ mở mắt, thấy tàu đi qua, chậm rãi chắp tay cúi chào
// Ảnh mốc: --moc=0,1.35,1.9,4,6.5
import { doan, em, lerp, manh, bongDat } from '../dung.mjs';
import { THEM, LONG_RAY, manhTo, nhip, coCao, tMui, veTau, chieu, chayGag } from '../pho-ngang.mjs';

const [ngu, chao] = await Promise.all([manhTo('tay_cu', 'cu_ngu'), manhTo('tay_cu', 'cu_chao')]);
const CO = coCao(ngu, 205), CU = { x: 660 };
const T_LUON = tMui(CU.x - 20), T_HAY = [T_LUON + 0.1, T_LUON + 0.45], T_CHAO = 5.3;

const donGoc = (t) => 26 * nhip(t, T_LUON - 0.2, T_LUON + 0.15) - 12 * nhip(t, T_HAY[0], T_HAY[1]);

function veNguoi(ctx, t) {
  const u = em(doan(t, ...T_HAY)), y = lerp(LONG_RAY, THEM, u) - 22 * nhip(t, ...T_HAY);
  bongDat(ctx, CU.x, lerp(LONG_RAY, THEM, u), 60);
  manh(ctx, t < T_CHAO ? ngu : chao, { x: CU.x - 10 * u, y, co: CO, xoay: -10 * nhip(t, ...T_HAY) + (t < T_CHAO ? 2 * Math.sin(t * 2) : 0) });
}

await chayGag('gag9-cu', 6.5, { vung: [[550, 350, 770, 625]], veNguoi, veVat: (ctx, t) => veTau(ctx, t), donGoc, sau: (ctx, t, lop) => chieu(ctx, lop) });
