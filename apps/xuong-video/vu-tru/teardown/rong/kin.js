// IGNIS DR-3: số liệu và mô hình bay của rồng máy. Kịch bản (film.js) chỉ đặt các kênh theo thời gian: thức (wake), xoè cánh
// (fold), ga cánh u, độ cao đích, há hàm, phun lửa, mở ngực, tách rời. Mọi thứ còn lại (pha đập cánh, lực nâng, công suất lõi,
// nhiên liệu, nhiệt, tải từng chân) là hàm của các kênh đó, nên hình, bảng số và tiếng không lệch nhau. Không có three.js ở đây.

export const SPEC = {
  massKg: 26, // khối lượng cất cánh
  unitM: 0.25, // 1 đơn vị cảnh = 25 cm
  spanM: 3.4,
  flapHz: 1.35, // nhịp đập cánh khi lơ lửng, thời gian thật
  ampDeg: 44, // biên độ đập cánh khi lơ lửng
  coreKWh: 4.2, // dung lượng lõi
  idleKW: 0.45, // điện nền: mắt, điều khiển, servo giữ thế
  flapKW: 7.8, // điện bộ đập cánh ở ga 1
  flameKW: 3.2, // bơm + đánh lửa khi phun hết cỡ
  flameLs: 0.9, // lưu lượng nhiên liệu phun, lít/giây
  tankL: 18,
};
export const G = 9.81;
export const WEIGHT_N = SPEC.massKg * G;

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

/** Bảng tích phân của f(t) từ 0, tra nội suy: pha cánh, điện năng, nhiên liệu đã phun. */
export function integral(f, T1, dt = 1 / 240) {
  const n = Math.ceil(T1 / dt) + 2;
  const A = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) A[i] = A[i - 1] + f((i - 0.5) * dt) * dt;
  return (t) => {
    const u = Math.min(n - 1e-6, Math.max(0, t / dt));
    const i = Math.floor(u);
    return A[i] + (A[i + 1] - A[i]) * (u - i);
  };
}

/**
 * ch = {wake, fold, wing, alt (đơn vị cảnh), jaw, breath, chest, explode, turn, look}; mỗi kênh là hàm (t).
 * Trả về state(t): mọi con số một khung cần.
 */
export function makeModel(ch, duration) {
  const phase = integral((t) => 2 * Math.PI * SPEC.flapHz * (0.55 + 0.45 * ch.wing(t)) * Math.min(1, ch.wing(t) * 4), duration + 1);
  const power = (t) => SPEC.idleKW * (0.3 + 0.7 * ch.wake(t)) + SPEC.flapKW * Math.pow(ch.wing(t), 3) + SPEC.flameKW * ch.breath(t);
  const used = integral(power, duration + 1); // kJ
  const fuel = integral((t) => SPEC.flameLs * ch.breath(t), duration + 1); // lít
  return (t) => {
    const u = ch.wing(t);
    const altU = ch.alt(t);
    const h = 1 / 60;
    const vs = ((ch.alt(t + h) - ch.alt(t - h)) / (2 * h)) * SPEC.unitM; // m/s
    const acc = ((ch.alt(t + h) - 2 * altU + ch.alt(t - h)) / (h * h)) * SPEC.unitM;
    const ph = phase(t);
    // lực nâng tỉ lệ (f·A)², trung bình chu kỳ; trong chu kỳ dồn vào nhịp đập xuống
    const liftN = WEIGHT_N * u * u;
    const liftInst = liftN * (1 + 0.85 * Math.sin(ph));
    const air = altU > 0.12 ? 1 : altU / 0.12;
    const legN = Math.max(0, WEIGHT_N - liftN) * (1 - air);
    const coreKW = power(t);
    const breath = ch.breath(t);
    return {
      t,
      u,
      wake: ch.wake(t),
      fold: ch.fold(t),
      flapHz: u > 0.02 ? SPEC.flapHz * (0.55 + 0.45 * u) : 0,
      amp: SPEC.ampDeg * Math.sqrt(u),
      phase: ph,
      altU,
      altM: altU * SPEC.unitM,
      vs,
      liftPct: (liftN / WEIGHT_N) * 100,
      liftInst,
      jigN: Math.max(0, SPEC.massKg * (G + acc) - liftN) * air,
      coreKW,
      energy: 100 - (used(t) / 3600 / SPEC.coreKWh) * 100 * 6, // phim nén 6 lần: một giây phim là 6 giây chạy thật
      coreC: 540 + 34 * coreKW + 6 * Math.sin(t * 0.9),
      fuelL: SPEC.tankL - fuel(t),
      flowLs: SPEC.flameLs * breath,
      flameC: breath > 0.02 ? 1080 + 260 * breath : 24,
      flameM: 2.6 * Math.sqrt(breath),
      legN, // tổng tải bốn chân
      air,
      pitch: -3 * u * Math.sin(ph) * 0.4 + 2.2 * acc - 5 * breath,
      roll: 1.2 * u * Math.sin(t * 0.61 + 1),
      jaw: ch.jaw(t),
      breath,
      chest: ch.chest(t),
      explode: ch.explode,
      turn: ch.turn(t),
      look: ch.look(t),
    };
  };
}

// chân hai đốt + bàn: IK phẳng trong mặt phẳng dọc thân (x tới, y lên). knee = +1 gối nhô tới, -1 gối nhô lùi.
export const LEG = {front: {L1: 0.95, L2: 0.9}, rear: {L1: 1.05, L2: 1.0}};
export function legIK(L1, L2, dx, dy, knee) {
  let d = Math.hypot(dx, dy);
  d = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, d));
  const th = Math.atan2(dy, dx);
  const a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const a1 = th + a * knee;
  const kx = L1 * Math.cos(a1);
  const ky = L1 * Math.sin(a1);
  const a2 = Math.atan2(d * Math.sin(th) - ky, d * Math.cos(th) - kx);
  return {a1, a2};
}
