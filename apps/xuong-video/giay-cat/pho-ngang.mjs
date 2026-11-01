// PHỐ NGANG — khung chung cho các gag phim #1156 dựng trên tấm nền ngang (tai/nen-ngang.png): ray chạy ngang, thềm nhà sau ray, bà Lụa đi đều trên vỉa
// hè trước ray từ trái sang phải, KHÔNG dừng (anh 02/11/2026: "diễn viên chính đi liên tục, có vấn đề chỉ xử lý nhanh 1 cái"). Mỗi gag chỉ khai:
//   · veNguoi(ctx, t): người + đồ đứng yên trên nền (thứ VideoExpress vẽ lại thành hoạt hình)
//   · veVat(ctx, t): vật chạy QUỸ ĐẠO (tàu, bóng bay, mèo bay…) — do code vẽ đè lên video người, mô hình video không được bịa (luật sổ tay gag, shot #7)
//   · donGoc(t): góc đòn gánh thêm vào (độ; + = đầu trước chúc xuống, − = hất lên) — cú xử lý của bà
// Chạy: node canh/<gag>.mjs → MP4 giấy cắt đủ lớp · --moc=0,1.2,… → ảnh mốc KHÔNG lớp vật · --lop → lớp vật .mov trong suốt
import { readFileSync } from 'node:fs';
import { W, H, doan, lerp, tai, manh, bongDat, diBo, veChan, chay, xuatLop } from './dung.mjs';

const T = new URL('./tai/', import.meta.url).pathname;
const NG = JSON.parse(readFileSync(new URL('./nguon.json', import.meta.url), 'utf8'));
/** mảnh theo VAI khai trong nguon.json (tờ vẽ lại thì số mảnh đổi — cảnh không đổi) */
export const manhTo = (to, vai) => tai(`${T}${NG[to].to.tach}/${NG[to].to.vai[vai]}`);
const [nen, ba, don, tau] = await Promise.all([tai(T + NG.gag5.nen.tep), tai(T + NG.gag5.dung_lai.ba), tai(T + NG.gag5.dung_lai.don), manhTo('gag5', 'tau')]);

// ── mặt bằng tấm nền (khung 1280×720) ──
export const RAY = 588;        // mặt ray
export const LONG_RAY = 604;   // chân vật ngồi / đứng giữa hai ray
export const THEM = 572;       // chân người trên thềm nhà sau ray
export const BAN_CONG = { x0: 786, x1: 986, lan_can: 322, san: 361 };   // ban công tầng hai nhà xanh
export const MAI_HIEN = { x0: 428, x1: 623, y: 363 };                   // mái hiên nhà đỏ
const MAT_BA = 702, SAI = 64, DAI = 104;
const CO_BA = 200 / ba.height, CO_DON = 430 / don.width, NUA = 215;

/** nhịp lên-xuống một lần trong [a, b] (0 → 1 → 0) */
export const nhip = (t, a, b) => Math.sin(Math.PI * doan(t, a, b));
/** bay theo đường parabol từ p0 tới p1, đỉnh cao hơn đường thẳng `cao` px */
export const bay = (p0, p1, u, cao) => ({ x: lerp(p0.x, p1.x, u), y: lerp(p0.y, p1.y, u) - 4 * cao * u * (1 - u) });
/** cỡ theo chiều cao mong muốn trên khung */
export const coCao = (img, px) => px / img.height;

/** bà: hông đi đều (vào từ mép trái, ra mép phải ~4,3s); đầu đòn trước = mui */
export const hxBa = (t) => -140 + 380 * t;
export function ba_(t, donGoc = () => 0) {
  const hx = hxBa(t), d = diBo(hx, { mat: MAT_BA, sai: SAI, dai: DAI });
  const vai = { x: hx + 14, y: d.hy - 124 };
  const goc = Math.sin((hx / (2 * SAI)) * 4 * Math.PI) * 1.2 + donGoc(t);
  const a = (goc * Math.PI) / 180;
  return { ...d, hx, vai, goc, mui: { x: vai.x + NUA * Math.cos(a), y: vai.y + NUA * Math.sin(a) } };
}
/** giây đầu đòn tới được hoành độ x (để đặt vật cần xử lý đúng chỗ bà đi qua) */
export const tMui = (x) => (x - 89) / 380;
/** troMep: chỉ vẽ khi cả người lẫn hai thúng nằm trọn trong khung — ảnh mốc có thúng thò ở mép thì mô hình vẽ lại tự "hoàn thiện" thêm một bà ngồi
 *  xổm bên giỏ hoa (thử 02/11/2026, 12/35 mốc hỏng); bà vào / ra khung là việc của VideoExpress giữa hai mốc */
export function veBa(ctx, t, donGoc, troMep = false) {
  const b = ba_(t, donGoc);
  if (b.hx < -280 || b.hx > W + 280 || (troMep && (b.hx < 250 || b.hx > W - 250))) return;
  for (const f of b.ban) if (f.dung) bongDat(ctx, f.x, f.y, 22, 0.25);
  bongDat(ctx, b.hx, MAT_BA, 90, 0.12);
  veChan(ctx, b.hx, b.hy, b.ban, {});
  manh(ctx, ba, { x: b.hx, y: b.hy + 6, co: CO_BA, neo: [0.45, 0.97], xoay: 4 });
  manh(ctx, don, { x: b.vai.x, y: b.vai.y, co: CO_DON, neo: [0.5, 0.05], xoay: b.goc });
}

/** tàu: lướt ngang trên ray trái → phải, một chiều, trong [a, b] giây */
export const T_TAU = [4.0, 5.1];
const CO_TAU = 300 / tau.height;
export function veTau(ctx, t, [a, b] = T_TAU) {
  const u = doan(t, a, b);
  if (u <= 0 || u >= 1) return;
  const w = tau.width * CO_TAU, x = lerp(-w, W + 40, u);
  ctx.save(); ctx.globalAlpha = 0.25; for (const k of [1, 2]) manh(ctx, tau, { x: x - 26 * k, y: RAY + 6, co: CO_TAU, neo: [0, 1], bong: false }); ctx.restore();
  manh(ctx, tau, { x, y: RAY + 6, co: CO_TAU, neo: [0, 1] });
}

/** chiều tối: ám cam + tối dần. lop=true chỉ nhuộm điểm đã vẽ (lớp vật trong suốt không bị phủ kín) */
export function chieu(ctx, lop = false) {
  ctx.save();
  ctx.globalCompositeOperation = lop ? 'source-atop' : 'multiply';
  ctx.fillStyle = lop ? 'rgba(120,60,30,0.35)' : 'rgb(232,170,128)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** chạy một gag: nền → veNguoi → bà → (veVat, trừ khi xuất ảnh mốc). `sau` vẽ đè cuối (vd ám chiều). */
export async function chayGag(ten, giay, { veNguoi, veVat = () => {}, donGoc, sau }) {
  const khongVat = process.argv.some((a) => a.startsWith('--moc='));
  if (process.argv.includes('--lop')) {
    const ra = new URL(`./ra/${ten}-lop.mov`, import.meta.url).pathname;
    return console.log(await xuatLop((ctx, t) => { veVat(ctx, t); if (sau) sau(ctx, t, true); }, giay, ra));
  }
  await chay((ctx, t) => {
    ctx.drawImage(nen, 0, 0, W, H);
    veNguoi(ctx, t);
    veBa(ctx, t, donGoc, khongVat);
    if (!khongVat) veVat(ctx, t);
    if (sau) sau(ctx, t, false);
  }, giay, ten);
}
