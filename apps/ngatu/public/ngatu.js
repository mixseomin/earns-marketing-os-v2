// ngatu.js — Ngã tư (ngatu.on.tc): mô phỏng một ngã tư Việt Nam giờ tan tầm trên three.js. Anh 21/11/2026 "Thử đi. Chọn 1 sub mới".
// Bước 1 của lộ trình: một ngã tư, vài trăm xe máy chảy như dòng nước (lách khe, dồn cục ở vạch dừng, leo lề, rẽ phải khi đỏ,
// vượt đèn), ô tô + xe buýt theo làn, đèn có đồng hồ đếm ngược, người đi bộ băng qua kiểu "cứ đi đều, xe sẽ tránh".
// tra-repo-ok: đã tra GitHub (movsim/traffic-simulation-de GPL-3.0 — mô hình theo làn, không có dòng xe máy bầy đàn) nên tự viết lớp giả lập
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ───────────────────────── hình học đường ─────────────────────────
// Trục x = Đông, trục z = Nam. Đường Đông–Tây rộng 2×10 m, Bắc–Nam 2×8 m, vỉa hè 4 m. Xe đi bên phải.
const L = 165, HW_EW = 10, HW_NS = 8, SW = 4, CW = 4;
const right = (d) => [-d[1], d[0]];
const neg = (d) => [-d[0], -d[1]];
const hwAlong = (d) => (d[0] !== 0 ? HW_EW : HW_NS); // nửa mặt đường của con đường chạy theo hướng d
const eAlong = (d) => (d[0] !== 0 ? HW_NS : HW_EW); // nửa lòng ngã tư đo theo hướng d
const ARMS = [
  { ten: 'Tây', d: [1, 0], g: 0, w: 0.3 },
  { ten: 'Đông', d: [-1, 0], g: 0, w: 0.3 },
  { ten: 'Bắc', d: [0, 1], g: 1, w: 0.2 },
  { ten: 'Nam', d: [0, -1], g: 1, w: 0.2 },
];
const rnd = (a, b) => a + Math.random() * (b - a);
const chon = (ds) => ds[(Math.random() * ds.length) | 0];

function taoPath(pts) {
  const n = pts.length;
  const x = new Float32Array(n), z = new Float32Array(n), s = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = pts[i][0]; z[i] = pts[i][1];
    if (i) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const dx = x[b] - x[a], dz = z[b] - z[a], l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l; tz[i] = dz / l;
  }
  return { x, z, s, tx, tz, len: s[n - 1] };
}
function doan(out, A, B, buoc) {
  const k = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / buoc));
  for (let i = 0; i < k; i++) out.push([A[0] + ((B[0] - A[0]) * i) / k, A[1] + ((B[1] - A[1]) * i) / k]);
}
// Đường đi của một xe: đoạn thẳng vào → cung Bézier trong lòng ngã tư → đoạn thẳng ra. o1/o2 = khoảng cách sang phải tim đường.
function taoDuongXe(d, d2, o1, o2) {
  const r1 = right(d), r2 = right(d2), e1 = eAlong(d), e2 = eAlong(d2);
  const P0 = [-L * d[0] + o1 * r1[0], -L * d[1] + o1 * r1[1]];
  const Pi = [-e1 * d[0] + o1 * r1[0], -e1 * d[1] + o1 * r1[1]];
  const Pe = [e2 * d2[0] + o2 * r2[0], e2 * d2[1] + o2 * r2[1]];
  const Pf = [L * d2[0] + o2 * r2[0], L * d2[1] + o2 * r2[1]];
  const cross = d[0] * d2[1] - d[1] * d2[0];
  let C;
  if (Math.abs(cross) < 1e-6) C = [(Pi[0] + Pe[0]) / 2, (Pi[1] + Pe[1]) / 2];
  else {
    const bx = Pe[0] - Pi[0], bz = Pe[1] - Pi[1];
    const t = (bx * d2[1] - bz * d2[0]) / cross;
    C = [Pi[0] + t * d[0], Pi[1] + t * d[1]];
  }
  const pts = [];
  doan(pts, P0, Pi, 2);
  const iPi = pts.length, N = 22;
  for (let i = 0; i < N; i++) {
    const t = i / N, q = 1 - t;
    pts.push([q * q * Pi[0] + 2 * q * t * C[0] + t * t * Pe[0], q * q * Pi[1] + 2 * q * t * C[1] + t * t * Pe[1]]);
  }
  const iPe = pts.length;
  doan(pts, Pe, Pf, 2);
  pts.push(Pf);
  const p = taoPath(pts);
  p.sIn = p.s[iPi]; p.sStop = p.sIn - CW; p.sOut = p.s[iPe];
  p.o1 = o1; p.o2 = o2; p.hw1 = hwAlong(d); p.hw2 = hwAlong(d2);
  return p;
}
function mau(p, a) {
  const S = p.s, n = S.length - 1;
  let i = a.k;
  while (i < n - 1 && S[i + 1] <= a.s) i++;
  a.k = i;
  const t = Math.min(1, Math.max(0, (a.s - S[i]) / (S[i + 1] - S[i] || 1)));
  a.px = p.x[i] + (p.x[i + 1] - p.x[i]) * t;
  a.pz = p.z[i] + (p.z[i + 1] - p.z[i]) * t;
  const fx = p.tx[i] + (p.tx[i + 1] - p.tx[i]) * t, fz = p.tz[i] + (p.tz[i + 1] - p.tz[i]) * t, l = Math.hypot(fx, fz) || 1;
  a.fx = fx / l; a.fz = fz / l;
}

// ───────────────────────── đèn giao thông ─────────────────────────
// Chu kỳ 50 s: Đông–Tây xanh 22 + vàng 3, đỏ toàn phần 2, Bắc–Nam xanh 18 + vàng 3, đỏ toàn phần 2.
const CHU_KY = 50;
const LICH = [{ x0: 0, x1: 22, v1: 25 }, { x0: 27, x1: 45, v1: 48 }];
function den(g, t) {
  const l = LICH[g];
  if (t >= l.x0 && t < l.x1) return ['x', l.x1 - t, 0];
  if (t >= l.x1 && t < l.v1) return ['v', l.v1 - t, 0];
  let con = l.x0 - t; if (con <= 0) con += CHU_KY;
  let qua = t - l.v1; if (qua < 0) qua += CHU_KY;
  return ['d', con, qua];
}

const CAI = { matDo: 450, lieu: 0.12, rePhai: true, toc: 1, dung: false, vuot: 0 };
let tc = 0, tg = 0;

