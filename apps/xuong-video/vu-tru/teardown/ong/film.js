// MELLIS HB-7, phim tour: người điều khiển thả con ong cất cánh, soi mắt quang học, mở bụng xem pin, tách rời toàn bộ trên
// bàn xoay, lắp lại rồi thả bay lơ lửng. Mọi mốc thời gian đọc từ ../ong-film/timeline.json (tiếng cũng đọc tệp đó).
// render(t) là hàm thuần của t.
import {runSim} from 'teardown-kit/runtime.js';
import TL from '../ong-film/timeline.json';
import {createConsole} from './console.js';
import {makeModel, SPEC, ss} from './kin.js';
import {createStage} from './stage.js';

const E = TL.events;
export const DURATION = TL.duration;
export const SCRIPT = [
  {t: 0, view: 'hero'},
  {t: E.release, btn: 'hero', op: 'HERO · RELEASE', wing: 1},
  {t: E.liftoff, alt: 45},
  {t: E.head, btn: 'optics', op: 'ISOLATE · OPTICS', view: 'head', labels: 1},
  {t: E.abdomen, btn: 'abdomen', op: 'ISOLATE · ABDOMEN', view: 'abdomen', open: 1},
  {t: E.explode, btn: 'exploded', op: 'EXPLODED · ON', open: 0, wing: 0, explode: 1, view: 'orbit'},
  {t: E.reassemble, btn: 'exploded', op: 'EXPLODED · OFF', explode: 0, view: 'hero'},
  {t: E.hover, btn: 'hero', op: 'HERO · RELEASE', wing: 1, labels: 0, view: 'front'},
];
const DUR = {wing: 1.1, alt: 1.8, open: 0.9, explode: 1.6, labels: 0.4};
const INIT = {wing: 0, alt: 0, open: 0, explode: 0, labels: 0};
const evAt = (key, t) => {
  let v = INIT[key];
  for (const e of SCRIPT) if (e[key] !== undefined) v += (e[key] - v) * ss(e.t, e.t + DUR[key], t);
  return v;
};
const CH = {
  wing: (t) => evAt('wing', t),
  alt: (t) => evAt('alt', t),
  open: (t) => evAt('open', t),
  explode: (t) => evAt('explode', t),
  // bàn xoay lắc ±43° rồi về 0: quay trọn vòng thì có lúc trục thân chĩa vào ống kính, các phần chồng lên nhau
  turn: (t) => 0.75 * Math.sin(Math.PI * 2 * ss(E.explode + 0.6, E.reassemble + 1.2, t)),
  blur: () => 1,
};
const model = makeModel(CH, DURATION);
const STAND_Y = 1.0;
export const stateAt = (t) => {
  const s = model(t);
  s.bodyY = STAND_Y + s.altMM / 10; // 1 đơn vị = 10 mm
  return s;
};

// ------------------------------------------------------------ góc máy theo từng chế độ xem (u = giây từ lúc chuyển)
const VIEW_FN = {
  hero: (u, y) => ({tx: 0.1, ty: y + 0.2, tz: 0, az: 36 + 1.3 * u, el: 13, d: 12.5}),
  head: (u, y) => ({tx: 1.55, ty: y + 0.18, tz: 0, az: 22 + 0.9 * u, el: 7, d: 5.6}),
  abdomen: (u, y) => ({tx: -1.45, ty: y + 0.1, tz: 0, az: 140 + 1.1 * u, el: 21, d: 8}),
  orbit: (u, y) => ({tx: -0.3, ty: y + 0.2, tz: 0, az: 62, el: 12, d: 19}),
  front: (u, y) => ({tx: 0.2, ty: y + 0.3, tz: 0, az: 14 + 1.6 * u, el: 9, d: 12.5}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export const scriptView = (t) => VIEWS.filter(([t0]) => t0 <= t).pop();
export function viewAt(t, y) {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0], y);
  if (i === 0) return cur;
  const prev = VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0], y);
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.7, t);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  o.d += Math.max(0, Math.max(prev.d, cur.d) - o.d) * Math.sin(Math.PI * k) * 0.6;
  return o;
}

