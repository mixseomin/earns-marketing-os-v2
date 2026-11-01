// Phim #1156 tập 1 · shot #6 [GAG 4] — kịch bản (dan_dung.nhip):
//   0–1.5s  ông chủ quán ôm chồng ghế quá cao loạng choạng; BA ghế trên cùng bật ra, rơi
//   1.5–3s  bà Lụa đi ngang KHÔNG dừng, hất đầu đòn gánh: ba ghế bật ngược lên, đáp gọn lại đỉnh chồng ông đang ôm
//   3–6s    chồng ghế đứng thẳng trong tay ông; ông há hốc, quay nhìn theo; bà đã ra khỏi khung bên phải
// Chạy: node canh/gag4-ke-chong-ghe.mjs [ra.mp4]
import { W, H, doan, em, roi, lerp, tai, manh, bongDat, diBo, veChan, xuat } from '../dung.mjs';

const T = new URL('../tai/', import.meta.url).pathname;
const [nen, ba, don, ongHoang, ongHa, ghe, chong] = await Promise.all(['nen-749.png', 'gag4/manh-1.png', 'gag4/manh-3.png', 'gag4/manh-4.png', 'gag4/manh-5.png', 'gag4/manh-6.png', 'gag4/manh-7.png'].map((f) => tai(T + f)));

// ── bố trí (toạ độ khung 1280×720) ──
const MAT_BA = 676, SAI = 66, DAI = 104;                  // mặt vỉa hè gần máy · nửa sải · dài chân
const hxBa = (t) => 150 + 330 * t;                        // bà đi đều sang phải, không dừng
const CO_BA = 0.5;
const ONG = { x: 960, y: 640, co: 0.7 };                  // ông đứng sau một chút (xa máy hơn) — bà đi phía trước
const CO_GHE = 0.66, LONG = 32;                           // ghế lồng nhau: mỗi chiếc cao thêm 30px
const chongCao = chong.height * CO_GHE;
const chongDay = { x: ONG.x + 82, y: ONG.y - 100 };       // đáy chồng ghế ông ôm bên hông (ngang bụng) — lệch sang phải để thấy mặt ông
const dinh = chongDay.y - chongCao;
const oGhe = (i) => ({ x: chongDay.x, y: dinh + 52 - LONG * i });   // ô của ghế thứ i (0 = thấp nhất trong ba chiếc trên cùng)

/** góc loạng choạng của ông (quanh bàn chân): lắc mạnh dần tới lúc ghế bật, đứng thẳng lại sau khi ghế đáp */
const lacOng = (t) => (1 - doan(t, 2.1, 2.6)) * (3 + 4 * doan(t, 0, 1.0)) * Math.sin(2 * Math.PI * 2.1 * t) - 3 * doan(t, 0.8, 1.2) * (1 - doan(t, 2.0, 2.4));
const xoayQuanh = (p, goc) => { const a = (goc * Math.PI) / 180, dx = p.x - ONG.x, dy = p.y - ONG.y; return { x: ONG.x + dx * Math.cos(a) - dy * Math.sin(a), y: ONG.y + dx * Math.sin(a) + dy * Math.cos(a) }; };

// ── bà: hông, vai, đầu đòn ──
const ba_ = (t) => {
  const d = diBo(hxBa(t), { mat: MAT_BA, sai: SAI, dai: DAI });
  const vai = { x: hxBa(t) + 14, y: d.hy - 124 };
  const nhun = Math.sin((hxBa(t) / (2 * SAI)) * 2 * Math.PI * 2) * 1.2;          // đòn nhún theo bước
  const hat = -20 * em(doan(t, 1.5, 1.68)) * (1 - em(doan(t, 1.8, 2.15)));        // cú hất: đầu đòn trước vểnh lên rồi hạ
  const goc = nhun + hat;
  const a = (goc * Math.PI) / 180, nua = (don.width * CO_BA) / 2;
  return { ...d, vai, goc, mui: { x: vai.x + nua * Math.cos(a), y: vai.y + nua * Math.sin(a) } };
};

