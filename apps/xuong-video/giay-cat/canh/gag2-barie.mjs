// Phim #1156 tập 1 · shot #4 [GAG 2] Barie đòn gánh — kịch bản:
//   0–1.2s   đôi khách Tây vừa selfie vừa lùi dần từ thềm ra giữa ray; bà Lụa đi vào từ trái
//   1.2–1.55 bà không dừng, hạ đầu đòn chắn ngang sau lưng họ như cần barie
//   1.55–2.0 hai người lùi trúng đòn, bật ngược về áp lưng vào tường
//   2.0–6.5  bà nhấc đòn đi tiếp ra khỏi khung; tàu lướt qua (4–5.1s) đúng chỗ họ vừa đứng; hai người nhìn nhau phá lên cười
// Ảnh mốc: --moc=0,1.2,1.5,2,6.5
import { doan, em, lerp, manh, bongDat } from '../dung.mjs';
import { THEM, LONG_RAY, manhTo, nhip, coCao, veTau, chayGag } from '../pho-ngang.mjs';

const [selfie, tuong] = await Promise.all([manhTo('tay_cu', 'tay_selfie'), manhTo('tay_cu', 'tay_tuong')]);
const CO = coCao(selfie, 300), X = 700, SAT_TUONG = THEM - 8;
const T_HA = [1.15, 1.4], T_NHAC = [1.85, 2.15], T_BAT = [1.55, 1.85];

const donGoc = (t) => 22 * em(doan(t, ...T_HA)) * (1 - em(doan(t, ...T_NHAC)));   // hạ đòn chắn ngang, giữ, nhấc lên

function veNguoi(ctx, t) {
  if (t < T_BAT[0]) {
    const y = lerp(THEM, LONG_RAY - 4, em(doan(t, 0, 1.5))), lac = Math.sin(t * 9) * 1.5;   // lùi từng bước ra ray
    bongDat(ctx, X, y, 100);
    manh(ctx, selfie, { x: X, y, co: CO, xoay: lac });
    return;
  }
  const u = doan(t, ...T_BAT), y = lerp(LONG_RAY - 4, SAT_TUONG, em(u));
  bongDat(ctx, X, y, 100);
  manh(ctx, tuong, { x: X, y, co: CO * 1.02, coX: 1 + 0.05 * nhip(t, 1.55, 1.75) });   // dội vào tường: bẹt ra một nhịp
}

await chayGag('gag2-barie', 6.5, { veNguoi, veVat: (ctx, t) => veTau(ctx, t), donGoc });
