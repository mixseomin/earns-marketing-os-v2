// IGNIS DR-3, phim tour: rồng máy thức dậy trong nhà chứa, xoè cánh cất cánh, soi đầu rồi thử phun lửa, mở cửa ngực xem lõi,
// tách rời toàn bộ trên bàn xoay, lắp lại, bay tự do và phun lửa lần nữa, hạ cánh, gập cánh, ngủ lại (vòng lặp liền mạch).
// Mọi mốc đọc từ ../rong-film/timeline.json (tiếng cũng đọc tệp đó). render(t) là hàm thuần của t.
import {runSim} from 'teardown-kit/runtime.js';
import TL from '../rong-film/timeline.json';
import {createConsole} from './console.js';
import {makeModel, SPEC, ss, WEIGHT_N} from './kin.js';
import {createStage} from './stage.js';

const E = TL.events;
export const DURATION = TL.duration;
export const SCRIPT = [
  {t: 0, view: 'hero'},
  {t: E.wake, btn: 'hero', op: 'HERO · WAKE', wake: 1, fold: 1},
  {t: E.liftoff, wing: 1, alt: 2.2},
  {t: E.head, btn: 'head', op: 'ISOLATE · HEAD', view: 'head', labels: 1, look: 0.25},
  {t: E.flame - 0.45, jaw: 1},
  {t: E.flame, btn: 'flame', op: 'FLAME · IGNITE', breath: 1, look: -0.2},
  {t: E.flame + 2.5, breath: 0},
  {t: E.flame + 2.8, jaw: 0, look: 0},
  {t: E.core, btn: 'core', op: 'ISOLATE · CORE', view: 'core', chest: 1},
  {t: E.explode, btn: 'exploded', op: 'EXPLODED · ON', chest: 0, wing: 0, explode: 1, view: 'orbit'},
  {t: E.reassemble, btn: 'exploded', op: 'EXPLODED · OFF', explode: 0, view: 'hero'},
  {t: E.flight, btn: 'wing', op: 'WING · FLIGHT', wing: 1, labels: 0, view: 'front'},
  {t: E.flame2 - 0.4, jaw: 1, look: 0.3},
  {t: E.flame2, btn: 'flame', op: 'FLAME · IGNITE', breath: 1},
  {t: E.flame2 + 1.9, breath: 0},
  {t: E.flame2 + 2.2, jaw: 0, look: 0},
  {t: E.land, btn: 'hero', op: 'HERO · LAND', alt: 0, view: 'land'},
  {t: E.land + 1.6, wing: 0},
  {t: E.land + 2.1, fold: 0},
  {t: E.land + 3.0, wake: 0},
];
const DUR = {wake: 1.2, fold: 1.6, wing: 1.1, alt: 2.0, jaw: 0.35, breath: 0.4, chest: 1.0, explode: 1.8, labels: 0.4, look: 1.3};
const INIT = {wake: 0, fold: 0, wing: 0, alt: 0, jaw: 0, breath: 0, chest: 0, explode: 0, labels: 0, look: 0};
const evAt = (key, t) => {
  let v = INIT[key];
  for (const e of SCRIPT) if (e[key] !== undefined) v += (e[key] - v) * ss(e.t, e.t + DUR[key], t);
  return v;
};
const CH = Object.fromEntries(['wake', 'fold', 'wing', 'alt', 'jaw', 'breath', 'chest', 'explode', 'look'].map((k) => [k, (t) => evAt(k, t)]));
// bàn xoay lắc ±40° rồi về 0 (quay trọn vòng thì có lúc trục thân chĩa vào ống kính, các phần chồng lên nhau)
CH.turn = (t) => 0.7 * Math.sin(Math.PI * 2 * ss(E.explode + 0.6, E.reassemble + 1.2, t));
const model = makeModel(CH, DURATION);
const STAND_Y = 1.62;
export const stateAt = (t) => {
  const s = model(t);
  s.bodyY = STAND_Y + s.altU;
  s.breathAt = CH.breath;
  return s;
};

// ------------------------------------------------------------ góc máy theo từng chế độ xem (u = giây từ lúc chuyển, W = toạ độ mốc)
const VIEW_FN = {
  hero: (u, y) => ({tx: -0.9, ty: y + 0.8, tz: 0, az: 36 + 1.1 * u, el: 13, d: 30}),
  head: (u, y, W) => {
    const p = W('skull');
    return {tx: p.x + 1.1, ty: p.y - 0.2, tz: p.z, az: 52 + 1.4 * u, el: 7, d: 12.5};
  },
  core: (u, y, W) => {
    const p = W('core');
    return {tx: p.x, ty: p.y - 0.1, tz: p.z, az: 96 + 1.2 * u, el: -5, d: 13};
  },
  orbit: (u, y) => ({tx: -1.3, ty: y + 0.7, tz: 0, az: 58, el: 17, d: 37}),
  front: (u, y) => ({tx: 0.2, ty: y + 1.0, tz: 0, az: 16 + 1.5 * u, el: 9, d: 29}),
  land: (u, y) => ({tx: -0.6, ty: y + 0.7, tz: 0, az: 52 + 1.0 * u, el: 15, d: 31}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export const scriptView = (t) => VIEWS.filter(([t0]) => t0 <= t).pop();
export function viewAt(t, y, W) {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0], y, W);
  if (i === 0) return cur;
  const prev = VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0], y, W);
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.8, t);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  o.d += Math.max(0, Math.max(prev.d, cur.d) - o.d) * Math.sin(Math.PI * k) * 0.5;
  return o;
}