// ───────────────────────── lưới tra láng giềng ─────────────────────────
const CELL = 6, G = 64, OFF = 32;
const head = new Int32Array(G * G);
let nxt = new Int32Array(4096);
const DS = [];
const cellX = (x) => Math.max(0, Math.min(G - 1, Math.floor(x / CELL) + OFF));
function dungLuoi() {
  head.fill(-1);
  if (nxt.length < DS.length) nxt = new Int32Array(DS.length * 2);
  for (let i = 0; i < DS.length; i++) {
    const c = cellX(DS[i].x) * G + cellX(DS[i].z);
    nxt[i] = head[c]; head[c] = i;
  }
}
let moi = [];
function gan(x, z, r) {
  const cx = cellX(x), cz = cellX(z);
  for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
    if (gx < 0 || gz < 0 || gx >= G || gz >= G) continue;
    for (let k = head[gx * G + gz]; k !== -1; k = nxt[k]) { const j = DS[k]; if (j && Math.hypot(j.x - x, j.z - z) < r) return true; }
  }
  for (const j of moi) if (Math.hypot(j.x - x, j.z - z) < r) return true;
  return false;
}

// ───────────────────────── sinh xe / người ─────────────────────────
const SON_XM = ['#1b1b1d', '#8b1e22', '#c8c8c8', '#20335c', '#e8e4dc', '#b3121b', '#3a3d42', '#6d2b8a', '#1b1b1d', '#c8c8c8'];
const AO = ['#f2f2f2', '#2a2f3a', '#c0392b', '#2f5d8a', '#e1b12c', '#7f8c8d', '#16a085', '#e67e22', '#ffffff', '#34495e', '#d35400', '#8e44ad', '#f7c6d0', '#9fc5e8'];
const MU = ['#f5f5f5', '#d7263d', '#1b1b1b', '#f9c80e', '#2e86ab', '#e94e77', '#ffffff', '#3c3c3c', '#ff8c42'];
const SON_OTO = ['#f4f4f4', '#f4f4f4', '#1d1d1f', '#9aa0a6', '#c0c4c8', '#7b0f12', '#1f3b73', '#00a650', '#ffffff', '#2b2b2e'];
const XANH_GRAB = '#00a650';
const HANG = ['#a0764a', '#3f7fbf', '#c9b48a', '#d9d9d9'];
let idDem = 0;
function chonArm(chiEW) {
  const ds = chiEW ? ARMS.slice(0, 2) : ARMS;
  let r = Math.random() * ds.reduce((t, a) => t + a.w, 0);
  for (const a of ds) { r -= a.w; if (r <= 0) return a; }
  return ds[0];
}
function sinhXe(loai) {
  const arm = chonArm(loai === 'bus');
  const d = arm.d;
  let quay = 'thang';
  if (loai !== 'bus') { const r = Math.random(); quay = r < 0.6 ? 'thang' : r < 0.8 ? 'phai' : 'trai'; }
  const d2 = quay === 'thang' ? d : quay === 'phai' ? right(d) : neg(right(d));
  const hw1 = hwAlong(d), hw2 = hwAlong(d2);
  let o1, o2, len, wid, vmax;
  if (loai === 'xm') {
    len = 1.9; wid = 0.75; vmax = rnd(6.5, 9.5);
    o1 = quay === 'phai' ? rnd(hw1 * 0.55, hw1 - 0.6) : quay === 'trai' ? rnd(0.8, hw1 * 0.75) : rnd(0.8, hw1 - 0.6);
    o2 = quay === 'phai' ? rnd(hw2 * 0.55, hw2 - 0.6) : rnd(0.8, hw2 - 0.6);
  } else if (loai === 'oto') {
    len = 4.4; wid = 1.8; vmax = rnd(8, 11);
    o1 = quay === 'phai' ? hw1 * 0.5 : 2.2; o2 = quay === 'phai' ? hw2 * 0.5 : 2.2;
  } else { len = 10.5; wid = 2.5; vmax = 7.5; o1 = o2 = hw1 * 0.55; }
  const p = taoDuongXe(d, d2, o1, o2);
  const r0 = loai === 'xm' ? 2.3 : loai === 'oto' ? 6.5 : 9.5;
  if (gan(p.x[0], p.z[0], r0)) return null;
  const grab = loai === 'xm' && Math.random() < 0.14;
  const a = {
    id: idDem++, loai, p, s: 0, k: 0, dlat: 0, lv: 0, sp: vmax * 0.7, vmax, len, wid, g: arm.g, quay,
    lieu: loai === 'xm' && Math.random() < CAI.lieu, lan: loai === 'xm' ? rnd(0, 2.5) : 0, hayLeo: loai === 'xm' && Math.random() < 0.3,
    ket: 0, ma: 0, w: rnd(0.3, 0.8), ph: rnd(0, 6.28), nghieng: 0, y: 0,
    c1: new THREE.Color(loai === 'xm' ? chon(SON_XM) : loai === 'oto' ? chon(SON_OTO) : '#f4f4f4'),
    c2: new THREE.Color(grab ? XANH_GRAB : chon(AO)), c3: new THREE.Color(grab ? XANH_GRAB : chon(MU)),
    cho: loai === 'xm' && !grab && Math.random() < 0.3, c4: new THREE.Color(chon(AO)),
    hang: loai === 'xm' && Math.random() < 0.06, c5: new THREE.Color(chon(HANG)),
  };
  if (a.hang) a.cho = false;
  mau(p, a);
  a.x = a.px - a.fz * a.dlat; a.z = a.pz + a.fx * a.dlat;
  a.goc = Math.atan2(-a.fz, a.fx);
  DS.push(a); moi.push(a);
  return a;
}
const DA = ['#f1c9a5', '#e0ac85', '#c68e64', '#f5d3b3'];
function sinhBo() {
  let qx = Math.random() < 0.5 ? -1 : 1, qz = Math.random() < 0.5 ? -1 : 1;
  const C = (ax, az) => [ax * (HW_NS + 2), az * (HW_EW + 2)];
  const ngoai = (ax, az) => (Math.random() < 0.6 ? [ax * rnd(25, 110), az * (HW_EW + 2)] : [ax * (HW_NS + 2), az * rnd(28, 110)]);
  const goc = [ngoai(qx, qz), C(qx, qz)];
  const quaDs = [];
  const nQua = Math.random() < 0.3 ? 2 : 1;
  for (let i = 0; i < nQua; i++) {
    if (Math.random() < 0.5) { quaDs.push({ g: 0, i: goc.length - 1 }); qz = -qz; } else { quaDs.push({ g: 1, i: goc.length - 1 }); qx = -qx; }
    goc.push(C(qx, qz));
  }
  goc.push(ngoai(qx, qz));
  const sV = [0];
  for (let i = 1; i < goc.length; i++) sV.push(sV[i - 1] + Math.hypot(goc[i][0] - goc[i - 1][0], goc[i][1] - goc[i - 1][1]));
  const pts = [];
  for (let i = 0; i < goc.length - 1; i++) doan(pts, goc[i], goc[i + 1], 1.5);
  pts.push(goc[goc.length - 1]);
  const p = taoPath(pts);
  p.qua = quaDs.map((c) => ({ g: c.g, s0: sV[c.i] + 1.4, s1: sV[c.i + 1] - 1.4, ok: false }));
  if (gan(p.x[0], p.z[0], 1.2)) return null;
  const a = {
    id: idDem++, loai: 'bo', p, s: 0, k: 0, dlat: 0, lv: 0, sp: 1.2, vmax: rnd(1.05, 1.5), len: 0.5, wid: 0.5,
    lieu: Math.random() < 0.35, ph: rnd(0, 6.28), buoc: rnd(0, 6), non: Math.random() < 0.15,
    c2: new THREE.Color(chon(AO)), c3: new THREE.Color(chon(DA)), y: 0.15,
  };
  mau(p, a);
  a.x = a.px; a.z = a.pz; a.goc = Math.atan2(-a.fz, a.fx);
  DS.push(a); moi.push(a);
  return a;
}

