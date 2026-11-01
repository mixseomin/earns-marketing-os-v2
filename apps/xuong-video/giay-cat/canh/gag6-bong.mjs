// Phim #1156 tập 1 · shot #8 [GAG 6] Bóng mắc mái hiên — kịch bản:
//   0–1.2s   bóng vàng mắc trên mái hiên, cậu bé đứng dưới ngửa mặt mếu; bà Lụa đi vào từ trái
//   1.2      bà không dừng, thúc đầu đòn vào mái hiên — bóng bật lên
//   1.3–2.4  bóng bay vồng lên rồi rơi BỘP trúng đầu cậu bé
//   2.4–2.85 bóng nảy lên, rơi gọn vào tay em
//   2.85–5.5 bà đi ra khỏi khung; bé chớp mắt rồi cười toe ôm bóng
// Bóng là lớp vật (code) suốt shot. Ảnh mốc: --moc=0,1.2,2.4,2.85,5.5
import { doan, manh, bongDat } from '../dung.mjs';
import { THEM, MAI_HIEN, manhTo, nhip, bay, coCao, chayGag } from '../pho-ngang.mjs';

const [chuMo, omBong, bong] = await Promise.all(['chu_mo', 'om_bong', 'bong'].map((v) => manhTo('be', v)));
const CAO_BE = 200, CO_BE = coCao(chuMo, CAO_BE), CO_BONG = 40 / bong.width;
const BE = { x: 545 }, DINH_DAU = THEM - CAO_BE + 10, TAY = THEM - CAO_BE * 0.55;
const T_THUC = 1.2, T_DAU = 2.4, T_TAY = 2.85;

const donGoc = (t) => -32 * nhip(t, T_THUC - 0.3, T_THUC + 0.3);            // thúc đầu đòn lên mái hiên

function veNguoi(ctx, t) {
  bongDat(ctx, BE.x, THEM, 50);
  if (t < T_TAY) manh(ctx, chuMo, { x: BE.x, y: THEM, co: CO_BE, coY: 1 - 0.05 * nhip(t, T_DAU, T_DAU + 0.15) });   // bóng rơi trúng đầu: lún xuống một nhịp
  else manh(ctx, omBong, { x: BE.x, y: THEM, co: CO_BE });
}
function veVat(ctx, t) {
  const tren = { x: 560, y: MAI_HIEN.y - 15 };
  let p;
  if (t < T_THUC) p = tren;
  else if (t < T_DAU) p = bay(tren, { x: BE.x + 8, y: DINH_DAU - 15 }, doan(t, T_THUC, T_DAU), 150);
  else if (t < T_TAY) p = bay({ x: BE.x + 8, y: DINH_DAU - 15 }, { x: BE.x + 4, y: TAY }, doan(t, T_DAU, T_TAY), 40);
  else return;                                                              // bóng đã nằm trong tay (mảnh ôm bóng)
  manh(ctx, bong, { x: p.x, y: p.y, co: CO_BONG, neo: [0.5, 0.5], xoay: t * 400 * (t > T_THUC ? 1 : 0) });
}

await chayGag('gag6-bong', 5.5, { vung: [[460, 330, 630, 600]], veNguoi, veVat, donGoc });
