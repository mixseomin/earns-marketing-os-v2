// Phim #1156 tập 1 · shot #7 [GAG 5] Nhịp đòn — kịch bản (anh 02/11/2026: "Tây ngồi nhắc xong vẫn đứng im, chưa kịp làm gì tàu đã đến" → thêm nhịp CHỜ):
//   0–0.9s   còi tàu xa; đôi khách Tây duỗi chân qua ray nhâm nhi cà phê. Bà Lụa đi tới (nối shot #6), nhún đòn
//   0.9–1.6s thúng chạm ống chân → hai người giật mình co chân, kéo ghế lùi
//   1.6–4.0s bà đi tiếp ra khỏi khung; hai người quay đầu nhìn về phía còi, CHỜ
//   4.0–5.1s tàu lướt qua đúng chỗ vừa có chân (bà đã đi khỏi — không ai đứng trước tàu)
//   5.1–6.5s giữ: hai người vẫn ngồi nhâm nhi, tóc bay, tỉnh bơ
// TÀU LÀ LỚP CODE (anh: "sao tàu lại đi lùi lung tung") — mô hình video bịa vật to chuyển động nhanh; --khong-tau xuất ảnh mốc không tàu cho VideoExpress,
// --lop-tau xuất riêng lớp tàu trong suốt (.mov) để đè lên video người đúng giây.
// Chạy: node canh/gag5-nhip-don.mjs [ra.mp4] · --moc=0,0.9,1.6,4,6.5 --khong-tau · --lop-tau
import { W, H, doan, em, lerp, tai, manh, bongDat, diBo, veChan, chay } from '../dung.mjs';

const T = new URL('../tai/', import.meta.url).pathname;
const NG = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(new URL('../nguon.json', import.meta.url), 'utf8'))).gag5;
const m = (v) => tai(`${T}${NG.to.tach}/${NG.to.vai[v]}`);
const [nen, ba, don, doiDuoi, doiCo, tau] = await Promise.all([tai(T + NG.nen.tep), tai(T + NG.dung_lai.ba), tai(T + NG.dung_lai.don), m('doi_duoi'), m('doi_co'), m('tau')]);
const coCao = (img, px) => px / img.height, coRong = (img, px) => px / img.width;

// ── bố trí: ray ngang ở y≈580, thềm nhà y≈550, vỉa hè trước ray y 620–720 ──
const RAY = 588, THEM = 572, MAT_BA = 702, SAI = 64, DAI = 104;
const CO_BA = coCao(ba, 200), CO_DON = coRong(don, 430);
const hxBa = (t) => 200 + 340 * t;                          // đi đều, không dừng — nhún đòn lúc thúng trước ngang chân khách (~0,9s), ra khỏi khung ~4s
const DOI = { x: 760, co: coCao(doiDuoi, 262) };
// CHÂN GHẾ hai tư thế đặt cùng một mức thềm (đo trên mảnh: đáy ghế ở 89,2% / 92,6% chiều cao) — đổi tư thế không bị nhấc bổng; lúc duỗi, mũi giày vắt qua ray
const DAY_GHE = { duoi: 0.892, co: 0.926 };
const T_NHUN = [0.8, 1.05], T_CO = 1.0;                  // nhún đòn · lúc hai người co chân
const T_TAU = [4.0, 5.1];                                  // tàu vào mép trái → đuôi ra mép phải
const CO_TAU = coCao(tau, 300);

const ba_ = (t) => {
  const hx = hxBa(t), d = diBo(hx, { mat: MAT_BA, sai: SAI, dai: DAI });
  const nhun = 16 * Math.sin(Math.PI * doan(t, T_NHUN[0], T_NHUN[1]));                 // cú nhún: vai hạ rồi bật, thúng chúc xuống
  const vai = { x: hx + 14, y: d.hy - 124 + nhun };
  const goc = Math.sin((hx / (2 * SAI)) * 4 * Math.PI) * 1.2 + 6 * Math.sin(Math.PI * doan(t, T_NHUN[0], T_NHUN[1]));
  return { ...d, hx, vai, goc };
};

function ve(ctx, t) {
  ctx.drawImage(nen, 0, 0, W, H);

  // đôi khách (sau ray): duỗi chân → co chân đúng nhịp nhún; nảy nhẹ lúc co; nhấp cà phê
  const co = t >= T_CO, nay = co ? 1 + 0.07 * Math.sin(Math.PI * doan(t, T_CO, T_CO + 0.22)) : 1;
  const nhap = Math.sin(t * 2.6) * 1.2;
  bongDat(ctx, DOI.x, THEM + 4, 150, 0.18);
  if (!co) manh(ctx, doiDuoi, { x: DOI.x, y: THEM, co: DOI.co, neo: [0.5, DAY_GHE.duoi], xoay: nhap * 0.2 });
  else manh(ctx, doiCo, { x: DOI.x, y: THEM, co: DOI.co, coY: nay, neo: [0.5, DAY_GHE.co] });

  if (!KHONG_TAU) veTau(ctx, t);
  veBa(ctx, t);
}
const KHONG_TAU = process.argv.includes('--khong-tau') || process.argv.includes('--lop-tau');
/** tàu: lướt ngang trên ray từ trái sang phải, một chiều, giữa đôi khách và mép máy */
function veTau(ctx, t) {
  const u = doan(t, T_TAU[0], T_TAU[1]);
  if (u > 0 && u < 1) {
    const w = tau.width * CO_TAU, x = lerp(-w, W + 40, u);
    ctx.save(); ctx.globalAlpha = 0.25; for (const k of [1, 2]) manh(ctx, tau, { x: x - 26 * k, y: RAY + 6, co: CO_TAU, neo: [0, 1], bong: false }); ctx.restore();   // vệt nhoè tốc độ
    manh(ctx, tau, { x, y: RAY + 6, co: CO_TAU, neo: [0, 1] });
  }
}
function veBa(ctx, t) {
  // bà (trước ray, trên vỉa hè gần máy)
  const b = ba_(t);
  if (b.hx > -260 && b.hx < W + 260) {
    for (const f of b.ban) if (f.dung) bongDat(ctx, f.x, f.y, 22, 0.25);
    bongDat(ctx, b.hx, MAT_BA, 90, 0.12);
    veChan(ctx, b.hx, b.hy, b.ban, {});
    manh(ctx, ba, { x: b.hx, y: b.hy + 6, co: CO_BA, neo: [0.45, 0.97], xoay: 4 });
    manh(ctx, don, { x: b.vai.x, y: b.vai.y, co: CO_DON, neo: [0.5, 0.05], xoay: b.goc });
  }
}

if (process.argv.includes('--lop-tau')) { const { xuatLop } = await import('../dung.mjs'); console.log(await xuatLop(veTau, 6.5, new URL('../ra/gag5-lop-tau.mov', import.meta.url).pathname)); }
else await chay(ve, 6.5, 'gag5-nhip-don');
