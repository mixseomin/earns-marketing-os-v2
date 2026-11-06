// MELLIS HB-7: số liệu và mô hình bay. Kịch bản (film.js) chỉ đặt bốn kênh theo thời gian: ga cánh u (0..1), độ cao đích,
// mở bụng, tách rời. Mọi thứ khác (pha cánh, tần số đập, lực nâng, công suất, pin, tải servo chân) là hàm của các kênh đó,
// nên hình chuyển động, bảng số và tiếng không bao giờ lệch nhau. Không có three.js trong tệp này.

export const SPEC = {
  massG: 1.9, // khối lượng cất cánh
  lengthMM: 38,
  spanMM: 54,
  beatHz: 120, // tần số đập cánh thật khi lơ lửng
  playback: 16, // phim chạy chậm 16 lần: 120 Hz thật = 7,5 Hz trên màn
  ampDeg: 32, // biên độ quạt cánh khi lơ lửng
  cellMAh: 12, // pin LiPo 2 cell
  cellV: 3.7,
  idleW: 0.35, // điện nền (mắt, bộ điều khiển)
  hoverW: 3.9, // điện bộ đập cánh ở ga 1
};
export const G = 9.81;
export const WEIGHT_MN = SPEC.massG * G; // mN

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

/** Bảng tích phân của f(t) từ 0, tra nội suy: pha cánh, điện năng đã dùng, góc bàn xoay. */
export function integral(f, T1, dt = 1 / 480) {
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
 * Mô hình từ các kênh kịch bản. ch = {wing(t), alt(t) mm, open(t), explode(t), turn(t), blur(t)}.
 * Trả về state(t): mọi con số một khung cần.
 */
export function makeModel(ch, duration) {
  const beat = (t) => SPEC.beatHz * ch.wing(t); // Hz thật
  const phase = integral((t) => (2 * Math.PI * beat(t)) / SPEC.playback, duration + 1); // rad trên màn
  const power = (t) => SPEC.idleW + SPEC.hoverW * Math.pow(ch.wing(t), 3); // W
  const used = integral(power, duration + 1); // J nếu một giây phim là một giây thật
  const capJ = (SPEC.cellMAh / 1000) * 3600 * SPEC.cellV * 2;
  return (t) => {
    const u = ch.wing(t);
    const altMM = ch.alt(t);
    const h = 1 / 120;
    const vs = (ch.alt(t + h) - ch.alt(t - h)) / (2 * h); // mm/s trên màn
    const acc = (ch.alt(t + h) - 2 * altMM + ch.alt(t - h)) / (h * h) / 1000; // m/s²
    const liftMN = WEIGHT_MN * u * u; // lực nâng tỉ lệ (f·A)², ga 1 = vừa đỡ thân
    const needMN = SPEC.massG * (G + acc); // lực cần để theo đúng độ cao kịch bản
    const air = altMM > 3 ? 1 : altMM / 3;
    const legShare = Math.max(0, (WEIGHT_MN - liftMN) / 6) * (1 - air);
    // phim quay chậm 16 lần: một giây phim là 1/16 giây thật, nên điện năng thật = used / playback
    const battery = 81 - (used(t) / SPEC.playback / capJ) * 100;
    return {
      t,
      u,
      beat: beat(t),
      amp: SPEC.ampDeg * Math.sqrt(u),
      phase: phase(t),
      altMM,
      vs,
      liftPct: (liftMN / WEIGHT_MN) * 100,
      jigMN: Math.max(0, needMN - liftMN) * air, // phần đồ gá đỡ khi cánh tắt giữa không trung
      powerW: power(t),
      battery,
      cellV: SPEC.cellV - 0.05 * u - (81 - battery) * 0.01,
      motorC: 40 + 1.4 * u,
      legShare, // mN mỗi chân
      air,
      pitch: -1.2 * u * Math.sin(t * 0.7) + 0.6 * acc,
      roll: 0.8 * u * Math.sin(t * 0.53 + 1),
      open: ch.open(t),
      explode: ch.explode,
      turn: ch.turn(t), // góc bàn xoay (rad), kịch bản đặt trọn một vòng
      blur: ch.blur(t),
    };
  };
}

// chân: hai đốt, giải IK trong mặt phẳng đứng của chân (ra ngoài, lên)
export const LEG = {L1: 0.75, L2: 1.3};
export function legIK(dx, dy) {
  const {L1, L2} = LEG;
  let d = Math.hypot(dx, dy);
  d = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, d));
  const th = Math.atan2(dy, dx);
  const a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const a1 = th + a; // đùi chĩa lên, gối nhô cao như chân côn trùng
  const kx = L1 * Math.cos(a1);
  const ky = L1 * Math.sin(a1);
  // đích ngoài tầm với thì kéo về đúng tầm với, cùng hướng
  const a2 = Math.atan2(d * Math.sin(th) - ky, d * Math.cos(th) - kx);
  return {a1, a2};
}
