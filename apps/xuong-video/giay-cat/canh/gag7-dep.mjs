// Phim #1156 tập 1 · shot #9 [GAG 7] Câu dép tầng hai — kịch bản:
//   0–1.45s  cô nữ sinh trên ban công cúi chỉ chiếc dép mắc trên dây đèn lồng; hai ông chú ngồi thềm bên dưới; bà Lụa đi vào từ trái
//   1.45     bà không dừng, hất đầu đòn — dép bật khỏi dây, bay vồng lên
//   1.5–2.3  dép bay lên ban công, cô bắt gọn, cười
//   2.3–2.95 dây đèn lồng rung, hai quả đèn tuột rơi úp đúng đầu hai ông → hai "người đèn lồng" đỏ rực
//   2.95–6s  bà đi ra khỏi khung; hai ông ngồi đờ dưới đèn
// Dây, dép, đèn lồng là lớp vật. Ảnh mốc: --moc=0,1.45,2.3,2.95,6
import { doan, lerp, manh, bongDat } from '../dung.mjs';
import { THEM, BAN_CONG, manhTo, nhip, bay, coCao, chayGag } from '../pho-ngang.mjs';

const CAO_ONG = 210;
const [cuiChi, cuoiDep, dep, den1, den2] = await Promise.all(['cui_chi', 'cuoi_dep', 'dep', 'den_1', 'den_2'].map((v) => manhTo('nu_sinh', v)));
const [choi, longDen] = await Promise.all([manhTo('co_tuong', 'choi'), manhTo('co_tuong', 'long_den')]);
const CO_NS = coCao(cuoiDep, 165), CO_ONG = coCao(choi, CAO_ONG), CO_DEN = coCao(den1, 76), CO_DEP = 30 / dep.width;
const CO = { x: 870, y: BAN_CONG.san }, ONG = { x: 735 };
const DAY = [{ x: 560, y: 318 }, { x: 1040, y: 300 }];
const T_HAT = 1.45, T_BAT = 2.3, T_TUOT = 2.6, T_UP = 2.95;
const DEN = [{ x: 706, dau: THEM - CAO_ONG + 40 }, { x: 774, dau: THEM - CAO_ONG + 40 }];

const donGoc = (t) => -42 * nhip(t, T_HAT - 0.3, T_HAT + 0.3);
/** dây võng; rung sau cú hất */
const dayY = (x, t) => { const u = (x - DAY[0].x) / (DAY[1].x - DAY[0].x); return lerp(DAY[0].y, DAY[1].y, u) + 4 * (18 + 10 * Math.sin(t * 30) * nhip(t, T_HAT, T_TUOT + 0.4)) * u * (1 - u); };

function veNguoi(ctx, t) {
  manh(ctx, t < T_BAT ? cuiChi : cuoiDep, { x: CO.x, y: CO.y, co: CO_NS });
  bongDat(ctx, ONG.x, THEM, 90);
  manh(ctx, t < T_UP ? choi : longDen, { x: ONG.x, y: THEM, co: CO_ONG });
}
function veVat(ctx, t) {
  ctx.save(); ctx.strokeStyle = '#2b2420'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = DAY[0].x; x <= DAY[1].x; x += 10) (x === DAY[0].x ? ctx.moveTo(x, dayY(x, t)) : ctx.lineTo(x, dayY(x, t)));
  ctx.stroke(); ctx.restore();
  for (const [i, d] of DEN.entries()) {
    if (t >= T_UP) break;                                                    // đã úp lên đầu (mảnh người đèn lồng)
    const tren = dayY(d.x, t), u = doan(t, T_TUOT + 0.06 * i, T_UP);
    manh(ctx, i ? den2 : den1, { x: d.x, y: lerp(tren, d.dau, u * u), co: CO_DEN, neo: [0.5, 0], xoay: 6 * Math.sin(t * 14) * (1 - u) });
  }
  const treo = { x: 650, y: dayY(650, t) + 6 }, tay = { x: CO.x + 34, y: CO.y - 120 };
  if (t < T_HAT) manh(ctx, dep, { x: treo.x, y: treo.y, co: CO_DEP, neo: [0.5, 0], xoay: 70 + 5 * Math.sin(t * 3) });
  else if (t < T_BAT) { const p = bay(treo, tay, doan(t, T_HAT, T_BAT), 90); manh(ctx, dep, { x: p.x, y: p.y, co: CO_DEP, neo: [0.5, 0.5], xoay: 70 + 720 * doan(t, T_HAT, T_BAT) }); }
}

await chayGag('gag7-dep', 6, { veNguoi, veVat, donGoc });
