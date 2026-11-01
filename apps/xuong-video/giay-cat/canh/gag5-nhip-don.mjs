// Phim #1156 tập 1 · shot #7 [GAG 5] Nhịp đòn — kịch bản (luật gag mới: một trục trặc nhỏ, một động tác, đi liền):
//   0–1.5s  còi tàu; đôi khách Tây ngồi ghế nhựa sát ray, duỗi chân qua ray, nhâm nhi cà phê, không biết gì. Bà Lụa vào từ mép trái (nối shot #6)
//   1.5–3s  đi ngang không dừng, bà nhún đòn một cái — thúng hoa chạm ống chân; hai người co chân, kéo ghế lùi cùng một nhịp
//   3–5.5s  đoàn tàu lướt qua đúng chỗ vừa có chân; hai người vẫn nhâm nhi, tóc bay; bà ra khỏi khung bên phải
// Chạy: node canh/gag5-nhip-don.mjs [ra.mp4] · ảnh mốc: --moc=0,1.7,2.6,3.6,5.2
import { W, H, doan, em, lerp, tai, manh, bongDat, diBo, veChan, chay } from '../dung.mjs';

const T = new URL('../tai/', import.meta.url).pathname;
const NG = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(new URL('../nguon.json', import.meta.url), 'utf8'))).gag5;
const m = (v) => tai(`${T}${NG.to.tach}/${NG.to.vai[v]}`);
const [nen, ba, don, doiDuoi, doiCo, tau] = await Promise.all([tai(T + NG.nen.tep), tai(T + NG.dung_lai.ba), tai(T + NG.dung_lai.don), m('doi_duoi'), m('doi_co'), m('tau')]);
const coCao = (img, px) => px / img.height, coRong = (img, px) => px / img.width;

// ── bố trí: ray ngang ở y≈580, thềm nhà y≈550, vỉa hè trước ray y 620–720 ──
const RAY = 588, THEM = 572, MAT_BA = 702, SAI = 64, DAI = 104;
const CO_BA = coCao(ba, 200), CO_DON = coRong(don, 430);
const hxBa = (t) => -120 + 330 * t;                         // vào từ mép trái, đi đều, không dừng
const DOI = { x: 760, co: coCao(doiDuoi, 262) };
// CHÂN GHẾ hai tư thế đặt cùng một mức thềm (đo trên mảnh: đáy ghế ở 89,2% / 92,6% chiều cao) — đổi tư thế không bị nhấc bổng; lúc duỗi, mũi giày vắt qua ray
const DAY_GHE = { duoi: 0.892, co: 0.926 };
const T_NHUN = [1.62, 1.92], T_CO = 1.86;                  // nhún đòn · lúc hai người co chân
const T_TAU = [3.0, 4.15];                                  // tàu vào mép trái → đuôi ra mép phải
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

  // tàu: lướt ngang trên ray, giữa đôi khách và bà
  const u = doan(t, T_TAU[0], T_TAU[1]);
  if (u > 0 && u < 1) {
    const w = tau.width * CO_TAU, x = lerp(-w, W + 40, u);
    ctx.save(); ctx.globalAlpha = 0.25; for (const k of [1, 2]) manh(ctx, tau, { x: x - 26 * k, y: RAY + 6, co: CO_TAU, neo: [0, 1], bong: false }); ctx.restore();   // vệt nhoè tốc độ
    manh(ctx, tau, { x, y: RAY + 6, co: CO_TAU, neo: [0, 1] });
  }

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

await chay(ve, 5.5, 'gag5-nhip-don');