// ───────────────────────── luật đi của xe ─────────────────────────
const hang = (a) => (a.trongNga ? 1e7 : 0) - a.id;
// Hai xe cùng nằm trong hành lang phía trước của nhau (cắt ngang nhau trong lòng ngã tư) → xe "được quyền" bỏ qua xe kia.
function uuTien(a, j, ex, ez, hw) {
  const lonJ = -(ex * j.fx + ez * j.fz);
  if (lonJ <= 0.1 || lonJ > 16) return false;
  const latJ = -(ex * -j.fz + ez * j.fx);
  if (Math.abs(latJ) >= hw) return false;
  return hang(a) > hang(j);
}
function bien(a) {
  const p = a.p;
  if (a.s < p.sIn) {
    const leo = a.hayLeo && a.s < p.sStop && a.sp < 2.5 ? 2.0 : 0; // leo lề khi kẹt trước đèn đỏ
    return [0.5 - p.o1, p.hw1 - 0.45 - p.o1 + leo];
  }
  if (a.s > p.sOut) return [0.5 - p.o2, p.hw2 - 0.45 - p.o2];
  const b = Math.max(1.2, 3.5 - (a.s - p.sIn) * 0.35);
  return [-b, b];
}
function buocXe(a, dt) {
  const xm = a.loai === 'xm';
  const p = a.p;
  const fx = a.fx, fz = a.fz, rx = -fz, rz = fx;
  const look = xm ? 11 : 18;
  let f0 = 99, fL = 99, fR = 99, vj = 0, day = 0;
  const cr = xm ? 2 : 3;
  const cx = cellX(a.x), cz = cellX(a.z);
  for (let gx = cx - cr; gx <= cx + cr; gx++) {
    if (gx < 0 || gx >= G) continue;
    for (let gz = cz - cr; gz <= cz + cr; gz++) {
      if (gz < 0 || gz >= G) continue;
      for (let k = head[gx * G + gz]; k !== -1; k = nxt[k]) {
        const j = DS[k];
        if (!j || j === a) continue;
        const ex = j.x - a.x, ez = j.z - a.z;
        const lon = ex * fx + ez * fz;
        if (lon < -2.5 || lon > look) continue;
        const lat = ex * rx + ez * rz;
        const hw = (a.wid + j.wid) / 2 + (xm ? 0.15 : 0.3);
        const hl = (a.len + j.len) / 2;
        if (xm && Math.abs(lon) < hl * 0.8 && Math.abs(lat) < hw + 0.2) {
          const o = hw + 0.2 - Math.abs(lat);
          day += lat > 0.01 ? -o : lat < -0.01 ? o : a.id & 1 ? o : -o;
        }
        if (lon <= 0.1 || Math.abs(lat) > hw + 1.4) continue;
        if (a.ma > 0 && j.fx * fx + j.fz * fz < 0.5) continue;
        if (j.loai !== 'bo' && uuTien(a, j, ex, ez, hw)) continue;
        const g = lon - hl;
        if (Math.abs(lat) < hw && g < f0) { f0 = g; vj = Math.max(0, j.sp * (j.fx * fx + j.fz * fz)); }
        if (xm) {
          if (Math.abs(lat + 1.3) < hw) fL = Math.min(fL, g);
          if (Math.abs(lat - 1.3) < hw) fR = Math.min(fR, g);
        }
      }
    }
  }
  const T = xm ? 0.75 : a.loai === 'bus' ? 1.6 : 1.3, s0 = xm ? 0.45 : 1.6;
  a.trongNga = a.s > p.sIn && a.s < p.sOut;
  let vt = a.vmax * (a.trongNga && xm ? 0.8 : 1);
  vt = Math.min(vt, Math.max(0, (f0 - s0) / T + vj * 0.85));
  a.choDen = false;
  let m = 'x';
  if (a.s < p.sStop + a.lan) {
    const [mm, con, qua] = den(a.g, tc);
    m = mm;
    let duoc = m === 'x';
    if (m === 'v') duoc = a.lieu || p.sStop - a.s < a.sp * 1.1;
    if (m === 'd') duoc = (xm && a.quay === 'phai' && CAI.rePhai) || (a.lieu && (qua < 3 || con < 2.5));
    if (!duoc) {
      const gap = p.sStop + a.lan - a.s - a.len / 2;
      vt = Math.min(vt, gap < 0.3 ? 0 : Math.sqrt(2 * 3.2 * gap));
      a.choDen = true;
    }
  }
  const ac = xm ? 2.6 : a.loai === 'bus' ? 1.0 : 1.8;
  a.sp = vt > a.sp ? Math.min(vt, a.sp + ac * dt) : Math.max(vt, a.sp - 9 * dt);
  if (a.sp < 0.2 && !a.choDen) { a.ket += dt; if (a.ket > 6) { a.ma = 2.5; a.ket = 0; } } else a.ket = Math.max(0, a.ket - dt);
  if (a.ma > 0) a.ma -= dt;
  if (xm) {
    const [lo, hi] = bien(a);
    let lvt = 0;
    if (f0 < a.sp * 1.1 + 2.5) {
      if (fL > f0 + 1.2 && fL >= fR && a.dlat - 1 > lo) lvt = -1.4;
      else if (fR > f0 + 1.2 && a.dlat + 1 < hi) lvt = 1.4;
    }
    if (!lvt) lvt = -a.dlat * (a.trongNga ? 0.6 : 0.08) + Math.sin(tg * a.w + a.ph) * 0.25;
    lvt += day * 2.2;
    if (a.dlat < lo) lvt = Math.max(lvt, (lo - a.dlat) * 1.5);
    if (a.dlat > hi) lvt = Math.min(lvt, (hi - a.dlat) * 1.5);
    const lim = 0.35 + a.sp * 0.3;
    lvt = Math.max(-lim, Math.min(lim, lvt));
    a.lv += (lvt - a.lv) * Math.min(1, dt * 5);
  }
  const sTruoc = a.s;
  a.s += a.sp * dt;
  a.dlat += a.lv * dt;
  if (sTruoc < p.sStop && a.s >= p.sStop && m === 'd' && a.quay !== 'phai') CAI.vuot++;
  mau(p, a);
  a.x = a.px - a.fz * a.dlat; a.z = a.pz + a.fx * a.dlat;
  a.y = xm && a.s < p.sIn && p.o1 + a.dlat > p.hw1 ? 0.15 : 0;
  const goc = Math.atan2(-a.fz, a.fx) - Math.atan2(a.lv, a.sp + 1.2);
  let dg = goc - a.goc;
  if (dg > Math.PI) dg -= 2 * Math.PI; else if (dg < -Math.PI) dg += 2 * Math.PI;
  a.goc = goc;
  if (xm) a.nghieng += (Math.max(-0.4, Math.min(0.4, (-dg / Math.max(dt, 1e-3)) * a.sp * 0.05)) - a.nghieng) * Math.min(1, dt * 4);
}
function buocBo(a, dt) {
  let vt = a.vmax;
  let trenDuong = false;
  for (const c of a.p.qua) {
    if (a.s > c.s0 && a.s < c.s1) trenDuong = true;
    if (!c.ok && a.s < c.s0 && c.s0 - a.s < 2) {
      const [m, con] = den(c.g, tc);
      if (a.lieu || (m === 'd' && con > 6)) c.ok = true;
      else vt = Math.min(vt, Math.max(0, c.s0 - 0.4 - a.s) * 1.5);
    }
  }
  a.sp += (vt - a.sp) * Math.min(1, dt * 3);
  a.s += a.sp * dt;
  mau(a.p, a);
  a.dlat = Math.sin(tg * 0.35 + a.ph) * (trenDuong ? 0.3 : 0.9);
  a.x = a.px - a.fz * a.dlat; a.z = a.pz + a.fx * a.dlat;
  a.y = trenDuong ? 0 : 0.15;
  a.goc = Math.atan2(-a.fz, a.fx);
  a.buoc += a.sp * dt * 5.5;
}

