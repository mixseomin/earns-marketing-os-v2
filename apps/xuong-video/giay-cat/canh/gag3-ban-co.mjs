// Phim #1156 tập 1 · shot #5 [GAG 3] Bàn gập kẹp ván cờ — kịch bản:
//   0–1.3s   bàn gấp chìa ra chắn ray, hai ông chú ngồi thềm cắm cúi đánh cờ; bà Lụa đi vào từ trái
//   1.3–1.9  bà không dừng, bẩy đầu đòn hất mặt bàn dựng đứng áp tường — bàn cờ dính nguyên quân, dựng đứng
//   1.9–6.5  bà đi ra khỏi khung; tàu lướt qua (4–5.1s) sát mặt bàn đã gập; hai ông nghiêng đầu 90° đi tiếp nước cờ trên bàn dựng đứng
// Ảnh mốc: --moc=0,1.3,1.9,4,6.5
import { doan, em, lerp, manh, bongDat } from '../dung.mjs';
import { THEM, LONG_RAY, manhTo, nhip, coCao, tMui, veTau, chayGag } from '../pho-ngang.mjs';

const [banMo, banGap, choi, nghieng] = await Promise.all(['ban_mo', 'ban_gap', 'choi', 'nghieng'].map((v) => manhTo('co_tuong', v)));
const CO = coCao(choi, 215), ONG = { x: 535 }, BAN = { x: 720 };
const T_LAT = tMui(BAN.x - 30);                                 // lúc đầu đòn tới mép bàn
const T_NGHIENG = 5.25;

const donGoc = (t) => 14 * nhip(t, T_LAT - 0.2, T_LAT) - 26 * nhip(t, T_LAT, T_LAT + 0.35);   // luồn dưới mép bàn rồi bẩy lên

function veNguoi(ctx, t) {
  bongDat(ctx, ONG.x, THEM, 90);
  manh(ctx, t < T_NGHIENG ? choi : nghieng, { x: ONG.x, y: THEM, co: CO });
  const u = doan(t, T_LAT, T_LAT + 0.18);
  if (u <= 0) { manh(ctx, banMo, { x: BAN.x, y: LONG_RAY, co: CO }); return; }
  if (u < 1) { manh(ctx, banMo, { x: lerp(BAN.x, BAN.x - 20, u), y: lerp(LONG_RAY, THEM, u), co: CO, xoay: -80 * em(u), neo: [0.1, 1] }); return; }
  manh(ctx, banGap, { x: BAN.x - 10, y: THEM, co: CO, coY: 1 - 0.06 * nhip(t, T_LAT + 0.18, T_LAT + 0.36) });   // đập vào tường, nảy nhẹ
}

await chayGag('gag3-ban-co', 6.5, { vung: [[400, 330, 840, 625]], veNguoi, veVat: (ctx, t) => veTau(ctx, t), donGoc });
