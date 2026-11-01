// Phim #1156 tập 1 · shot #3 [GAG 1] Gõ ray báo tàu — kịch bản:
//   0–1.2s   cậu bé ngồi giữa ray xếp tháp que, mèo cuộn ngủ cạnh; bà Lụa đi vào từ trái
//   1.2–1.75 bà không dừng, gõ đầu đòn xuống ray hai cái "keng keng"
//   1.75–2.4 bé và mèo giật mình nhảy lên thềm
//   2.4–6.5  bà đi ra khỏi khung; tàu lướt qua (4–5.1s) đúng chỗ bé vừa ngồi — tháp que vẫn đứng giữa ray; bé cười toe, mèo ngồi tỉnh
// Ảnh mốc: --moc=0,1.2,1.75,2.4,6.5
import { doan, lerp, manh, bongDat } from '../dung.mjs';
import { THEM, LONG_RAY, manhTo, nhip, bay, coCao, veTau, chayGag } from '../pho-ngang.mjs';

const [ngoi, thap, giat, cuon, meoNgoi] = await Promise.all([manhTo('be', 'ngoi'), manhTo('be', 'thap_que'), manhTo('be', 'giat_minh'), manhTo('meo', 'cuon'), manhTo('meo', 'ngoi')]);
const CO_BE = coCao(giat, 200), CO_MEO = coCao(meoNgoi, 120);
const BE = { x: 690 }, THAP = { x: 690 + 132 * CO_BE + 6 }, MEO = { x: 850 };
const T_GO = [[1.25, 1.45], [1.5, 1.7]], T_NHAY = [1.75, 2.15];

const donGoc = (t) => 30 * (nhip(t, ...T_GO[0]) + nhip(t, ...T_GO[1]));      // hai cú gõ ray

function veNguoi(ctx, t) {
  manh(ctx, thap, { x: THAP.x, y: LONG_RAY - 2, co: CO_BE });                // tháp que ở lại giữa ray suốt shot
  const u = doan(t, ...T_NHAY);
  if (u <= 0) {
    bongDat(ctx, BE.x, LONG_RAY, 60);
    manh(ctx, ngoi, { x: BE.x, y: LONG_RAY, co: CO_BE });
    manh(ctx, cuon, { x: MEO.x, y: LONG_RAY, co: CO_MEO });
    return;
  }
  const be = bay({ x: BE.x, y: LONG_RAY }, { x: BE.x - 20, y: THEM }, u, 45), meo = bay({ x: MEO.x, y: LONG_RAY }, { x: MEO.x + 10, y: THEM }, u, 60);
  bongDat(ctx, lerp(BE.x, BE.x - 20, u), lerp(LONG_RAY, THEM, u), 50);
  manh(ctx, giat, { x: be.x, y: be.y, co: CO_BE, coY: u < 1 ? 1.04 : 1 });
  manh(ctx, meoNgoi, { x: meo.x, y: meo.y, co: CO_MEO, lat: true });
}

await chayGag('gag1-go-ray', 6.5, { veNguoi, veVat: (ctx, t) => veTau(ctx, t), donGoc });