function buoc(dt) {
  tc = (tc + dt) % CHU_KY; tg += dt;
  dungLuoi();
  moi = [];
  for (let i = 0; i < DS.length; i++) { const a = DS[i]; if (a.loai === 'bo') buocBo(a, dt); else buocXe(a, dt); }
  for (let i = DS.length - 1; i >= 0; i--) if (DS[i].s >= DS[i].p.len - 0.5) { DS[i].het = true; DS[i] = DS[DS.length - 1]; DS.pop(); }
  const dem = { xm: 0, oto: 0, bus: 0, bo: 0 };
  for (const a of DS) dem[a.loai]++;
  const muc = { xm: CAI.matDo, oto: Math.round(CAI.matDo / 14), bus: 3, bo: Math.round(60 + CAI.matDo / 10) };
  for (let t = 0; t < 4 && dem.xm < muc.xm; t++) if (sinhXe('xm')) dem.xm++;
  if (dem.oto < muc.oto) sinhXe('oto');
  if (dem.bus < muc.bus && Math.random() < 0.02) sinhXe('bus');
  if (dem.bo < muc.bo && Math.random() < 0.3) sinhBo();
  return dem;
}

// ───────────────────────── cảnh 3D ─────────────────────────
const cv = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd3e6');
scene.fog = new THREE.Fog('#c8d9e6', 150, 430);
const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 900);
camera.position.set(62, 44, 16);
const controls = new OrbitControls(camera, cv);
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4; controls.maxDistance = 380;
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight('#dfefff', '#8a7a66', 1.1));
const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
sun.position.set(90, 160, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 500 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const UP = new THREE.Vector3(0, 1, 0), TRUC_X = new THREE.Vector3(1, 0, 0);
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function ghep(parts) {
  return mergeGeometries(parts.map(([g, hex]) => {
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = lin(hex);
    for (let i = 0; i < n; i++) col.set(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }));
}
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const banh = (r, w, x, y, z) => new THREE.CylinderGeometry(r, r, w, 14).rotateX(Math.PI / 2).translate(x, y, z);
const TRANG = '#ffffff', DEN_B = '#151515';

const geoXm = ghep([
  [box(1.25, 0.42, 0.36).translate(0, 0.52, 0), TRANG],
  [box(0.6, 0.12, 0.3).translate(-0.2, 0.8, 0), '#202020'],
  [banh(0.29, 0.11, 0.62, 0.29, 0), DEN_B], [banh(0.29, 0.11, -0.6, 0.29, 0), DEN_B],
  [box(0.12, 0.5, 0.1).translate(0.58, 0.78, 0), '#555555'],
  [box(0.06, 0.06, 0.64).translate(0.55, 1.02, 0), '#888888'],
]);
const geoNguoi = ghep([
  [box(0.3, 0.55, 0.4).rotateZ(-0.15).translate(-0.12, 1.2, 0), TRANG],
  [box(0.55, 0.11, 0.11).rotateZ(-0.35).translate(0.22, 1.12, 0.2), TRANG],
  [box(0.55, 0.11, 0.11).rotateZ(-0.35).translate(0.22, 1.12, -0.2), TRANG],
  [box(0.48, 0.15, 0.16).translate(0.05, 0.9, 0.15), '#3a3a3a'], [box(0.48, 0.15, 0.16).translate(0.05, 0.9, -0.15), '#3a3a3a'],
  [box(0.14, 0.45, 0.14).translate(0.27, 0.62, 0.17), '#3a3a3a'], [box(0.14, 0.45, 0.14).translate(0.27, 0.62, -0.17), '#3a3a3a'],
]);
const geoMu = new THREE.SphereGeometry(0.16, 12, 9).translate(-0.06, 1.62, 0);
const geoCho = ghep([
  [box(0.3, 0.5, 0.38).rotateZ(-0.1).translate(-0.6, 1.14, 0), TRANG],
  [new THREE.SphereGeometry(0.15, 10, 8).translate(-0.62, 1.53, 0), TRANG],
  [box(0.42, 0.14, 0.15).translate(-0.48, 0.86, 0.16), '#3a3a3a'], [box(0.42, 0.14, 0.15).translate(-0.48, 0.86, -0.16), '#3a3a3a'],
]);
const geoHang = box(0.55, 0.5, 0.62).translate(-0.72, 1.06, 0);
const geoOto = ghep([
  [box(4.3, 0.72, 1.78).translate(0, 0.62, 0), TRANG],
  [box(2.3, 0.6, 1.62).translate(-0.25, 1.27, 0), '#3a4450'],
  [banh(0.33, 0.24, 1.4, 0.33, 0.82), DEN_B], [banh(0.33, 0.24, 1.4, 0.33, -0.82), DEN_B],
  [banh(0.33, 0.24, -1.4, 0.33, 0.82), DEN_B], [banh(0.33, 0.24, -1.4, 0.33, -0.82), DEN_B],
  [box(0.05, 0.16, 1.5).translate(2.16, 0.72, 0), '#ffe9a8'],
]);
const geoBus = ghep([
  [box(10.5, 2.5, 2.5).translate(0, 1.7, 0), '#1f9d57'],
  [box(9.6, 0.95, 2.52).translate(-0.2, 2.25, 0), '#1d2730'],
  [box(10.52, 0.22, 2.52).translate(0, 1.18, 0), '#f2f2ea'],
  [box(0.06, 1.2, 2.2).translate(5.26, 2.2, 0), '#1d2730'],
  [banh(0.48, 0.3, 3.6, 0.48, 1.15), DEN_B], [banh(0.48, 0.3, 3.6, 0.48, -1.15), DEN_B],
  [banh(0.48, 0.3, -3.4, 0.48, 1.15), DEN_B], [banh(0.48, 0.3, -3.4, 0.48, -1.15), DEN_B],
]);
const geoBo = ghep([
  [box(0.26, 0.58, 0.4).translate(0, 1.17, 0), TRANG],
  [box(0.22, 0.84, 0.32).translate(0, 0.43, 0), '#3a3a40'],
]);
const geoDau = new THREE.SphereGeometry(0.12, 10, 8).translate(0, 1.6, 0);
const geoNon = new THREE.ConeGeometry(0.3, 0.2, 14).translate(0, 1.79, 0);

const vatLieuMau = new THREE.MeshLambertMaterial({ vertexColors: true });
const vatLieu = new THREE.MeshLambertMaterial();
function inst(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0; m.castShadow = true; m.frustumCulled = false;
  m.setColorAt(0, new THREE.Color());
  scene.add(m);
  return m;
}
const MAX_XM = 1200;
const mXm = inst(geoXm, vatLieuMau, MAX_XM), mNguoi = inst(geoNguoi, vatLieuMau, MAX_XM), mMu = inst(geoMu, vatLieu, MAX_XM);
const mCho = inst(geoCho, vatLieuMau, MAX_XM), mHang = inst(geoHang, vatLieu, MAX_XM);
const mOto = inst(geoOto, vatLieuMau, 160), mBus = inst(geoBus, vatLieuMau, 16);
const mBo = inst(geoBo, vatLieuMau, 400), mDau = inst(geoDau, vatLieu, 400), mNon = inst(geoNon, vatLieu, 400);
const NON_MAU = new THREE.Color('#e8d7a6');

// ── mặt đất, vỉa hè, vạch kẻ
const mat0 = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4a4c50' }));
mat0.receiveShadow = true; scene.add(mat0);
const HOP = [], TRU = [], TAN = [], NON = [], PHANG = [], BIEN = [], CAU = [], XM_DO = [];
for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
  const x0 = HW_NS, z0 = HW_EW, x1 = 190, z1 = 190;
  HOP.push([qx * (x0 + x1) / 2, 0.075, qz * (z0 + z1) / 2, x1 - x0, 0.15, z1 - z0, 0, '#b8aa9c']);
  HOP.push([qx * (x0 + x1) / 2, 0.09, qz * (z0 + 0.15), x1 - x0, 0.18, 0.3, 0, '#d9d3c9']); // bó vỉa
  HOP.push([qx * (x0 + 0.15), 0.09, qz * (z0 + z1) / 2, 0.3, 0.18, z1 - z0, 0, '#d9d3c9']);
}
const VANG = '#f2c230', TRANG_V = '#ededed';
for (const sx of [-1, 1]) {
  const ea = HW_NS + CW, la = L - ea;
  for (const off of [-0.16, 0.16]) PHANG.push([sx * (ea + la / 2), off, la, 0.12, VANG]);
  for (let u = ea + 1; u < L; u += 6) for (const zz of [-4.6, 4.6]) PHANG.push([sx * (u + 1.5), zz, 3, 0.13, TRANG_V]);
  const eb = HW_EW + CW, lb = L - eb;
  for (const off of [-0.16, 0.16]) PHANG.push([off, sx * (eb + lb / 2), 0.12, lb, VANG]);
  for (let u = eb + 1; u < L; u += 6) for (const xx of [-4, 4]) PHANG.push([xx, sx * (u + 1.5), 0.13, 3, TRANG_V]);
}
for (const arm of ARMS) {
  const d = arm.d, r = right(d), hw = hwAlong(d), e = eAlong(d);
  const st = -(e + CW), cx = st * d[0] + (hw / 2) * r[0], cz = st * d[1] + (hw / 2) * r[1];
  PHANG.push([cx, cz, d[0] ? 0.45 : hw, d[0] ? hw : 0.45, TRANG_V]); // vạch dừng
  const mid = -(e + CW / 2);
  for (let u = -hw + 0.6; u < hw - 0.3; u += 1.1) {
    const px = mid * d[0] + u * r[0], pz = mid * d[1] + u * r[1];
    PHANG.push([px, pz, d[0] ? 3 : 0.55, d[0] ? 0.55 : 3, TRANG_V]); // vạch qua đường
  }
}

// ── nhà ống hai bên đường
const NHA = ['#f2d98d', '#f6c7b6', '#bfe0e8', '#f1efe6', '#d8e7b9', '#f5e2c8', '#e9b7a6', '#c9d6f0', '#fff1a8', '#e6e1d6'];
const CUA = ['#2b2622', '#8d9096', '#3b2f2a', '#6b4f3a', '#9a9da3'];
const BAT = ['#2f6db5', '#c0392b', '#2e8b57', '#e67e22', '#7d8a96'];
function hopTheo(F, n, lx, ly, lz, sx, sy, sz, hex) {
  const t = [n[1], -n[0]];
  HOP.push([F[0] + t[0] * lx + n[0] * lz, ly, F[1] + t[1] * lx + n[1] * lz, sx, sy, sz, Math.atan2(n[0], n[1]), hex]);
}
function theo(F, n, lx, lz) { const t = [n[1], -n[0]]; return [F[0] + t[0] * lx + n[0] * lz, F[1] + t[1] * lx + n[1] * lz]; }
function dayNha(diemF, n, u0, u1) {
  let u = u0;
  while (u < u1) {
    const w = rnd(3.6, 5.6);
    if (Math.random() < 0.08) { u += 2.6; continue; } // hẻm
    const F = diemF(u + w / 2);
    const tang = Math.random() < 0.05 ? 7 + ((Math.random() * 3) | 0) : 2 + ((Math.random() * 4) | 0);
    const h = 4 + (tang - 1) * 3.4, sau = rnd(13, 18), mauNha = chon(NHA);
    hopTheo(F, n, 0, h / 2, -sau / 2, w - 0.08, h, sau, mauNha);
    hopTheo(F, n, 0, 1.4, 0.04, w - 0.5, 2.7, 0.08, chon(CUA));
    hopTheo(F, n, 0, 3.3, 0.18, w - 0.3, 1.0, 0.3, '#d6d6d6');
    const ps = theo(F, n, 0, 0.35);
    BIEN.push([ps[0], 3.3, ps[1], w - 0.45, 0.86, Math.atan2(n[0], n[1]), (Math.random() * 32) | 0]);
    if (Math.random() < 0.35) hopTheo(F, n, 0, 2.85, 1.15, w - 0.2, 0.06, 2.2, chon(BAT)); // mái bạt che vỉa hè
    for (let f = 1; f < tang; f++) {
      const y0 = 4 + (f - 1) * 3.4;
      hopTheo(F, n, 0, y0 + 1.7, 0.03, w * 0.6, 1.5, 0.06, '#3b4652');
      if (Math.random() < 0.8) {
        hopTheo(F, n, 0, y0 + 0.06, 0.45, w - 0.6, 0.12, 0.9, '#e4e1db');
        hopTheo(F, n, 0, y0 + 0.55, 0.88, w - 0.6, 0.9, 0.05, Math.random() < 0.5 ? '#555a60' : '#f4f1ea');
      }
    }
    if (Math.random() < 0.5) hopTheo(F, n, 0, h + 1.2, -sau * 0.7, w * 0.7, 2.4, 4, mauNha);
    const pt = theo(F, n, rnd(-w / 4, w / 4), -sau * 0.4);
    if (Math.random() < 0.75) TRU.push([pt[0], h + 0.55, pt[1], 0.45, 1.1, '#d9dde2']); // bồn nước inox
    if (Math.random() < 0.55) {
      const sl = 1 + ((Math.random() * 3) | 0);
      for (let b = 0; b < sl; b++) {
        const q = theo(F, n, (b - (sl - 1) / 2) * 0.95, 1.6);
        XM_DO.push([q[0], q[1], Math.atan2(n[0], n[1]) + Math.PI / 2 + rnd(-0.15, 0.15), chon(SON_XM)]);
      }
    }
    u += w;
  }
}
for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
  const fz = HW_EW + SW, fx = HW_NS + SW;
  dayNha((u) => [qx * (fx + u), qz * fz], [0, -qz], 0, 150);
  dayNha((u) => [qx * fx, qz * (fz + 18 + u)], [-qx, 0], 0, 140);
  for (let i = 0; i < 18; i++) { // dãy cao ốc phía sau làm đường chân trời
    const x = qx * rnd(60, 170), z = qz * rnd(60, 170), h = rnd(12, Math.random() < 0.25 ? 70 : 30);
    HOP.push([x, h / 2, z, rnd(10, 22), h, rnd(10, 22), rnd(0, 1.5), chon(['#d7d9dc', '#c9ccd1', '#e8e4dc', '#b9c4cf', '#f0ede6'])]);
  }
}

