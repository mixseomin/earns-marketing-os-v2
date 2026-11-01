// Phim #1156 tập 1 · shot #10 [GAG 8] Bắn mèo lên ban công — kịch bản:
//   0–1.3s   mèo mướp nép giữa hai ray không dám nhảy, ban công nhà nó ở ngay trên; bà Lụa đi vào từ trái
//   1.3–1.65 bà không dừng, xúc mèo vào thúng trước rồi bật đòn tre như lò xo
//   1.65–2.5 mèo bay vồng lên, đáp gọn lan can ban công
//   2.5–6.5  bà đi ra khỏi khung; tàu lướt qua dưới (4–5.1s); mèo ngồi lan can liếm mép, mắt lim dim
// Mèo bay là lớp vật. Ảnh mốc: --moc=0,1.3,1.65,2.5,6.5
import { doan, em, manh, bongDat } from '../dung.mjs';
import { LONG_RAY, BAN_CONG, manhTo, nhip, bay, coCao, tMui, ba_, veTau, chayGag } from '../pho-ngang.mjs';

const [so, bayM, ngoi] = await Promise.all(['so', 'bay', 'ngoi'].map((v) => manhTo('meo', v)));
const CO = coCao(ngoi, 140), MEO = { x: 650 };
const T_XUC = tMui(MEO.x), T_BAN = T_XUC + 0.18, T_DAP = 2.5;
const DICH = { x: 910, y: BAN_CONG.lan_can + 2 };

const donGoc = (t) => 30 * nhip(t, T_XUC - 0.15, T_XUC + 0.12) - 38 * nhip(t, T_XUC + 0.08, T_BAN + 0.3);   // chúc xúc mèo · bật lên

function veNguoi(ctx, t) {
  if (t < T_XUC) { bongDat(ctx, MEO.x, LONG_RAY, 40); manh(ctx, so, { x: MEO.x, y: LONG_RAY, co: CO, coX: 1 + 0.03 * Math.sin(t * 20) }); }   // run run
  else if (t >= T_DAP) manh(ctx, ngoi, { x: DICH.x, y: DICH.y, co: CO, lat: true, coY: 1 - 0.08 * nhip(t, T_DAP, T_DAP + 0.15) });
}
function veVat(ctx, t) {
  veTau(ctx, t);
  if (t < T_XUC || t >= T_DAP) return;
  const p0 = ba_(T_BAN).mui, u = doan(t, T_BAN, T_DAP);
  const p = t < T_BAN ? ba_(t).mui : bay(p0, { x: DICH.x, y: DICH.y - 40 }, em(u), 170);
  manh(ctx, bayM, { x: p.x, y: p.y, co: CO * 0.9, neo: [0.5, 0.6], xoay: 20 * Math.sin(u * 6) });
}

await chayGag('gag8-meo', 6.5, { vung: [[580, 520, 730, 625], [840, 170, 990, 345]], veNguoi, veVat, donGoc });