// ── ba ghế trên cùng: trên chồng → bật ra rơi → chạm đầu đòn (t=1.62) → bị hất ngược lên → đáp lại ô cũ ──
const T_ROI = [1.04, 0.98, 0.92], T_CHAM = 1.62, T_DAP = [2.0, 2.12, 2.24];
function ghe_(i, t) {
  if (t < T_ROI[i]) { const p = xoayQuanh(oGhe(i), lacOng(t)); return { ...p, xoay: lacOng(t), co: 1 }; }
  const bat = xoayQuanh(oGhe(i), lacOng(T_ROI[i]));
  const m = ba_(T_CHAM).mui, cham = { x: m.x - 14 * i, y: m.y - 46 - 26 * i };
  if (t < T_CHAM) { const u = doan(t, T_ROI[i], T_CHAM); return { x: lerp(bat.x, cham.x, u), y: lerp(bat.y, cham.y, roi(u)), xoay: lerp(lacOng(T_ROI[i]), -75 + 18 * i, u), co: 1 }; }
  const dich = oGhe(i);
  if (t < T_DAP[i]) { const u = doan(t, T_CHAM, T_DAP[i]); return { x: lerp(cham.x, dich.x, em(u)), y: lerp(cham.y, dich.y, u) - 110 * Math.sin(Math.PI * u), xoay: lerp(-75 + 18 * i, 360, em(u)), co: 1 }; }
  const n = doan(t, T_DAP[i], T_DAP[i] + 0.14);
  return { ...dich, xoay: 0, co: 1 - 0.14 * Math.sin(Math.PI * n) };                // đáp: nén nhẹ rồi bật lại
}

function ve(ctx, t) {
  ctx.drawImage(nen, 0, 0, W, H);                                                  // nền đứng yên suốt shot

  // ông + chồng ghế (xa máy hơn → vẽ trước)
  const lac = lacOng(t), ha = t >= 2.3, ngoai = t >= 3.7;
  const nhay = ha ? 1 + 0.06 * Math.sin(Math.PI * doan(t, 2.3, 2.65)) : 1;          // giật mình khi thấy ghế đáp
  bongDat(ctx, ONG.x, ONG.y, 70);
  manh(ctx, ha ? ongHa : ongHoang, { x: ONG.x, y: ONG.y, co: ONG.co, coY: nhay, xoay: lac, lat: ngoai });
  const cd = xoayQuanh(chongDay, lac);
  manh(ctx, chong, { x: cd.x, y: cd.y, co: CO_GHE, xoay: lac });
  for (const i of [0, 1, 2]) { const g = ghe_(i, t); manh(ctx, ghe, { x: g.x, y: g.y, co: CO_GHE, coY: g.co, xoay: g.xoay }); }

  // bà (gần máy → vẽ sau): chân bám vỉa hè, thân, đòn gánh
  const b = ba_(t), hx = hxBa(t);
  if (hx < W + 260) {
    for (const f of b.ban) if (f.dung) bongDat(ctx, f.x, f.y, 22, 0.25);
    bongDat(ctx, hx, MAT_BA, 90, 0.12);
    veChan(ctx, hx, b.hy, b.ban, {});
    manh(ctx, ba, { x: hx, y: b.hy + 6, co: CO_BA, neo: [0.45, 0.97], xoay: 4 });
    manh(ctx, don, { x: b.vai.x, y: b.vai.y, co: CO_BA, neo: [0.5, 0.03], xoay: b.goc });
  }
}

const ra = process.argv[2] || new URL('../ra/gag4-ke-chong-ghe.mp4', import.meta.url).pathname;
await import('node:fs').then((fs) => fs.mkdirSync(new URL('../ra/', import.meta.url).pathname, { recursive: true }));
console.log(await xuat(ve, 6, ra));