// ── cây, cột điện, dây điện
const LA = ['#3f7d3a', '#4f8f3f', '#2f6b34', '#5c9a48'];
function cot(x, z) { TRU.push([x, 4.25, z, 0.16, 8.5, '#9a9a96']); HOP.push([x, 7.9, z, 1.4, 0.12, 0.12, Math.random(), '#7d7d79']); }
function day(A, B) {
  for (let k = 0; k < 5; k++) {
    const h = 7.9 - k * 0.32 + rnd(-0.1, 0.1), vong = rnd(0.4, 1.1), N = 10;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, y = (t) => h - vong * 4 * t * (1 - t);
      CAU.push(A[0] + (B[0] - A[0]) * t0, y(t0), A[1] + (B[1] - A[1]) * t0 + k * 0.05, A[0] + (B[0] - A[0]) * t1, y(t1), A[1] + (B[1] - A[1]) * t1 + k * 0.05);
    }
  }
}
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  let truoc = null;
  for (let u = 16; u < 165; u += 26) { const P = [sx * u, sz * (HW_EW + 0.5)]; cot(P[0], P[1]); if (truoc) day(truoc, P); truoc = P; }
  const dau1 = [sx * 16, sz * (HW_EW + 0.5)];
  truoc = null;
  for (let u = 18; u < 165; u += 26) { const P = [sx * (HW_NS + 0.5), sz * u]; cot(P[0], P[1]); if (truoc) day(truoc, P); else day(dau1, P); truoc = P; }
  for (let u = 26; u < 160; u += 20) {
    for (const P of [[sx * u, sz * (HW_EW + 1.4)], [sx * (HW_NS + 1.4), sz * (u + 4)]]) {
      TRU.push([P[0], 1.7, P[1], 0.18, 3.4, '#6b4a2f']);
      TAN.push([P[0], 4.4, P[1], rnd(1.8, 2.7), chon(LA)]);
    }
  }
  // quán vỉa hè: xe đẩy + dù + ghế nhựa + khách ngồi
  const cx = sx * rnd(22, 40), cz = sz * (HW_EW + 2.6);
  HOP.push([cx, 0.65, cz, 1.5, 1.0, 0.8, 0, '#5d7fa3']);
  TRU.push([cx, 1.6, cz, 0.04, 2.4, '#dddddd']);
  NON.push([cx, 2.75, cz, 1.5, 0.5, chon(['#d7263d', '#2e86ab', '#2e8b57', '#f1c40f'])]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, x = cx + Math.cos(a) * rnd(1.4, 2.4), z = cz + Math.sin(a) * rnd(0.8, 1.2);
    HOP.push([x, 0.28, z, 0.32, 0.26, 0.32, rnd(0, 1), Math.random() < 0.6 ? '#d63b3b' : '#2f6db5']);
    if (Math.random() < 0.6) { HOP.push([x, 0.72, z, 0.38, 0.55, 0.28, a, chon(AO)]); TRU.push([x, 1.12, z, 0.12, 0.24, chon(DA)]); }
  }
  HOP.push([cx + sx * 1.0, 0.24, cz, 0.7, 0.36, 0.7, 0, '#c9a36a']);
}