// ------------------------------------------------------------ con trỏ của người điều khiển
const REST = [[820, 470], [700, 520], [960, 420], [760, 560], [640, 450]];
export function makeCursor(spots) {
  const EV = SCRIPT.filter((e) => e.btn).map((e) => ({t: e.t, spot: spots[e.btn]}));
  const WP = [[0, 860, 600]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.15, ...e.spot], [e.t + 0.25, ...e.spot], [e.t + 1.8, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(26, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.06 && t < e.t + 0.1) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ dữ liệu bảng cho một khung
const CALLS = [
  ['optic', 'OPTIC HEAD', '2 × 16 MP · STEREO PAIR'],
  ['neck', 'NECK BEARING', '3-DOF GIMBAL COLLAR'],
  ['hinge', 'WING HINGE', 'PASSIVE PITCH ±38°'],
  ['gears', 'DRIVE GEARS', '4 STAGES · 1 : 2.5'],
  ['abdomen', 'ABDOMEN CAPSULE', '5 SEGMENTS · SLIDE APART'],
  ['cells', 'LI-PO CELLS', '2S · 12 mAh · 3.7 V'],
  ['leg', 'LEG SERVO R3', 'KNEE · 0.4 N·cm'],
];
const SHOW = {
  head: ['optic', 'neck'],
  abdomen: ['abdomen', 'cells'],
  orbit: ['optic', 'neck', 'hinge', 'gears', 'abdomen', 'cells', 'leg'],
};
const SUB_OK = [['TRACKING', ''], ['LOCKED', ''], ['DRIVING', ''], ['IN SYNC', ''], ['TUCKED', 'g'], ['SEALED', ''], ['STOWED', 'g']];
const SUB_PART = ['optic', 'neck', 'gear', 'wing', 'leg', 'abd', 'sting'];

export function makeFrame(ui, st) {
  const delayOf = Object.fromEntries(SUB_PART.map((n) => [n, st.bee.parts.find((p) => p.name === n).delay]));
  return (t, s, cursor) => {
    const [t0, view] = scriptView(t);
    const since = t - t0;
    const e = s.explode(t);
    const pct = Math.round(e * 100);
    let mode = 'PRE-FLIGHT';
    let modeSub = 'SELF TEST · ALL SERVOS NOMINAL';
    if (t >= E.release) [mode, modeSub] = ['TAKE-OFF', `SPIN-UP · ${Math.round(s.beat)} HZ STROKE`];
    if (s.altMM > 30) [mode, modeSub] = ['HOVER', `STATION KEEPING · ${Math.round(s.altMM)} MM AGL`];
    if (view === 'head') modeSub = 'OPTIC HEAD · TRACKING TARGET';
    if (s.open > 0.3) [mode, modeSub] = ['ABDOMEN OPEN', 'CAPSULE · 2 CELLS EXPOSED'];
    if (t >= E.explode && e > 0.03) [mode, modeSub] = ['TEARDOWN', `TURNTABLE ${Math.round((s.turn * 180) / Math.PI)}° · ${pct}% APART`];
    if (t >= E.reassemble) [mode, modeSub] = ['REASSEMBLY', e > 0.02 ? `${pct}% APART · PARTS SEATING` : 'ALL PARTS SEATED · JIG HOLD'];
    if (t >= E.hover) [mode, modeSub] = ['HOVER', 'RELEASE · STATION KEEPING'];
    const grounded = s.air < 0.5;
    const legState = e > 0.1 ? 'DETACHED' : grounded ? 'GROUNDED' : 'AIRBORNE';
    const legLoad = Array.from({length: 6}, (_, i) => (legState === 'GROUNDED' ? ((s.legShare / ((s.massG ?? SPEC.massG) * 9.81 / 6)) * 58) * (1 + 0.12 * Math.sin(t * 1.7 + i * 1.3)) : 0));
    const subs = SUB_PART.map((n, i) => {
      const ei = s.explode(t - delayOf[n]);
      if (ei > 0.05) return t >= E.reassemble ? ['SEATING', 'o'] : ['DETACHED', 'o'];
      if (n === 'abd' && s.open > 0.3) return ['OPEN', 'o'];
      if (t < E.release) return n === 'leg' ? ['GROUNDED', ''] : ['STANDBY', 'g'];
      if (n === 'leg' && grounded) return ['GROUNDED', ''];
      if (n === 'gear' && s.u < 0.05) return ['IDLE', 'g'];
      return SUB_OK[i];
    });
    const between = (a, b) => t >= a && t < b;
    const lit = {
      hero: between(E.release, E.head) || t >= E.hover,
      optics: between(E.head, E.abdomen),
      abdomen: between(E.abdomen, E.explode),
      exploded: between(E.explode, E.reassemble),
      labels: between(E.head, E.hover),
      blur: true,
      turntable: between(E.explode, E.reassemble + 1.2),
    };
    const lastOp = SCRIPT.filter((x) => x.op && x.t <= t).pop()?.op ?? 'PRE-FLIGHT CHECK';
    const waveHist = Array.from({length: 90}, (_, i) => {
      const s2 = stateAt(t - 1.2 + (i / 89) * 1.2);
      return s2.u * Math.sin(s2.phase);
    });
    // chú thích: hiện sau khi chuyển cảnh xong, tắt khi lắp lại
    const keys = SHOW[view] ?? [];
    const fade = ss(1.3, 1.9, since) * (view === 'orbit' ? ss(E.explode + 1.8, E.explode + 2.4, t) : 1);
    const callouts = CALLS.map(([key, name, sub], i) => {
      if (!keys.includes(key) || fade < 0.02) return null;
      const at = st.project(st.bee.anchors[key]);
      if (!at) return null;
      // nhãn rộng ~190 px: quay về phía còn chỗ giữa hai cột bảng (255..1345)
      let left = at[0] < 800;
      if (left && at[0] - 70 - 28 - 190 < 255) left = false;
      if (!left && at[0] + 70 + 28 + 190 > 1345) left = true;
      return {name, sub, at, dx: left ? -70 : 70, dy: i % 2 ? 46 : -46, o: fade};
    });
    ui.update({
      t,
      duration: DURATION,
      ...s,
      beatShown: s.beat,
      mode,
      modeSub,
      legState,
      legLoad,
      subs,
      lit,
      lastOp,
      waveHist,
      hold: true,
      callouts,
      cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setMarkers(SCRIPT.filter((e) => e.t > 0).map((e) => e.t), DURATION);
    const cursorAt = makeCursor(ui.spots);
    const frame = makeFrame(ui, st);
    window.HB7 = st;
    // trang tự lái (không phải lúc quay): kéo xoay, lăn phóng, nút trên bảng nhảy tới đúng cảnh; để yên 25 s thì con trỏ tour quay lại
    const live = {off: 0, az: 0, el: 0, zoom: 1, last: -1e9, now: 0};
    if (!capture) {
      const touch = () => (live.last = performance.now());
      let drag = null;
      canvas.addEventListener('pointerdown', (e) => {
        drag = [e.clientX, e.clientY, live.az, live.el];
        canvas.setPointerCapture(e.pointerId);
        touch();
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        live.az = drag[2] - (e.clientX - drag[0]) * 0.3;
        live.el = Math.max(-8, Math.min(60, drag[3] + (e.clientY - drag[1]) * 0.2));
        touch();
      });
      canvas.addEventListener('pointerup', () => (drag = null));
      canvas.addEventListener('dblclick', () => Object.assign(live, {az: 0, el: 0, zoom: 1}));
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        live.zoom = Math.max(0.45, Math.min(1.8, live.zoom * Math.exp(e.deltaY * 0.0012)));
        touch();
      }, {passive: false});
      canvas.style.cursor = 'grab';
      const JUMP = {hero: () => E.release, optics: () => E.head, abdomen: () => E.abdomen, thorax: () => E.explode, turntable: () => E.explode, wing: () => E.hover, exploded: (tt) => (tt >= E.explode && tt < E.reassemble ? E.reassemble : E.explode)};
      for (const [k, go] of Object.entries(JUMP)) {
        const b = ui.btn[k];
        b.style.pointerEvents = 'auto';
        b.style.cursor = 'pointer';
        b.addEventListener('click', () => {
          const tt = (((live.now + live.off) % DURATION) + DURATION) % DURATION;
          live.off = go(tt) - 0.25 - live.now;
          touch();
        });
      }
    }
    return {
      resize,
      render(t0) {
        live.now = t0;
        const t = capture ? t0 : (((t0 + live.off) % DURATION) + DURATION) % DURATION;
        const s = stateAt(t);
        const cam = viewAt(t, s.bodyY);
        st.frame(s, {...cam, az: cam.az + live.az, el: cam.el + live.el, d: cam.d * live.zoom, sy: 30});
        const idle = capture || performance.now() - live.last > 25000;
        frame(t, s, idle ? cursorAt(t) : {x: -60, y: -60, press: false, ring: 0, ringX: 0, ringY: 0});
        return {};
      },
    };
  };
}

export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'Mellis HB-7', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const run = () => runSim(DEFAULTS, makeFilm());