// ------------------------------------------------------------ con trỏ của người điều khiển
const REST = [[820, 470], [700, 520], [960, 420], [760, 560], [640, 450]];
export function makeCursor(spots) {
  const EV = SCRIPT.filter((e) => e.btn).map((e) => ({t: e.t, spot: spots[e.btn]}));
  const WP = [[0, 860, 600]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.15, ...e.spot], [e.t + 0.25, ...e.spot], [e.t + 1.6, ...REST[i % REST.length]]);
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
  ['skull', 'OPTIC SKULL', 'THERMAL PAIR · 9 HORN SEGMENTS'],
  ['eye', 'THERMAL EYES', '640 × 512 · 30 HZ'],
  ['jaw', 'JAW + IGNITER', '26 TEETH · ARC NOZZLE'],
  ['neck', 'NECK SPINE', '7 VERTEBRAE · 14 RAMS'],
  ['wing', 'WRIST JOINT', '4 FINGERS · 3 PHALANGES'],
  ['core', 'FUSION CORE', '4.2 kWh · TWIN GYRO RINGS'],
  ['turbine', 'INTAKE TURBINE', '11 BLADES · COOLING'],
  ['leg', 'HYDRAULIC RAM', 'KNEE · 180 BAR'],
  ['tail', 'TAIL SPINE', '14 SEGMENTS · COUNTERWEIGHT'],
  ['fin', 'BLADE FIN', 'RUDDER · COPPER'],
];
const SHOW = {
  head: ['skull', 'eye', 'jaw'],
  core: ['core', 'turbine'],
  orbit: ['skull', 'neck', 'wing', 'core', 'leg', 'tail', 'fin'],
};
const SUB_PART = ['neck', 'neck', 'neck', 'wing', 'core', 'leg', 'tail'];