// ── cột đèn giao thông + đồng hồ đếm ngược
const DEN_ARM = [];
const MAU_DEN = { d: ['#ff2a1f', '#3b1010'], v: ['#ffc21a', '#3b3010'], x: ['#2bff5e', '#0f3b18'] };
for (const arm of ARMS) {
  const d = arm.d, r = right(d), hw = hwAlong(d), e = eAlong(d), n = neg(d);
  const B = [-(e + CW + 1) * d[0] + (hw + 1.2) * r[0], -(e + CW + 1) * d[1] + (hw + 1.2) * r[1]];
  TRU.push([B[0], 3.3, B[1], 0.14, 6.6, '#5f6368']);
  hopTheo(B, n, -(hw - 1) / 2, 6.3, 0, hw, 0.18, 0.18, '#5f6368');
  const den3 = {};
  for (const k of ['d', 'v', 'x']) den3[k] = new THREE.MeshBasicMaterial({ color: MAU_DEN[k][1] });
  const dsDau = [[-(hw - 1.5), 5.5], [-0.35, 3.3]];
  const so = [];
  for (const [lx, ly] of dsDau) {
    hopTheo(B, n, lx, ly, 0, 0.45, 1.3, 0.35, '#1a1a1a');
    [['d', 0.4], ['v', 0], ['x', -0.4]].forEach(([k, dy]) => {
      const mm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), den3[k]);
      const q = theo(B, n, lx, 0.19);
      mm.position.set(q[0], ly + dy, q[1]);
      scene.add(mm);
    });
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.42), new THREE.MeshBasicMaterial({ map: tex }));
    const q = theo(B, n, lx - 0.72, 0.2);
    pl.position.set(q[0], ly, q[1]);
    pl.rotation.y = Math.atan2(n[0], n[1]);
    hopTheo(B, n, lx - 0.72, ly, 0.1, 0.9, 0.5, 0.18, '#111111');
    scene.add(pl);
    so.push({ c, tex });
  }
  DEN_ARM.push({ g: arm.g, den3, so, m: '', n: -1 });
}
function veSo(c, m, n) {
  const x = c.getContext('2d');
  x.fillStyle = '#060606'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = MAU_DEN[m][0];
  x.font = 'bold 52px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n).padStart(2, '0'), 64, 35);
}
function capNhatDen() {
  for (const a of DEN_ARM) {
    const [m, con] = den(a.g, tc);
    const n = Math.ceil(con);
    if (m !== a.m) { for (const k of ['d', 'v', 'x']) a.den3[k].color.set(MAU_DEN[k][k === m ? 0 : 1]); a.m = m; }
    if (n !== a.n) { for (const s of a.so) { veSo(s.c, m, n); s.tex.needsUpdate = true; } a.n = n; }
  }
}

