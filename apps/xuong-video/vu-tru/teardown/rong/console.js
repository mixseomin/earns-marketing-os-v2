// Bảng điều khiển DR-3: khung 1600×900 cố định phủ lên sân khấu. update(d) vẽ lại mọi phần sống từ state của khung,
// nên một khung quay ra chỉ phụ thuộc t. Nền than, chữ ngà, cam lửa cho thứ đang thay đổi, xanh lõi cho năng lượng.
export const C = {ink: '#ebe7e0', mute: '#8b9099', faint: '#3a3f47', line: 'rgba(220,226,236,.14)', paper: 'rgba(20,22,26,.86)', accent: '#ff6a2b', green: '#3cc6e8', dark: '#cfd4db', btn: '#1d2025'};

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none}
.pn{position:absolute;background:${C.paper};border:1px solid ${C.line}}
.hd{position:absolute;font-size:8.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;white-space:nowrap}
.hd:before{content:'';display:inline-block;width:2px;height:9px;background:${C.accent};margin-right:6px;vertical-align:-1px}
.no{position:absolute;font:600 8px 'JetBrains Mono',monospace;color:${C.mute}}
.lb{position:absolute;font-size:7.5px;font-weight:600;letter-spacing:1.2px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.big{position:absolute;font:600 25px 'JetBrains Mono',monospace;letter-spacing:-.5px}
.big small{font-size:10px;color:${C.mute};margin-left:2px;letter-spacing:0}
.bt{position:absolute;height:17px;display:flex;align-items:center;justify-content:center;font:700 7.5px Inter;letter-spacing:1.2px;border:1px solid ${C.line};background:${C.btn};color:${C.dark}}
.bt.on{background:${C.accent};border-color:${C.accent};color:#111}
.chip{position:absolute;height:12px;padding:0 5px;display:flex;align-items:center;font:700 6.5px Inter;letter-spacing:1px;color:#0d1114;background:${C.green}}
.chip.o{background:${C.accent}}.chip.g{background:${C.faint};color:${C.dark}}
.call{position:absolute;white-space:nowrap;padding:3px 6px;background:rgba(20,22,26,.88);border-left:2px solid ${C.accent}}
.call b{display:block;font-size:8px;font-weight:700;letter-spacing:1.3px}
.call span{display:block;font-size:7px;letter-spacing:1px;color:${C.mute};margin-top:1px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))}
.ring{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:1.6px solid ${C.accent};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
export const ASSEMBLIES = [['hero', 'HERO'], ['head', 'HEAD'], ['wing', 'WING'], ['leg', 'LEG RR'], ['core', 'CORE'], ['tail', 'TAIL']];
export const DISPLAY = [['labels', 'LABELS'], ['exploded', 'EXPLODED'], ['flame', 'FLAME'], ['turntable', 'TURNTABLE']];
export const SUBSYS = [
  ['OPTIC SKULL', '2 × THERMAL · 9 HORN SEGS'],
  ['JAW + IGNITER', '26 TEETH · ARC NOZZLE'],
  ['NECK SPINE', '7 VERTEBRAE · 14 RAMS'],
  ['WING ARRAY', '2 × 4 FINGERS · 3.4 M SPAN'],
  ['FUSION CORE', '4.2 kWh · TWIN GYRO'],
  ['LEG ACTUATORS', '4 × HYDRAULIC · 3 CLAWS'],
  ['TAIL SPINE', '14 SEGMENTS · BLADE FIN'],
];
const LEGS = ['FL', 'FR', 'RL', 'RR', 'NECK', 'TAIL'];

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const canvas = (x, y, w, h) => {
    const c = add(`<canvas style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px"></canvas>`);
    c.width = w * 2;
    c.height = h * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    return {g, w, h};
  };
  const panel = (x, y, w, h, title, no) => {
    add(`<div class="pn" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="hd" style="left:${x + 10}px;top:${y + 9}px">${title}</div>`);
    add(`<div class="no" style="left:${x + w - 22}px;top:${y + 9}px">${no}</div>`);
  };
  const spots = {};

  // ---------------------------------------------------------------- thanh đầu
  add(`<div style="position:absolute;left:0;right:0;top:0;height:58px;border-bottom:1px solid ${C.line};background:rgba(18,20,24,.82)"></div>`);
  add(`<div style="position:absolute;left:14px;top:10px;width:64px;height:38px;background:${C.accent};color:#111;display:flex;align-items:center;justify-content:center;font:700 13px 'JetBrains Mono';letter-spacing:1px">DR-3</div>`);
  add(`<div class="lb" style="left:92px;top:10px">ARTICULATED WYVERN · FLAME-TEST AIRFRAME</div>`);
  add(`<div style="position:absolute;left:91px;top:20px;font-size:21px;font-weight:600;letter-spacing:.2px">Ignis DR-3 <span style="color:${C.accent}">/</span></div>`);
  add(`<div class="lb" style="left:92px;top:45px;color:${C.dark}">HEAVY FLAPPING DRONE / HANGAR SIMULATOR</div>`);
  add(`<div class="lb" style="left:560px;top:12px">LIFT LOAD</div>`);
  const liftVal = add(`<div class="mono" style="position:absolute;left:1000px;top:10px;font-size:10px;font-weight:600;width:40px;text-align:right"></div>`);
  const ticks = [];
  for (let i = 0; i < 64; i++) ticks.push(add(`<div style="position:absolute;left:${560 + i * 7.1}px;top:25px;width:4px;height:12px;background:${C.faint}"></div>`));
  add(`<div class="lb" style="left:560px;top:42px">IDLE</div><div class="lb" style="left:1015px;top:42px">MAX</div>`);
  const meta = {};
  [['SIM ID', 'id', 'DR3-0091'], ['RUNTIME', 'rt', ''], ['STATUS', 'st', ''], ['OPERATOR', 'op', 'HANGAR 2 · M.V.']].forEach(([k, key, v], i) => {
    add(`<div class="lb" style="left:${1110 + i * 118}px;top:14px">${k}</div>`);
    meta[key] = add(`<div class="mono" style="position:absolute;left:${1110 + i * 118}px;top:27px;font-size:10px;font-weight:600">${v}</div>`);
  });

  // ---------------------------------------------------------------- cột trái
  const L = 14;
  const LW = 230;
  panel(L, 70, LW, 152, 'WING DRIVE', '01');
  const beat = add(`<div class="big" style="left:${L + 10}px;top:88px"></div>`);
  const amp = add(`<div class="mono" style="position:absolute;left:${L + 150}px;top:96px;font-size:15px;font-weight:600"></div>`);
  add(`<div class="lb" style="left:${L + 10}px;top:120px">FLAP FREQUENCY</div><div class="lb" style="left:${L + 150}px;top:120px">AMPLITUDE</div>`);
  const wave = canvas(L + 10, 134, LW - 20, 60);
  add(`<div class="lb" style="left:${L + 10}px;top:203px">LIFT / STROKE</div><div class="lb" style="left:${L + 150}px;top:203px">SPAN 3.4 M</div>`);

  panel(L, 230, LW, 118, 'FUSION CORE', '02');
  const batt = add(`<div class="big" style="left:${L + 10}px;top:248px"></div>`);
  const cellsBar = [];
  for (let i = 0; i < 12; i++) cellsBar.push(add(`<div style="position:absolute;left:${L + 96 + i * 10.5}px;top:258px;width:7px;height:14px;background:${C.faint}"></div>`));
  add(`<div class="lb" style="left:${L + 10}px;top:280px">CORE CHARGE</div>`);
  const pw = {};
  [['DRAW', 'draw'], ['CORE', 'cell'], ['FUEL', 'motor']].forEach(([k, key], i) => {
    add(`<div class="lb" style="left:${L + 10 + i * 72}px;top:300px">${k}</div>`);
    pw[key] = add(`<div class="mono" style="position:absolute;left:${L + 10 + i * 72}px;top:313px;font-size:11px;font-weight:600"></div>`);
  });

  panel(L, 356, LW, 196, 'LIMB ACTUATORS', '03');
  add(`<div class="lb" style="left:${L + 10}px;top:374px">LOAD PER LIMB · RAM PRESSURE</div>`);
  const legChip = add(`<div class="chip g" style="left:${L + LW - 70}px;top:380px"></div>`);
  const legRows = LEGS.map((k, i) => {
    const y = 400 + i * 24;
    add(`<div class="lb" style="left:${L + 10}px;top:${y + 2}px;color:${C.dark}">${k}</div>`);
    add(`<div style="position:absolute;left:${L + 34}px;top:${y + 3}px;width:${LW - 90}px;height:5px;background:rgba(40,34,28,.08)"></div>`);
    const bar = add(`<div style="position:absolute;left:${L + 34}px;top:${y + 3}px;width:0;height:5px;background:${C.dark}"></div>`);
    const val = add(`<div class="mono" style="position:absolute;left:${L + LW - 46}px;top:${y}px;font-size:9px;font-weight:600;width:36px;text-align:right"></div>`);
    return {bar, val};
  });

  panel(L, 560, LW, 112, 'IGNITER', '09');
  const fm = {};
  [['FLOW', 'flow'], ['TEMP', 'temp'], ['REACH', 'reach']].forEach(([k, key], i) => {
    add(`<div class="lb" style="left:${L + 10 + i * 72}px;top:580px">${k}</div>`);
    fm[key] = add(`<div class="mono" style="position:absolute;left:${L + 10 + i * 72}px;top:593px;font-size:11px;font-weight:600"></div>`);
  });
  const flameBar = canvas(L + 10, 616, LW - 20, 44);

  // ---------------------------------------------------------------- cột phải
  const R = 1356;
  const RW = 230;
  panel(R, 70, RW, 152, 'FLIGHT', '04');
  const dial = canvas(R + 10, 88, 86, 86);
  const fl = {};
  [['ALT AGL', 'alt'], ['V/S', 'vs'], ['PITCH', 'pitch'], ['ROLL', 'roll']].forEach(([k, key], i) => {
    add(`<div class="lb" style="left:${R + 108}px;top:${92 + i * 20}px">${k}</div>`);
    fl[key] = add(`<div class="mono" style="position:absolute;left:${R + 150}px;top:${90 + i * 20}px;font-size:10px;font-weight:600;width:68px;text-align:right"></div>`);
  });
  const hold = add(`<div class="bt" style="left:${R + 10}px;top:194px;width:58px">HOLD</div>`);
  add(`<div class="lb" style="left:${R + 76}px;top:199px">POSITION</div>`);
  add(`<div class="lb" style="left:${R + 130}px;top:199px">AIRSPEED</div>`);
  const air = add(`<div class="mono" style="position:absolute;left:${R + 178}px;top:196px;font-size:9px;font-weight:600"></div>`);

  panel(R, 230, RW, 76, 'ASSEMBLIES', '05');
  const btn = {};
  ASSEMBLIES.forEach(([k, txt], i) => {
    const x = R + 10 + (i % 4) * 53;
    const y = 250 + Math.floor(i / 4) * 24;
    btn[k] = add(`<div class="bt" style="left:${x}px;top:${y}px;width:${i >= 4 ? 70 : 49}px">${txt}</div>`);
    if (i >= 4) btn[k].style.left = `${R + 10 + (i - 4) * 74}px`;
    spots[k] = [(i >= 4 ? R + 10 + (i - 4) * 74 + 35 : x + 24), y + 8];
  });

  panel(R, 314, RW, 76, 'DISPLAY', '06');
  DISPLAY.forEach(([k, txt], i) => {
    const x = R + 10 + (i % 3) * 71;
    const y = 334 + Math.floor(i / 3) * 24;
    btn[k] = add(`<div class="bt" style="left:${x}px;top:${y}px;width:${i === 2 ? 70 : 66}px">${txt}</div>`);
    spots[k] = [x + 33, y + 8];
  });

  panel(R, 398, RW, 196, 'SUBSYSTEMS', '07');
  const subs = SUBSYS.map(([k, sub], i) => {
    const y = 420 + i * 24;
    add(`<div class="mono" style="position:absolute;left:${R + 10}px;top:${y}px;font-size:7.5px;color:${C.mute}">0${i + 1}</div>`);
    add(`<div style="position:absolute;left:${R + 26}px;top:${y - 1}px;font-size:8px;font-weight:700;letter-spacing:1px">${k}</div>`);
    add(`<div class="lb" style="left:${R + 26}px;top:${y + 9}px;font-size:6.5px">${sub}</div>`);
    return add(`<div class="chip" style="left:${R + RW - 64}px;top:${y + 1}px;width:54px;justify-content:center"></div>`);
  });

  // ---------------------------------------------------------------- nhãn chế độ bay và nhật ký bay
  const mode = add(`<div style="position:absolute;left:262px;top:742px;font-size:30px;font-weight:600;letter-spacing:.5px;color:${C.accent}"></div>`);
  const modeSub = add(`<div class="lb" style="left:263px;top:780px;color:${C.dark}"></div>`);
  add(`<div class="lb" style="left:263px;top:730px">FLIGHT MODE</div>`);
  panel(250, 812, 1100, 74, 'FLIGHT LOG', '08');
  add(`<div style="position:absolute;left:262px;top:836px;width:26px;height:26px;border-radius:50%;background:${C.accent};display:grid;place-items:center;color:#fff;font-size:9px">❚❚</div>`);
  add(`<div style="position:absolute;left:300px;top:848px;width:1010px;height:2px;background:${C.faint}"></div>`);
  const prog = add(`<div style="position:absolute;left:300px;top:848px;width:0;height:2px;background:${C.accent}"></div>`);
  const knob = add(`<div style="position:absolute;left:300px;top:844px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:${C.accent}"></div>`);
  const logOp = add(`<div class="lb" style="left:700px;top:830px;color:${C.accent}"></div>`);
  const logT = add(`<div class="mono" style="position:absolute;left:300px;top:860px;font-size:8px;color:${C.mute}"></div>`);
  add(`<div class="lb" style="left:300px;top:830px">TAKE-OFF</div><div class="lb" style="left:1290px;top:830px">LAND</div>`);
  const markers = [];
  const setMarkers = (times, dur) => {
    for (const t of times) markers.push(add(`<div style="position:absolute;left:${300 + (t / dur) * 1010}px;top:843px;width:1px;height:12px;background:${C.mute}"></div>`));
  };

  // ---------------------------------------------------------------- chú thích có đường dẫn
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '1600');
  svg.setAttribute('height', '900');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  ui.appendChild(svg);
  const calls = [];
  const callout = () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', C.accent);
    line.setAttribute('stroke-width', '1');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', C.accent);
    svg.append(line, dot);
    const box = add(`<div class="call"><b></b><span></span></div>`);
    return {line, dot, box};
  };
  for (let i = 0; i < 7; i++) calls.push(callout());

  const cur = add(`<svg class="cur" width="18" height="22" viewBox="0 0 18 22"><path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>`);
  const ring = add(`<div class="ring"></div>`);

  const covered = (x, y) => x < 255 || x > 1345 || y < 64 || y > 800;
  const fmt = (n, d = 0) => Number(n).toFixed(d);
  const mmss = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}`;

  function update(d) {
    // đầu trang
    liftVal.textContent = `${fmt(d.liftPct)}%`;
    ticks.forEach((n, i) => (n.style.background = i < (d.liftPct / 100) * 52 ? (i > 47 ? C.accent : C.dark) : C.faint));
    meta.rt.textContent = `00:00:${String(Math.floor(d.t)).padStart(2, '0')}`;
    meta.st.innerHTML = `<span style="color:${C.accent}">●</span> ${d.mode}`;
    // cánh
    beat.innerHTML = `${fmt(d.flapHz, 2)}<small>HZ</small>`;
    amp.textContent = `±${fmt(d.amp)}°`;
    const {g, w, h} = wave;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = C.line;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
    g.strokeStyle = C.accent;
    g.lineWidth = 1.4;
    g.beginPath();
    d.waveHist.forEach((v, i) => {
      const x = (i / (d.waveHist.length - 1)) * w;
      const y = h / 2 - v * (h * 0.42);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
    // điện
    batt.innerHTML = `${fmt(d.energy)}<small>%</small>`;
    cellsBar.forEach((n, i) => (n.style.background = i < Math.round((d.energy / 100) * 12) ? C.green : C.faint));
    pw.draw.textContent = `${fmt(d.coreKW, 1)} kW`;
    pw.cell.textContent = `${fmt(d.coreC)} °C`;
    pw.motor.textContent = `${fmt(d.fuelL, 1)} L`;
    fm.flow.textContent = `${fmt(d.flowLs, 2)} L/s`;
    fm.temp.textContent = `${fmt(d.flameC)} °C`;
    fm.reach.textContent = `${fmt(d.flameM, 1)} M`;
    {
      const {g, w, h} = flameBar;
      g.clearRect(0, 0, w, h);
      g.fillStyle = C.faint;
      g.fillRect(0, h - 3, w, 1);
      d.flameHist.forEach((v, i) => {
        const x = (i / d.flameHist.length) * w;
        const bh = v * (h - 6);
        g.fillStyle = v > 0.6 ? C.accent : C.dark;
        g.fillRect(x, h - 4 - bh, w / d.flameHist.length - 1, bh);
      });
    }
    // chân
    legChip.textContent = d.legState;
    legChip.className = `chip ${d.legState === 'GROUNDED' ? '' : d.legState === 'DETACHED' ? 'o' : 'g'}`;
    legRows.forEach((r, i) => {
      const p = d.legLoad[i];
      r.bar.style.width = `${(p / 100) * 140}px`;
      r.bar.style.background = p > 70 ? C.accent : C.dark;
      r.val.textContent = d.legState === 'DETACHED' ? '—' : `${fmt(p)}%`;
    });
    // bay
    {
      const {g, w, h} = dial;
      g.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const r = w / 2 - 3;
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#1b1e23';
      g.fillRect(0, 0, w, h);
      g.translate(cx, cy);
      g.rotate((-d.roll * Math.PI) / 180);
      g.fillStyle = 'rgba(255,106,43,.16)';
      g.fillRect(-r, d.pitch * 2.2, r * 2, r);
      g.strokeStyle = C.accent;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-r, d.pitch * 2.2);
      g.lineTo(r, d.pitch * 2.2);
      g.stroke();
      g.restore();
      g.strokeStyle = C.line;
      g.lineWidth = 1;
      for (const rr of [r, r * 0.66, r * 0.33]) {
        g.beginPath();
        g.arc(cx, cy, rr, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = C.dark;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cx - 18, cy);
      g.lineTo(cx - 6, cy);
      g.moveTo(cx + 6, cy);
      g.lineTo(cx + 18, cy);
      g.stroke();
    }
    fl.alt.textContent = `${fmt(d.altM, 2)} m`;
    fl.vs.textContent = `${d.vs >= 0 ? '+' : ''}${fmt(d.vs, 2)} m/s`;
    fl.pitch.textContent = `${d.pitch >= 0 ? '+' : ''}${fmt(d.pitch, 2)}°`;
    fl.roll.textContent = `${d.roll >= 0 ? '+' : ''}${fmt(d.roll, 2)}°`;
    hold.className = `bt${d.hold ? ' on' : ''}`;
    air.textContent = `${fmt(Math.abs(d.vs), 2)} M/S`;
    // nút
    for (const k in btn) btn[k].className = `bt${d.lit[k] ? ' on' : ''}`;
    subs.forEach((n, i) => {
      const [txt, kind] = d.subs[i];
      n.textContent = txt;
      n.className = `chip ${kind}`;
    });
    // chế độ + nhật ký
    mode.textContent = d.mode;
    modeSub.textContent = d.modeSub;
    const k = d.t / d.duration;
    prog.style.width = `${k * 1010}px`;
    knob.style.left = `${300 + k * 1010}px`;
    logOp.textContent = `OPERATOR · ${d.lastOp}`;
    logT.textContent = `${mmss(d.t)} / ${mmss(d.duration)}`;
    // chú thích
    calls.forEach((c, i) => {
      const a = d.callouts[i];
      const show = a && a.o > 0.02 && a.at && !covered(a.at[0], a.at[1]);
      c.line.style.opacity = c.dot.style.opacity = c.box.style.opacity = show ? a.o : 0;
      if (!show) return;
      const [x, y] = a.at;
      const lx = x + a.dx;
      const ly = y + a.dy;
      c.dot.setAttribute('cx', x);
      c.dot.setAttribute('cy', y);
      c.line.setAttribute('points', `${x},${y} ${lx},${ly} ${lx + (a.dx > 0 ? 24 : -24)},${ly}`);
      c.box.querySelector('b').textContent = a.name;
      c.box.querySelector('span').textContent = a.sub;
      c.box.style.left = `${a.dx > 0 ? lx + 28 : lx - 28}px`;
      c.box.style.top = `${ly - 13}px`;
      c.box.style.transform = a.dx > 0 ? '' : 'translateX(-100%)';
    });
    // con trỏ
    const cu = d.cursor;
    cur.style.transform = `translate(${cu.x}px,${cu.y}px) scale(${cu.press ? 0.88 : 1})`;
    ring.style.opacity = cu.ring;
    ring.style.left = `${cu.ringX}px`;
    ring.style.top = `${cu.ringY}px`;
    ring.style.transform = `scale(${1.6 - cu.ring * 0.6})`;
  }
  return {update, spots, setMarkers, covered, btn};
}