export function makeFrame(ui, st) {
  const delayOf = SUB_PART.map((n) => st.bee.parts.find((p) => p.name === n).delay);
  return (t, s, cursor) => {
    const [t0, view] = scriptView(t);
    const since = t - t0;
    const e = s.explode(t);
    const pct = Math.round(e * 100);
    let mode = 'DORMANT';
    let modeSub = 'CORE IDLE · SYSTEMS COLD';
    if (s.wake > 0.05) [mode, modeSub] = ['WAKE', 'CORE SPIN-UP · WINGS UNFOLD'];
    if (t >= E.liftoff && s.u > 0.1) [mode, modeSub] = ['TAKE-OFF', `FLAP ${s.flapHz.toFixed(2)} HZ · LIFT ${Math.round(s.liftPct)}%`];
    if (s.altM > 0.4 && t < E.land) [mode, modeSub] = ['HOVER', `STATION KEEPING · ${s.altM.toFixed(2)} M AGL`];
    if (view === 'head' && s.breath < 0.1) modeSub = 'SKULL · THERMAL TRACK';
    if (s.breath > 0.1) [mode, modeSub] = ['FLAME TEST', `${s.flowLs.toFixed(2)} L/S · ${Math.round(s.flameC)} °C · ${s.flameM.toFixed(1)} M`];
    if (s.chest > 0.3) [mode, modeSub] = ['CORE OPEN', `CHEST DOORS · CORE ${Math.round(s.coreC)} °C`];
    if (t >= E.explode && e > 0.03) [mode, modeSub] = ['TEARDOWN', `TURNTABLE ${Math.round((s.turn * 180) / Math.PI)}° · ${pct}% APART`];
    if (t >= E.reassemble) [mode, modeSub] = ['REASSEMBLY', e > 0.02 ? `${pct}% APART · PARTS SEATING` : 'ALL PARTS SEATED · JIG HOLD'];
    if (t >= E.flight) [mode, modeSub] = s.breath > 0.1 ? ['FLAME TEST', `${s.flowLs.toFixed(2)} L/S · ${Math.round(s.flameC)} °C · ${s.flameM.toFixed(1)} M`] : ['FLIGHT', 'FREE HOVER · WINGS LIVE'];
    if (t >= E.land) [mode, modeSub] = s.altM > 0.05 ? ['LANDING', `DESCENT ${s.vs.toFixed(2)} M/S`] : s.wake > 0.5 ? ['TOUCHDOWN', 'WINGS FOLDING · RAMS LOCKED'] : ['DORMANT', 'CORE IDLE · SYSTEMS COLD'];
    const grounded = s.air < 0.5;
    const legState = e > 0.1 ? 'DETACHED' : grounded ? 'GROUNDED' : 'AIRBORNE';
    // bốn chân chia tải 45 / 55 trước / sau; 100% = trọng lượng chia đều bốn chân
    const quarter = WEIGHT_N / 4;
    const legLoad = [0.9, 0.9, 1.1, 1.1].map((w, i) => (legState === 'GROUNDED' ? ((s.legN / 4) * w / quarter) * 62 * (1 + 0.06 * Math.sin(t * 1.4 + i * 1.7)) : 0));
    legLoad.push(legState === 'DETACHED' ? 0 : 30 + 22 * s.wake + 18 * s.u + 35 * s.breath);
    legLoad.push(legState === 'DETACHED' ? 0 : 18 + 14 * s.wake + 22 * s.u);
    const subs = SUB_PART.map((n, i) => {
      const ei = s.explode(t - delayOf[i]);
      if (ei > 0.05) return t >= E.reassemble ? ['SEATING', 'o'] : ['DETACHED', 'o'];
      if (s.wake < 0.3) return ['STANDBY', 'g'];
      if (i === 0) return ['TRACKING', ''];
      if (i === 1) return s.breath > 0.1 ? ['FIRING', 'o'] : ['ARMED', ''];
      if (i === 2) return ['ARTICULATING', ''];
      if (i === 3) return s.u > 0.1 ? ['FLAPPING', ''] : s.fold > 0.5 ? ['SPREAD', 'g'] : ['FOLDED', 'g'];
      if (i === 4) return s.chest > 0.3 ? ['EXPOSED', 'o'] : ['ONLINE', ''];
      if (i === 5) return grounded ? ['GROUNDED', ''] : ['TUCKED', 'g'];
      return ['SWAYING', ''];
    });
    const between = (a, b) => t >= a && t < b;
    const lit = {
      hero: between(E.wake, E.head) || t >= E.land,
      head: between(E.head, E.core) && s.breath < 0.1,
      wing: between(E.flight, E.land),
      leg: false,
      core: between(E.core, E.explode),
      tail: false,
      labels: between(E.head, E.flight),
      exploded: between(E.explode, E.reassemble),
      flame: s.breath > 0.05,
      turntable: between(E.explode, E.reassemble + 1.2),
    };
    const lastOp = SCRIPT.filter((x) => x.op && x.t <= t).pop()?.op ?? 'SYSTEMS COLD';
    const waveHist = Array.from({length: 90}, (_, i) => {
      const s2 = stateAt(t - 2.4 + (i / 89) * 2.4);
      return s2.u * Math.sin(s2.phase);
    });
    const flameHist = Array.from({length: 36}, (_, i) => CH.breath(t - 3.5 + (i / 35) * 3.5));
    const keys = SHOW[view] ?? [];
    const fade = ss(1.4, 2.0, since) * (view === 'orbit' ? ss(E.explode + 2.0, E.explode + 2.6, t) : 1);
    const callouts = CALLS.filter(([key]) => keys.includes(key)).map(([key, name, sub], i) => {
      if (fade < 0.02) return null;
      const at = st.project(st.bee.anchors[key]);
      if (!at) return null;
      let left = at[0] < 800;
      if (left && at[0] - 70 - 28 - 200 < 255) left = false;
      if (!left && at[0] + 70 + 28 + 200 > 1345) left = true;
      return {name, sub, at, dx: left ? -70 : 70, dy: i % 2 ? 46 : -46, o: fade};
    });
    while (callouts.length < 7) callouts.push(null);
    ui.update({...s, t, duration: DURATION, mode, modeSub, legState, legLoad, subs, lit, lastOp, waveHist, flameHist, hold: true, callouts, cursor});
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    ui.setMarkers(SCRIPT.filter((e) => e.op).map((e) => e.t), DURATION);
    const cursorAt = makeCursor(ui.spots);
    const frame = makeFrame(ui, st);
    window.DR3 = st;
    // trang tự lái (không phải lúc quay): kéo xoay, lăn phóng, nút trên bảng nhảy tới đúng cảnh; để yên 25 s thì tour quay lại
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
        live.zoom = Math.max(0.35, Math.min(1.8, live.zoom * Math.exp(e.deltaY * 0.0012)));
        touch();
      }, {passive: false});
      canvas.style.cursor = 'grab';
      const JUMP = {
        hero: () => E.wake,
        head: () => E.head,
        flame: (tt) => (tt >= E.reassemble ? E.flame2 - 0.6 : E.flame - 0.6),
        core: () => E.core,
        wing: () => E.flight,
        leg: () => E.land,
        tail: () => E.explode,
        labels: () => E.head,
        turntable: () => E.explode,
        exploded: (tt) => (tt >= E.explode && tt < E.reassemble ? E.reassemble : E.explode),
      };
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
        st.frame(s, (W) => {
          const cam = viewAt(t, s.bodyY, W);
          return {...cam, az: cam.az + live.az, el: cam.el + live.el, d: cam.d * live.zoom, sy: 30};
        });
        const idle = capture || performance.now() - live.last > 25000;
        frame(t, s, idle ? cursorAt(t) : {x: -60, y: -60, press: false, ring: 0, ringX: 0, ringY: 0});
        return {};
      },
    };
  };
}

export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'dark', hud: {enabled: false, title: 'Ignis DR-3', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const run = () => runSim(DEFAULTS, makeFilm());
export {SPEC};