// ── biển hiệu: một tấm atlas 4×8 ô chữ
const CHU = ['PHỞ BÒ', 'CƠM TẤM', 'BÁNH MÌ', 'CÀ PHÊ', 'TẠP HOÁ', 'SỬA XE', 'THUỐC TÂY', 'ĐIỆN THOẠI', 'VÀNG BẠC', 'TRÀ SỮA', 'BIA HƠI', 'GỘI ĐẦU',
  'PHOTOCOPY', 'BÚN CHẢ', 'KHÓA - CHÌA', 'NHÀ NGHỈ', 'HỦ TIẾU', 'LẨU DÊ', 'VÁ VỎ XE', 'SIM SỐ ĐẸP', 'MẮT KÍNH', 'NHA KHOA', 'SPA - NAIL', 'NƯỚC ĐÁ',
  'ĐIỆN MÁY', 'THỜI TRANG', 'CHÈ - KEM', 'XÔI GÀ', 'BÁNH CUỐN', 'KARAOKE', 'IN ẤN', 'BÚN BÒ'];
const NEN = ['#c0392b', '#1f5fa8', '#f1c40f', '#1e8449', '#8e44ad', '#d35400', '#ffffff', '#2c3e50'];
const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 512;
{
  const x = atlas.getContext('2d');
  CHU.forEach((t, i) => {
    const col = i % 4, row = (i / 4) | 0, bg = NEN[(i * 3) % NEN.length];
    x.fillStyle = bg; x.fillRect(col * 256, row * 64, 256, 64);
    x.fillStyle = bg === '#ffffff' || bg === '#f1c40f' ? '#b3121b' : '#ffffff';
    x.fillRect(col * 256 + 8, row * 64 + 54, 240, 3);
    x.font = 'bold 34px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(t, col * 256 + 128, row * 64 + 30, 236);
  });
}
const texBien = new THREE.CanvasTexture(atlas); texBien.colorSpace = THREE.SRGBColorSpace; texBien.anisotropy = 4;
const matBien = new THREE.MeshLambertMaterial({ map: texBien });
matBien.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aO;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (uv + vec2(mod(aO, 4.0), 7.0 - floor(aO / 4.0))) / vec2(4.0, 8.0);');
};

// ── dựng các InstancedMesh tĩnh
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), CL = new THREE.Color();
function tinh(geo, list, dat) {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), Math.max(1, list.length));
  list.forEach((b, i) => { dat(b); m.setMatrixAt(i, M4); m.setColorAt(i, CL); });
  m.count = list.length; m.castShadow = true; m.receiveShadow = true;
  scene.add(m); return m;
}
tinh(box(1, 1, 1), HOP, (b) => { Q.setFromAxisAngle(UP, b[6]); M4.compose(V.set(b[0], b[1], b[2]), Q, S3.set(b[3], b[4], b[5])); CL.set(b[7]); });
tinh(new THREE.CylinderGeometry(1, 1, 1, 12), TRU, (b) => { M4.compose(V.set(b[0], b[1], b[2]), Q.identity(), S3.set(b[3], b[4], b[3])); CL.set(b[5]); });
tinh(new THREE.IcosahedronGeometry(1, 1), TAN, (b) => { M4.compose(V.set(b[0], b[1], b[2]), Q.identity(), S3.set(b[3], b[3] * 0.85, b[3])); CL.set(b[4]); });
tinh(new THREE.ConeGeometry(1, 1, 16), NON, (b) => { M4.compose(V.set(b[0], b[1], b[2]), Q.identity(), S3.set(b[3], b[4], b[3])); CL.set(b[5]); });
{
  const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -2 }), PHANG.length);
  PHANG.forEach((b, i) => { M4.compose(V.set(b[0], 0.02, b[1]), Q.identity(), S3.set(b[2], 1, b[3])); m.setMatrixAt(i, M4); m.setColorAt(i, CL.set(b[4])); });
  m.receiveShadow = true; scene.add(m);
}
{
  const g = new THREE.PlaneGeometry(1, 1);
  const o = new Float32Array(BIEN.length);
  BIEN.forEach((b, i) => (o[i] = b[6]));
  g.setAttribute('aO', new THREE.InstancedBufferAttribute(o, 1));
  const m = new THREE.InstancedMesh(g, matBien, BIEN.length);
  BIEN.forEach((b, i) => { Q.setFromAxisAngle(UP, b[5]); M4.compose(V.set(b[0], b[1], b[2]), Q, S3.set(b[3], b[4], 1)); m.setMatrixAt(i, M4); });
  scene.add(m);
}
{
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(CAU, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#1c1c1c' })));
}
tinh(geoXm.clone(), XM_DO, (b) => { Q.setFromAxisAngle(UP, b[2]); M4.compose(V.set(b[0], 0.15, b[1]), Q, S3.set(1, 1, 1)); CL.set(b[3]); }).material.vertexColors = true;

// ───────────────────────── vẽ xe mỗi khung ─────────────────────────
const KHONG = new THREE.Vector3(0, 0, 0), MOT = new THREE.Vector3(1, 1, 1);
const veXm = [];
function datMa(m, i, pos, q, s, c) { M4.compose(pos, q, s); m.setMatrixAt(i, M4); if (c) m.setColorAt(i, c); }
function ve() {
  let ix = 0, io = 0, ib = 0, ip = 0;
  veXm.length = 0;
  for (const a of DS) {
    if (a.loai === 'bo') {
      Q.setFromAxisAngle(UP, a.goc);
      V.set(a.x, a.y + Math.abs(Math.sin(a.buoc)) * 0.04, a.z);
      datMa(mBo, ip, V, Q, MOT, a.c2); datMa(mDau, ip, V, Q, MOT, a.c3); datMa(mNon, ip, V, Q, a.non ? MOT : KHONG, NON_MAU);
      ip++; continue;
    }
    Q.setFromAxisAngle(UP, a.goc);
    V.set(a.x, a.y, a.z);
    if (a.loai === 'xm') {
      if (ix >= MAX_XM) continue;
      Q2.setFromAxisAngle(TRUC_X, a.nghieng); Q.multiply(Q2);
      datMa(mXm, ix, V, Q, MOT, a.c1); datMa(mNguoi, ix, V, Q, MOT, a.c2); datMa(mMu, ix, V, Q, MOT, a.c3);
      datMa(mCho, ix, V, Q, a.cho ? MOT : KHONG, a.c4); datMa(mHang, ix, V, Q, a.hang ? MOT : KHONG, a.c5);
      veXm[ix] = a; ix++;
    } else if (a.loai === 'oto') datMa(mOto, io++, V, Q, MOT, a.c1);
    else datMa(mBus, ib++, V, Q, MOT, a.c1);
  }
  for (const [m, n] of [[mXm, ix], [mNguoi, ix], [mMu, ix], [mCho, ix], [mHang, ix], [mOto, io], [mBus, ib], [mBo, ip], [mDau, ip], [mNon, ip]]) {
    m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}

// ───────────────────────── máy quay + bảng điều khiển ─────────────────────────
let cam = 'tong', theoXe = null;
const CAM = {
  tong: [[62, 44, 16], [0, 0, 0]],
  tren: [[0.1, 165, 0.1], [0, 0, 0]],
  goc: [[-(HW_NS + 3.4), 4.2, HW_EW + 5], [6, 0.8, -4]],
};
function datCam(k) {
  cam = k;
  document.querySelectorAll('[data-cam]').forEach((b) => b.classList.toggle('on', b.dataset.cam === k));
  controls.enabled = k !== 'theo';
  if (k === 'theo') { if (!theoXe || theoXe.het) theoXe = chonXeTheo(); return; }
  theoXe = null;
  camera.position.set(...CAM[k][0]); controls.target.set(...CAM[k][1]); controls.update();
}
function chonXeTheo() {
  const ds = DS.filter((a) => a.loai === 'xm' && a.s < 60);
  return ds.length ? chon(ds) : DS.find((a) => a.loai === 'xm') || null;
}
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => datCam(b.dataset.cam)));
const $ = (id) => document.getElementById(id);
$('md').addEventListener('input', (e) => { CAI.matDo = +e.target.value; $('vMd').textContent = CAI.matDo; });
$('lieu').addEventListener('input', (e) => { CAI.lieu = +e.target.value / 100; $('vLieu').textContent = e.target.value + '%'; });
$('rp').addEventListener('change', (e) => (CAI.rePhai = e.target.checked));
$('dung').addEventListener('click', (e) => { CAI.dung = !CAI.dung; e.target.textContent = CAI.dung ? 'Chạy tiếp' : 'Tạm dừng'; });
$('toc').addEventListener('click', (e) => { CAI.toc = CAI.toc === 1 ? 2 : CAI.toc === 2 ? 4 : CAI.toc === 4 ? 0.5 : 1; e.target.textContent = 'Tốc độ ' + String(CAI.toc).replace('.', ',') + '×'; });

// bấm vào một xe máy → máy quay đi theo xe đó
const ray = new THREE.Raycaster(), chuot = new THREE.Vector2();
let xuong = null;
cv.addEventListener('pointerdown', (e) => (xuong = [e.clientX, e.clientY]));
cv.addEventListener('pointerup', (e) => {
  if (!xuong || Math.hypot(e.clientX - xuong[0], e.clientY - xuong[1]) > 6) return;
  chuot.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  mXm.computeBoundingSphere(); mNguoi.computeBoundingSphere();
  const hit = ray.intersectObjects([mXm, mNguoi], false)[0];
  if (hit && veXm[hit.instanceId]) { theoXe = veXm[hit.instanceId]; datCam('theo'); theoXe = veXm[hit.instanceId]; }
});

function capNhatCamTheo(dt) {
  if (!theoXe || theoXe.het) theoXe = chonXeTheo();
  if (!theoXe) return;
  const a = theoXe, k = Math.min(1, dt * 3);
  const fx = Math.cos(a.goc), fz = -Math.sin(a.goc);
  V.set(a.x - fx * 6.5, 3.2, a.z - fz * 6.5);
  camera.position.lerp(V, k);
  controls.target.lerp(V.set(a.x + fx * 8, 1.2, a.z + fz * 8), k);
  camera.lookAt(controls.target);
}

let demCu = { xm: 0, oto: 0, bus: 0, bo: 0 }, hudT = 0;
const TEN_DEN = { x: 'XANH', v: 'VÀNG', d: 'ĐỎ' };
function hud() {
  const chip = (ten, g) => { const [m, con] = den(g, tc); return `<span class="den ${m}"><i></i>${ten} <b>${TEN_DEN[m]} ${Math.ceil(con)} s</b></span>`; };
  $('den').innerHTML = chip('Đông–Tây', 0) + chip('Bắc–Nam', 1);
  let cho = 0, leo = 0;
  for (const a of DS) if (a.loai === 'xm') { if (a.choDen && a.sp < 0.5) cho++; if (a.y > 0) leo++; }
  $('so').innerHTML = `<div><b>${demCu.xm}</b> xe máy</div><div><b>${demCu.oto}</b> ô tô</div><div><b>${demCu.bus}</b> xe buýt</div><div><b>${demCu.bo}</b> người đi bộ</div>`
    + `<div><b>${cho}</b> xe đang chờ đèn</div><div><b>${leo}</b> xe leo lề</div><div><b>${CAI.vuot}</b> lượt vượt đèn đỏ</div>`;
}

function coKhung() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', coKhung);
coKhung();

// Cho xe chạy trước 45 giây mô phỏng để mở trang là thấy dòng xe đã đầy, không phải một đợt xe ùa vào cùng lúc.
function khoiDong() {
  const t0 = performance.now();
  for (let i = 0; i < 900; i++) demCu = buoc(1 / 20);
  CAI.vuot = 0;
  $('nap').hidden = true;
  console.log('ngatu: làm nóng', Math.round(performance.now() - t0), 'ms,', DS.length, 'đối tượng');
  datCam('tong');
  let truoc = performance.now();
  renderer.setAnimationLoop(() => {
    const bay = performance.now();
    const dtThuc = Math.min(0.05, (bay - truoc) / 1000);
    truoc = bay;
    if (!CAI.dung) {
      let con = dtThuc * CAI.toc;
      while (con > 1e-4) { const d = Math.min(con, 1 / 30); demCu = buoc(d); con -= d; }
    }
    capNhatDen();
    ve();
    if (cam === 'theo') capNhatCamTheo(dtThuc); else controls.update();
    hudT -= dtThuc; if (hudT <= 0) { hud(); hudT = 0.25; }
    renderer.render(scene, camera);
  });
}
requestAnimationFrame(() => setTimeout(khoiDong, 30));
