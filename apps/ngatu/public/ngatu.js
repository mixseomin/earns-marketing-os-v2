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
// Đường anh tự vẽ cho một xe (22/11/2026): nét vẽ (làm mượt) → hết nét thì nhập vào làn bên phải của con đường gần
// nhất theo hướng nét đang đi → chạy thẳng ra rìa bản đồ. Xe theo nét bỏ qua đèn (người vẽ lái), vẫn né xe khác.
function trongHop(x, z) { return Math.abs(x) < HW_NS && Math.abs(z) < HW_EW; }
function chaikin(pts, lan) {
  for (let l = 0; l < lan; l++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1];
      o.push([0.75 * A[0] + 0.25 * B[0], 0.75 * A[1] + 0.25 * B[1]], [0.25 * A[0] + 0.75 * B[0], 0.25 * A[1] + 0.75 * B[1]]);
    }
    o.push(pts[pts.length - 1]);
    pts = o;
  }
  return pts;
}
function taoDuongVe(a, diem) {
  const E = diem[diem.length - 1];
  let i0 = diem.length - 2;
  while (i0 > 0 && Math.hypot(E[0] - diem[i0][0], E[1] - diem[i0][1]) < 4) i0--;
  const hx = E[0] - diem[i0][0], hz = E[1] - diem[i0][1];
  // hướng ra: đứng trên đường Đông–Tây → chạy dọc x; trên đường Bắc–Nam → dọc z; trong lòng ngã tư → theo hướng nét;
  // lạc ra ngoài (vỉa hè, nhà) → con đường gần hơn
  const trenEW = Math.abs(E[1]) < HW_EW, trenNS = Math.abs(E[0]) < HW_NS;
  let doc; // true = chạy dọc trục x
  if (trenEW && trenNS) doc = Math.abs(hx) >= Math.abs(hz);
  else if (trenEW) doc = true;
  else if (trenNS) doc = false;
  else doc = Math.abs(E[1]) - HW_EW < Math.abs(E[0]) - HW_NS;
  const d2 = doc ? [Math.sign(hx || E[0] || 1), 0] : [0, Math.sign(hz || E[1] || 1)];
  const r2 = right(d2), hw2 = hwAlong(d2), xm = a.loai === 'xm';
  const ngang = E[0] * r2[0] + E[1] * r2[1], doc0 = E[0] * d2[0] + E[1] * d2[1];
  const o2 = xm ? Math.min(hw2 - 0.6, Math.max(0.8, ngang)) : Math.min(hw2 - 1.6, Math.max(2.2, ngang));
  const nhap = Math.min(L - 4, Math.max(doc0 + 8, eAlong(d2) + 4));
  const Q = [nhap * d2[0] + o2 * r2[0], nhap * d2[1] + o2 * r2[1]], F = [L * d2[0] + o2 * r2[0], L * d2[1] + o2 * r2[1]];
  const mem = chaikin([[a.x, a.z], ...diem, Q], 3);
  const pts = [];
  for (let i = 0; i < mem.length - 1; i++) doan(pts, mem[i], mem[i + 1], 1);
  const iNoi = pts.length;
  doan(pts, Q, F, 2);
  pts.push(F);
  const p = taoPath(pts);
  let iIn = -1, iOut = -1;
  for (let i = 0; i < pts.length; i++) if (trongHop(pts[i][0], pts[i][1])) { if (iIn < 0) iIn = i; iOut = i; }
  p.sIn = iIn < 0 ? -1 : p.s[iIn]; p.sOut = iOut < 0 ? -1 : p.s[iOut]; p.sStop = p.sIn - CW;
  p.o1 = 0; p.hw1 = 99; p.o2 = o2; p.hw2 = hw2;
  p.ve = true; p.sNoi = p.s[iNoi];
  // kiểu rẽ theo hướng đầu → hướng ra (chỉ để thống kê; xe theo nét không chờ đèn)
  const d = ARMS[a.arm].d, cr = d[0] * d2[1] - d[1] * d2[0];
  a.quay = Math.abs(cr) < 0.5 ? 'thang' : cr > 0 ? 'phai' : 'trai';
  return p;
}
function giaoDuongVe(a, diem) {
  const p = taoDuongVe(a, diem);
  a.p = p; a.s = 0; a.k = 0; a.dlat = 0; a.lv = 0; a.ket = 0; a.lui = 0; a.sDon = -1; a.camKet = true;
  if (a.dangDon) a.dangDon = false;
  mau(p, a);
  return p;
}
function mau(p, a) {
  const S = p.s, n = S.length - 1;
  let i = a.k;
  while (i < n - 1 && S[i + 1] <= a.s) i++;
  while (i > 0 && S[i] > a.s) i--; // xe lùi qua đầu đoạn: trước chỉ dò tiến, thân đứng chết ở đầu đoạn dù s cứ giảm
  a.k = i;
  const t = Math.min(1, Math.max(0, (a.s - S[i]) / (S[i + 1] - S[i] || 1)));
  a.px = p.x[i] + (p.x[i + 1] - p.x[i]) * t;
  a.pz = p.z[i] + (p.z[i + 1] - p.z[i]) * t;
  const fx = p.tx[i] + (p.tx[i + 1] - p.tx[i]) * t, fz = p.tz[i] + (p.tz[i + 1] - p.tz[i]) * t, l = Math.hypot(fx, fz) || 1;
  a.fx = fx / l; a.fz = fz / l;
}

// ───────────────────────── đèn giao thông ─────────────────────────
// Máy pha (anh 21/11/2026): mỗi chuyển động (hướng vào × thẳng / phải / trái) có đèn riêng. Một pha = các chuyển động
// cùng xanh; hết xanh → vàng 3 s → đỏ toàn phần "chờ thoát ngã tư" (tuỳ chọn, giây) cho xe còn trong lòng ngã tư ra hết
// rồi pha sau mới xanh. Kiểu pha: 2 pha (mặc định) · rẽ trái riêng (4 pha) · từng hướng một (4 pha). Đèn AI: xanh kéo
// dài khi còn xe tới, cắt sớm khi hết xe mà hướng khác đang chờ, bỏ qua pha không ai chờ, lòng ngã tư kẹt thì giữ đỏ
// toàn phần thêm cho xe thoát. Mũi tên rẽ phải: rẽ phải luôn xanh, mọi xe.
const QI = { thang: 0, phai: 1, trai: 2 }, T_VANG = 3;
const DEN = { pha: [], cua: new Int8Array(12), i: 0, giai: 'r', t: 0, dai: 0, them: 0, doTu: new Float32Array(12).fill(99), cau: new Int16Array(12) };
function dungPha() {
  const k = (i, q) => i * 3 + QI[q];
  const nhom = (g, qs) => ARMS.flatMap((A, i) => (A.g === g ? qs.map((q) => k(i, q)) : []));
  const ca = ['thang', 'phai', 'trai'];
  const P = CAI.kieuPha === 'trai'
    ? [{ ten: 'Đông–Tây thẳng', mv: nhom(0, ['thang', 'phai']), x: 16 }, { ten: 'Đông–Tây rẽ trái', mv: nhom(0, ['trai']), x: 8 },
      { ten: 'Bắc–Nam thẳng', mv: nhom(1, ['thang', 'phai']), x: 13 }, { ten: 'Bắc–Nam rẽ trái', mv: nhom(1, ['trai']), x: 7 }]
    : CAI.kieuPha === 'huong'
      ? [0, 2, 1, 3].map((i) => ({ ten: 'Từ ' + ARMS[i].ten, mv: ca.map((q) => k(i, q)), x: ARMS[i].g === 0 ? 13 : 10 }))
      : [{ ten: 'Đông–Tây', mv: nhom(0, ca), x: 22 }, { ten: 'Bắc–Nam', mv: nhom(1, ca), x: 18 }];
  DEN.pha = P; DEN.cua.fill(-1);
  P.forEach((p, j) => { for (const m of p.mv) DEN.cua[m] = j; });
  DEN.i = P.length - 1; DEN.giai = 'r'; DEN.t = 0; DEN.dai = 0; DEN.them = 0; DEN.doTu.fill(99); // bắt đầu bằng đỏ toàn phần
}
// giây còn lại của pha đang chạy tới lúc pha sau xanh
function conPha() {
  const D = DEN, R = CAI.choThoat + D.them;
  return D.giai === 'x' ? D.dai - D.t + T_VANG + R : D.giai === 'v' ? T_VANG - D.t + R : Math.max(0, R - D.t);
}
// đèn của chuyển động k → [màu, giây còn lại của màu, giây đã đỏ]
function den(k) {
  if (CAI.phaiXanh && k % 3 === 1) return ['x', 99, 0];
  const D = DEN, j = D.cua[k];
  if (j === D.i) {
    if (D.giai === 'x') return ['x', D.dai - D.t, 0];
    if (D.giai === 'v') return ['v', T_VANG - D.t, 0];
  }
  let con = conPha();
  for (let n = (D.i + 1) % D.pha.length; n !== j; n = (n + 1) % D.pha.length) con += D.pha[n].x + T_VANG + CAI.choThoat;
  return ['d', con, D.doTu[k]];
}
// người qua vạch của nhóm g: chỉ đi khi mọi chuyển động nhóm g đều đỏ
function denBo(g) {
  let con = 99;
  for (let i = 0; i < 4; i++) if (ARMS[i].g === g) for (let q = 0; q < 3; q++) {
    if (q === 1 && CAI.phaiXanh) continue;
    const [m, c] = den(i * 3 + q);
    if (m !== 'd') return [m, c, 0];
    con = Math.min(con, c);
  }
  return ['d', con, 0];
}
const cauPha = (p) => p.mv.reduce((t, m) => t + DEN.cau[m], 0);
function buocDen(dt) {
  const D = DEN, P = D.pha[D.i];
  for (let k = 0; k < 12; k++) D.doTu[k] += dt;
  D.t += dt;
  if (D.giai === 'x') {
    if (CAI.denAI && D.t >= Math.min(6, P.x)) {
      const xanh = cauPha(P), khac = D.pha.reduce((t, p, j) => t + (j === D.i ? 0 : cauPha(p)), 0);
      if (ketNga > 8) D.dai = D.t; // lòng ngã tư đang kẹt → thôi cho xe vào thêm, chuyển sang đỏ toàn phần cho thoát
      else if (xanh === 0 && khac > 0) D.dai = D.t; // hết xe hướng này mà hướng khác đang chờ → cắt sớm
      else if (D.t >= D.dai - 0.5 && xanh > 0) D.dai = Math.min(P.x * 2 + 5, D.t + 2); // còn xe tới → kéo dài, có trần
      else if (khac === 0) D.dai = Math.max(D.dai, D.t + 1); // không ai chờ chỗ khác → giữ xanh
    }
    if (D.t >= D.dai) { D.giai = 'v'; D.t = 0; }
  } else if (D.giai === 'v') {
    if (D.t >= T_VANG) { D.giai = 'r'; D.t = 0; D.them = 0; for (const m of P.mv) D.doTu[m] = 0; }
  } else {
    // đèn AI: lòng ngã tư còn kẹt thì giữ đỏ toàn phần thêm (tối đa 8 s) cho xe thoát hết
    if (CAI.denAI && D.t >= CAI.choThoat + D.them && ketNga > 6 && D.them < 8) D.them += 0.5;
    if (D.t >= CAI.choThoat + D.them) {
      let n = (D.i + 1) % D.pha.length;
      if (CAI.denAI) for (let b = 0; b < D.pha.length - 1 && cauPha(D.pha[n]) === 0; b++) n = (n + 1) % D.pha.length; // bỏ pha không ai chờ
      D.i = n; D.giai = 'x'; D.t = 0; D.them = 0; D.dai = D.pha[n].x;
    }
  }
}

const DD = matchMedia('(pointer: coarse)').matches || innerWidth < 700; // điện thoại / máy tính bảng → giảm tải cho máy khỏi nóng
// Tuỳ chọn người xem chỉnh được — lưu vào trình duyệt, F5 vẫn giữ (anh 21/11/2026); nút "Mặc định" đưa về như lúc đầu.
// choNga: luật "lòng ngã tư kẹt thì đứng chờ ở vạch" — ở VN không ai làm vậy, nên chỉ là tuỳ chọn, mặc định tắt.
const MAC_DINH = { matDo: DD ? 200 : 250, lieu: 0.12, rePhai: true, tyLeOto: 7, toc: 1, choNga: false, nhuongLoi: false, choThoat: 3, denAI: false, kieuPha: '2pha', phaiXanh: false };
const KHOA_LUU = 'ngatu-tuy-chon';
const daLuu = (() => { try { const o = JSON.parse(localStorage.getItem(KHOA_LUU) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } })();
const CAI = { ...MAC_DINH, dung: false, vuot: 0, don: 0, nghich: 0 };
// Bản lưu cũ (trước 21/11/2026, chưa có _ban) còn mật độ 450 → bỏ mật độ đã lưu, về mặc định mới 250.
if (daLuu._ban !== 2) delete daLuu.matDo;
for (const k of Object.keys(MAC_DINH)) if (typeof daLuu[k] === typeof MAC_DINH[k]) CAI[k] = daLuu[k];
function luuTuyChon() {
  try { localStorage.setItem(KHOA_LUU, JSON.stringify({ _ban: 2, ...Object.fromEntries(Object.keys(MAC_DINH).map((k) => [k, CAI[k]])) })); } catch {}
}
const NGUONG_KET = 22, NGUONG_CAT = 8;
let tg = 0, ketNga = 0; // ketNga: số xe đang đứng kẹt trong lòng ngã tư
const trongNgaG = [0, 0]; // số xe mỗi hướng đèn còn nằm trong lòng ngã tư

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
// Thân xe dài len, rộng wid đặt ở (x, z, góc g) có đè lên thân ai không (nới thêm m mỗi chiều). Dùng khi sinh xe / thả xe
// xuống — trước chỉ so khoảng cách tâm nên xe máy mọc ra ngay trong thân xe buýt (tâm buýt cách đầu xe 5 m).
function choTrong(x, z, g, len, wid, m, boQuaBo) {
  const cx = cellX(x), cz = cellX(z);
  const de = (j) => j.y < 2 && !(boQuaBo && j.loai === 'bo') && lanSau(x, z, g, len + m, wid + m, j) > 0;
  for (let gx = cx - 2; gx <= cx + 2; gx++) for (let gz = cz - 2; gz <= cz + 2; gz++) {
    if (gx < 0 || gz < 0 || gx >= G || gz >= G) continue;
    for (let k = head[gx * G + gz]; k !== -1; k = nxt[k]) { const j = DS[k]; if (j && de(j)) return false; }
  }
  for (const j of moi) if (de(j)) return false;
  return true;
}
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
const SON_TAXI = ['#f4f4f4', '#f4f4f4', '#0b8a3e', '#0b8a3e', '#f2c200'];
const HANG = ['#a0764a', '#3f7fbf', '#c9b48a', '#d9d9d9'];
let idDem = 0;
function chonArm(chiEW) {
  const ds = chiEW ? ARMS.slice(0, 2) : ARMS;
  let r = Math.random() * ds.reduce((t, a) => t + a.w, 0);
  for (const a of ds) { r -= a.w; if (r <= 0) return a; }
  return ds[0];
}
// Một đường đi ngẫu nhiên cho xe loại `loai`: hướng vào, rẽ gì, cách tim đường bao xa.
function duongXe(loai) {
  const arm = chonArm(loai === 'bus');
  const d = arm.d;
  let quay = 'thang';
  if (loai !== 'bus') { const r = Math.random(); quay = r < 0.6 ? 'thang' : r < 0.8 ? 'phai' : 'trai'; }
  const d2 = quay === 'thang' ? d : quay === 'phai' ? right(d) : neg(right(d));
  const hw1 = hwAlong(d), hw2 = hwAlong(d2);
  let o1, o2;
  if (loai === 'xm') {
    o1 = quay === 'phai' ? rnd(hw1 * 0.55, hw1 - 0.6) : quay === 'trai' ? rnd(0.8, hw1 * 0.75) : rnd(0.8, hw1 - 0.6);
    o2 = quay === 'phai' ? rnd(hw2 * 0.55, hw2 - 0.6) : rnd(0.8, hw2 - 0.6);
  } else if (loai === 'oto') { o1 = quay === 'phai' ? hw1 * 0.5 : 2.2; o2 = quay === 'phai' ? hw2 * 0.5 : 2.2; }
  else o1 = o2 = hw1 * 0.55;
  return { arm, quay, p: taoDuongXe(d, d2, o1, o2) };
}
function sinhXe(loai) {
  const { arm, quay, p } = duongXe(loai);
  let len, wid, vmax;
  if (loai === 'xm') { len = 1.9; wid = 0.75; vmax = rnd(6.5, 9.5); }
  else if (loai === 'oto') { len = 4.4; wid = 1.8; vmax = rnd(8, 11); }
  else { len = 10.5; wid = 2.5; vmax = 7.5; }
  const r0 = loai === 'xm' ? 2.3 : loai === 'oto' ? 6.5 : 9.5;
  if (gan(p.x[0], p.z[0], r0)) return null;
  const t0 = { k: 0, s: 0 }; mau(p, t0);
  if (!choTrong(t0.px, t0.pz, Math.atan2(-t0.fz, t0.fx), len, wid, 1, false)) return null;
  const grab = loai === 'xm' && Math.random() < 0.14;
  const taxi = loai === 'oto' && Math.random() < 0.4;
  const a = {
    id: idDem++, loai, p, s: 0, k: 0, dlat: 0, lv: 0, sp: vmax * 0.7, vmax, len, wid, g: arm.g, arm: ARMS.indexOf(arm), quay,
    taxi, sDon: -1, tDon: 0, dangDon: false,
    // taxi liều gấp ba xe máy, lấn vạch dừng như xe máy; ô tô thường liều bằng nửa
    rL: Math.random(), camKet: false, // rL cố định từng xe; có liều hay không tính lại theo thanh trượt mỗi bước → kéo thanh là áp dụng ngay
    lan: loai === 'xm' ? rnd(0, 2.5) : taxi ? rnd(0.5, 3) : 0, // chỉ xe đang liều mới lấn qua vạch dừng
    hayLeo: loai === 'xm' && Math.random() < 0.3,
    ket: 0, w: rnd(0.3, 0.8), ph: rnd(0, 6.28), nghieng: 0, y: 0,
    c1: new THREE.Color(loai === 'xm' ? chon(SON_XM) : taxi ? chon(SON_TAXI) : loai === 'oto' ? chon(SON_OTO) : '#f4f4f4'),
    c2: new THREE.Color(grab ? XANH_GRAB : chon(AO)), c3: new THREE.Color(grab ? XANH_GRAB : chon(MU)),
    cho: loai === 'xm' && !grab && Math.random() < 0.3, c4: new THREE.Color(chon(AO)),
    hang: loai === 'xm' && Math.random() < 0.06, c5: new THREE.Color(chon(HANG)),
  };
  if (a.hang) a.cho = false;
  if (taxi && Math.random() < 0.75) {
    // taxi tấp lề đón/trả khách bất chợt — ngay trước đèn hoặc vừa qua ngã tư, đứng chắn làn sát lề
    const truoc = p.sStop > 30 && Math.random() < 0.5;
    a.sDon = truoc ? rnd(10, p.sStop - 14) : p.sOut + rnd(5, Math.max(6, p.len - p.sOut - 12));
    a.tDon = rnd(3, 8);
  }
  mau(p, a);
  a.x = a.px - a.fz * a.dlat; a.z = a.pz + a.fx * a.dlat;
  a.goc = Math.atan2(-a.fz, a.fx);
  a.uu = hang(a);
  DS.push(a); moi.push(a);
  return a;
}
const DA = ['#f1c9a5', '#e0ac85', '#c68e64', '#f5d3b3'];
function duongBo() {
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
  p.qua = quaDs.map((c) => ({ g: c.g, s0: sV[c.i] + 1.4, s1: sV[c.i + 1] - 1.4 }));
  return { p };
}
function sinhBo() {
  const { p } = duongBo();
  if (gan(p.x[0], p.z[0], 1.2)) return null;
  const a = {
    id: idDem++, loai: 'bo', p, s: 0, k: 0, dlat: 0, lv: 0, sp: 1.2, vmax: rnd(1.05, 1.5), len: 0.5, wid: 0.5,
    rL: Math.random(), ne: 0, ph: rnd(0, 6.28), buoc: rnd(0, 6), non: Math.random() < 0.15,
    c2: new THREE.Color(chon(AO)), c3: new THREE.Color(chon(DA)), y: 0.15,
  };
  mau(p, a);
  a.x = a.px; a.z = a.pz; a.goc = Math.atan2(-a.fz, a.fx);
  DS.push(a); moi.push(a);
  return a;
}

// ───────────────────────── luật đi của xe ─────────────────────────
// Độ lấn sâu nhất của thân xe a (đặt ở x, z, góc g) vào thân j; 0 là không chạm. Hai hình chữ nhật, kiểm theo trục tách.
function lanSau(x, z, g, al, aw, j) {
  const ax = Math.cos(g), az = -Math.sin(g), bx = Math.cos(j.goc), bz = -Math.sin(j.goc);
  const dx = j.x - x, dz = j.z - z;
  let m = 99;
  for (let t = 0; t < 4; t++) {
    const ux = t === 0 ? ax : t === 1 ? -az : t === 2 ? bx : -bz;
    const uz = t === 0 ? az : t === 1 ? ax : t === 2 ? bz : bx;
    const ra = (al / 2) * Math.abs(ax * ux + az * uz) + (aw / 2) * Math.abs(-az * ux + ax * uz);
    const rb = (j.len / 2) * Math.abs(bx * ux + bz * uz) + (j.wid / 2) * Math.abs(-bz * ux + bx * uz);
    const o = ra + rb - Math.abs(dx * ux + dz * uz);
    if (o <= 0) return 0;
    if (o < m) m = o;
  }
  return m;
}
// Xe a dời từ chỗ cũ (xT, zT, gT) sang chỗ mới (x, z, g) có lấn sâu thêm vào xe / người nào không — so từng cặp một,
// nên đang dính xe này không thành giấy phép lấn xe kia.
// Độ lấn tối đa coi là "chạm sượt" (m). Nhỏ hơn mức này được trượt dọc theo nhau: hai xe đi sát sườn mà cấm trượt thì
// xe đang sát vẫn bị khoá cứng tại chỗ — xe đứng yên mới nhích, mỗi bước lệch góc vài phần mm cũng tính là lấn thêm.
const CHAM = 0.06;
// Nửa bề ngang thật của thân j đo theo trục (ux, uz) — thân xe nằm chéo / vuông góc thì "bề ngang" của nó so với hướng
// mình đi là gần cả chiều dài, không phải nửa bề rộng. Tính như hai xe luôn song song là gốc của lỗi lao mũi vào sườn
// xe cắt ngang: luật bám đuôi tưởng nó nằm ngoài làn mình, tới lúc chạm thì hai mũi đã khoá vào nhau không ai đi được.
function nua(j, ux, uz) {
  const bx = Math.cos(j.goc), bz = -Math.sin(j.goc);
  return (j.len / 2) * Math.abs(bx * ux + bz * uz) + (j.wid / 2) * Math.abs(-bz * ux + bx * uz);
}
function vuong(a, x, z, g, xT, zT, gT) {
  const cx = cellX(x), cz = cellX(z);
  for (let gx = cx - 2; gx <= cx + 2; gx++) {
    if (gx < 0 || gx >= G) continue;
    for (let gz = cz - 2; gz <= cz + 2; gz++) {
      if (gz < 0 || gz >= G) continue;
      for (let k = head[gx * G + gz]; k !== -1; k = nxt[k]) {
        const j = DS[k];
        if (!j || j === a || j.y > 2) continue; // chỉ bỏ qua chiếc đang bay cao trên trời
        if (a.loai === 'bo' && j.loai === 'bo') continue; // người đi bộ len vai nhau trên vỉa hè
        const dx = j.x - x, dz = j.z - z, r = (a.len + j.len) / 2 + 0.3;
        if (dx * dx + dz * dz > r * r) continue;
        // Không có ngoại lệ nào: không xe nào đi xuyên xe nào. Lỡ đang chạm (vừa rơi xuống, người bước ra) thì chỉ được
        // dời sao cho chỗ chạm NÔNG HẲN đi — trước cho trượt ngang ở cùng độ sâu nên hai thân lướt qua nhau.
        // Người đi bộ không bước sát vào thân xe (xe đâm là chết): bước của người kiểm với thân nới rộng ~0,35 m quanh
        // người. Chỉ áp cho bước của NGƯỜI — áp cả cho xe thì xe sát người đang đứng chờ không nhích được, hai bên chờ nhau.
        // Xe đang đứng (thường là đứng nhường chính người này) thì chỉ giữ hở ~15 cm, không thì người đứng chết bên xe
        // đang chờ mình, xe chờ người — hai bên chờ nhau.
        const M = a.loai === 'bo' && j.loai !== 'bo' ? (j.sp > 0.3 ? 0.7 : 0.3) : 0;
        const o = lanSau(x, z, g, a.len + M, a.wid + M, j);
        if (o <= CHAM) continue; // chạm nhẹ (sượt gương) thì được, không ăn sâu hơn
        const o0 = lanSau(xT, zT, gT, a.len + M, a.wid + M, j);
        // Lấn quá mức chạm sượt chỉ được khi chỗ chạm nông đi thật, hoặc đang dời RA XA xe kia (tâm cách xa thêm) mà
        // không sâu thêm chút nào (trượt ra khỏi chỗ chạm). Không có "ra xa mà sâu thêm vài mm": dồn lại thành xuyên.
        const xa = (x - xT) * (xT - j.x) + (z - zT) * (zT - j.z) > 0;
        if (o0 > CHAM && (o < o0 - 1e-5 || (xa && o <= o0))) continue;
        // chạm nông (không quá 2,5 lần mức sượt) mà dời đi không sâu thêm = cạ sườn trượt qua nhau, không phải xuyên.
        // Cấm luôn thì hai xe khác hướng cạ mũi vào sườn nhau trong lòng ngã tư khoá cứng: bước nào cũng "chạm".
        // Trần cứng 2,5 lần mức sượt: trong trần đó được cạ trượt qua nhau (thân xoay theo đường cong lún thêm vài mm là
        // thật), vượt trần là chặn — nên không bao giờ thành xuyên. Đòi "không sâu thêm 1 mm nào" là hai xe cắt nhau khoá chết.
        if (o0 <= CHAM * 2.5 && o <= CHAM * 2.5) continue;
        vuongJ = j; return true;
      }
    }
  }
  return false;
}
function datCho(a, s, d, k) {
  a.s = s; a.dlat = d; a.k = k;
  mau(a.p, a);
  a.x = a.px - a.fz * a.dlat; a.z = a.pz + a.fx * a.dlat;
  return Math.atan2(-a.fz, a.fx) - Math.atan2(a.lv, a.sp + 1.2);
}
// a đang đứng chắn ngay trước mũi j → j không qua được chừng nào a chưa đi, nên a nhường j chỉ thành kẹt cứng cả hai.
// Nhưng hai xe cắt nhau mà mỗi chiếc đều đã nằm trước mũi chiếc kia thì ngoại lệ này cho CẢ HAI cùng tiến → húc mũi
// khoá chết (gốc nút tắc đo được 21/11/2026) — khi đó xe kém quyền vẫn nhường như thường.
function chanMui(a, j) {
  const ex = a.x - j.x, ez = a.z - j.z;
  const lon = ex * j.fx + ez * j.fz, lat = ex * -j.fz + ez * j.fx;
  return lon > 0 && lon < nua(a, j.fx, j.fz) + nua(j, j.fx, j.fz) + 2.5 && Math.abs(lat) < nua(a, -j.fz, j.fx) + nua(j, -j.fz, j.fx) + 0.3;
}
// Thứ tự nhường: xe đã ở trong lòng ngã tư trước, rồi xe đứng kẹt lâu hơn (gỡ nút = cho xe nút đi sớm hơn), rồi xe đến trước.
// Người đi bộ đang ở dưới lòng đường luôn được nhường trước (xe nào cũng chờ họ qua) — 8e9 cao hơn mọi xe.
const hang = (a) => (a.loai === 'bo' ? (a.trenDuong ? 8e9 : 0) - a.id : (a.trongNga ? 4e9 : 0) + Math.min(16, Math.floor(a.ket * 2)) * 2e8 - a.id);
// a đi trước j? Quyền (đã cộng quyền mượn) bằng nhau — cả vòng chờ nhau sau khi mượn — thì xét quyền gốc, để luôn có
// đúng một xe đi trước: bằng nhau mà không phân xử là cả hai cùng đứng nhìn nhau.
const hon = (a, j) => a.uu > j.uu || (a.uu === j.uu && hang(a) > hang(j));
// Quyền thật dùng để nhường (a.uu): xe đang chắn đường một xe quyền cao hơn được "mượn" quyền của xe đó, để nó đi
// trước dọn lối thay vì đứng nhường người khác. Không có bước này thì xe quyền cao kẹt sau một xe quyền thấp đang
// nhường xe thứ ba… thành vòng chờ nhau và cả lòng ngã tư đứng im. Vòng chờ khép kín → mọi xe trong vòng cùng quyền
// → không ai nhường ai → vòng tự gỡ (chốt cứng va chạm vẫn giữ không ai đi xuyên ai).
// Quyền mượn được giữ ~3 s rồi mới trả: nếu tính lại từ đầu mỗi bước thì xe vừa mượn quyền thôi nhường → quan hệ chờ
// đổi → bước sau mất quyền → lại nhường, nhấp nháy tại chỗ mà không bao giờ kịp lăn bánh ra khỏi nút.
function tinhQuyen(dt) {
  for (const a of DS) { const h = hang(a); a.tGiu = (a.tGiu || 0) - dt; a.uu = a.tGiu > 0 && a.uuGiu > h ? a.uuGiu : h; a.muon = false; }
  for (let lap = 0; lap < 8; lap++) {
    let doi = false;
    for (const a of DS) { const j = a.choAi; if (j && a.sp < 0.5 && !j.het && j.uu < a.uu) { j.uu = a.uu; j.muon = true; doi = true; } }
    if (!doi) break;
  }
  for (const a of DS) if (a.muon) { a.uuGiu = a.uu; a.tGiu = 3; }
}
let vuongJ = null; // xe vừa chặn nước đi bị từ chối gần nhất
// Liều theo thanh trượt, áp ngay cho cả xe đang chạy: 0% là không ai cố ý vượt đèn.
function laLieu(a) {
  const l = CAI.lieu;
  const nguong = a.loai === 'xm' ? l : a.loai === 'bo' ? l : a.taxi ? Math.min(0.9, l * 3) : a.loai === 'oto' ? l * 0.5 : 0;
  return a.rL < nguong;
}
// Hai xe cùng nằm trong hành lang phía trước của nhau (cắt ngang nhau trong lòng ngã tư) → xe "được quyền" bỏ qua xe kia.
// chuỗi "ai chờ ai" đi từ j có quay về a không (vòng chờ nhau)
// Đi hết vòng (tới 80 xe): giờ tan tầm vòng chờ nhau trong lòng ngã tư dài vài chục xe máy, giới hạn ngắn là không
// thấy vòng → cả vòng đứng bám đuôi nhau mãi.
function choToi(j, a) {
  for (let x = j.choAi, n = 0; x && n < 80; x = x.choAi, n++) if (x === a) return true;
  return false;
}
function uuTien(a, j, ex, ez, hw) {
  const lonJ = -(ex * j.fx + ez * j.fz);
  if (lonJ <= 0.1 || lonJ > 16) return false;
  const latJ = -(ex * -j.fz + ez * j.fx);
  if (Math.abs(latJ) >= hw) return false;
  return hon(a, j);
}
// Khoảng lệch ngang được phép so với đường đi: trên đường thì trong nửa đường của mình (không lấn làn ngược), trong lòng
// ngã tư thì quanh đường cong; xe đứng kẹt lâu được dạt rộng hơn để thoát sang bên.
function bien(a) {
  const p = a.p, h = a.wid / 2 + 0.12, h2 = a.wid / 2 + 0.07;
  if (p.ve) { // đường anh tự vẽ: bám sát nét, chỉ dạt chút để né; nhập làn rồi thì như đường thường
    if (a.s < p.sNoi) { const w = a.loai === 'xm' ? 1.5 : 0.8; return [-w, w]; }
    return [h - p.o2, p.hw2 - h2 - p.o2];
  }
  if (a.s < p.sIn) {
    const leo = a.hayLeo && a.s < p.sStop && a.sp < 2.5 ? 2.0 : 0; // leo lề khi kẹt trước đèn đỏ
    return [h - p.o1, p.hw1 - h2 - p.o1 + leo];
  }
  if (a.s > p.sOut) return [h - p.o2, p.hw2 - h2 - p.o2];
  const b = a.loai === 'xm' ? Math.max(2.2, 4.5 - (a.s - p.sIn) * 0.3) + Math.min(3, a.ket * 0.6) : Math.max(0.8, 3.5 - (a.s - p.sIn) * 0.35) + Math.min(2, a.ket * 0.4);
  return [-b, b];
}
function buocXe(a, dt) {
  if (a.nhac) return bay(a, dt);
  if (a.dangVe) { a.sp = 0; return; } // đang được vẽ đường: đứng chờ nét vẽ xong
  if (a.nga && nam(a, dt)) return;
  const xm = a.loai === 'xm';
  const p = a.p;
  const fx = a.fx, fz = a.fz, rx = -fz, rz = fx;
  const look = xm ? 11 : 18;
  let ai = null, chan = null;
  let f0 = 99, fL = 99, fR = 99, vj = 0, day = 0, hoT = 99, hoP = 99;
  const lanCat = []; // làn trước mũi các xe đang cắt ngang đường mình: [mép gần, mép xa, xe]
  const cr = xm ? 2 : 3, off = xm ? 1.3 : a.wid + 0.5;
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
        // bề ngang / bề dọc chung của hai thân theo hướng mình đi, tính cả góc nằm của từng xe (xe cắt ngang chiếm cả làn)
        const nL = nua(a, rx, rz) + nua(j, rx, rz);
        const hw = nL + (xm ? 0.15 : 0.3);
        const hl = nua(a, fx, fz) + nua(j, fx, fz);
        // khoảng hở hai bên với xe đang đi song song (gồm cả xe sắp ngang hàng) — để không tạt vào sườn xe khác
        if (j.loai !== 'bo' && Math.abs(lon) < hl + 0.3 + a.sp * 0.25) {
          if (lat > 0) hoP = Math.min(hoP, lat - hw); else hoT = Math.min(hoT, -lat - hw);
        }
        if (xm && j.loai !== 'bo' && Math.abs(lon) < hl * 0.8 && Math.abs(lat) < hw + 0.2) { // người đi bộ không đẩy được xe
          const o = hw + 0.2 - Math.abs(lat);
          day += lat > 0.01 ? -o : lat < -0.01 ? o : a.id & 1 ? o : -o;
        }
        // Xe cắt ngang (khác hướng): đoán chỗ nó sẽ ở khi mình tới — nếu đường quét của nó chắn trước mũi mình thì
        // xe kém quyền (hang thấp hơn) nhường, xe kia đi. Trước chỉ thấy xe cắt ngang khi đã sát bên → húc rồi bật ra.
        // j đang đứng chờ chính xe này — trực tiếp hoặc qua một chuỗi chờ nhau quay về mình — thì nhường / bám đuôi nó chỉ
        // thành cả vòng đứng nhìn nhau: mình phải đi để dọn lối. Đi được tới đâu là do chốt va chạm cứng quyết, nên không
        // có chuyện húc xuyên qua nó.
        let cm = -1;
        // Cả hai cùng nằm trong một vòng chờ (j chờ mình, mình cũng chờ j) thì chỉ xe quyền cao bỏ qua xe kia; trước cả hai
        // cùng "nó đang chờ mình" → cùng lao mũi vào nhau → khoá cứng (cặp xe máy cắt nhau giữa lòng ngã tư, 22/11/2026).
        const choMinh = () => (cm < 0 ? (cm = choToi(j, a) && (!choToi(a, j) || hon(a, j)) ? 1 : 0) : cm) === 1;
        if (lon > 0.1 && j.fx * fx + j.fz * fz < 0.7 && hon(j, a) && !(j.lui > 0) && (j.loai === 'bo' ? j.trenDuong : !chanMui(a, j) || chanMui(j, a)) && !choMinh()) {
          const tau = lon / Math.max(a.sp, 1.5);
          if (tau < 2.5) {
            // Đoán theo tốc độ THẬT của xe kia. Trước coi xe đang đứng kẹt như sắp lao tới 2,5 m/s → xe giữa lòng đường
            // trống đứng chờ một chiếc không bao giờ tới (anh 21/11/2026 khoanh ảnh). Giữ lối thoát cho xe kẹt là việc
            // của tuỳ chọn "Nhường lối thoát" (lanCat) — đo đúng làn trước mũi nó, không đoán bừa.
            const vJ = Math.max(j.sp, j.loai === 'bo' && !j.choDen && !j.nga ? 1.1 : 0);
            const latT = lat + vJ * (j.fx * rx + j.fz * rz) * tau;
            if (Math.min(lat, latT) < hw + 0.3 && Math.max(lat, latT) > -hw - 0.3) { const g = lon - hl; if (g < f0) { f0 = g; vj = 0; ai = j; } }
          }
        }
        // Làn trước mũi xe cắt ngang (xe đó đang muốn đi, không đứng chờ đèn): đường mình băng qua nó ở đâu, rộng bao nhiêu.
        if (j.loai !== 'bo' && !j.choDen && !j.dangDon && !j.nhac) {
          const c = j.fx * fx + j.fz * fz, sn = j.fx * rx + j.fz * rz;
          // Tuỳ chọn "nhường lối thoát": xe kia đang đứng kẹt muốn đi thì lối trước mũi nó là của nó — kể cả xe đi gần
          // ngược chiều (rẽ trái cắt mặt), nhìn xa hơn trước mũi nó.
          const nl = CAI.nhuongLoi && j.sp < 0.5;
          if (Math.abs(c) < (nl ? 0.92 : 0.7) && Math.abs(sn) > (nl ? 0.2 : 0.3)) {
            const t = -lat / sn, u = lon + t * c, nj = nua(j, j.fx, j.fz);
            if (t > nj - 0.2 && t < nj + (nl ? 5 : 4)) {
              const w = (j.wid / 2 + a.wid / 2 + 0.25) / Math.abs(sn) + a.len / 2;
              if (u - w > 0.3 && u - w < look) lanCat.push([u - w, u + w, j, nl]);
            }
          }
        }
        if (lon <= 0.1 || Math.abs(lat) > hw + off + 0.2) continue;
        const g = lon - hl;
        // Quyền đi trước chỉ dùng được với xe CÒN kịp tránh. Xe kia đã nằm trong làn trước mũi mình và tới lúc mình đến
        // vẫn chưa ra khỏi làn (đang đứng, hoặc đi dọc cùng mình) là vật cản thật — bỏ qua nó là lao mũi vào sườn nó, hai
        // xe khoá cứng vào nhau. Khi đó mình dừng trước nó; nó thấy mình đang chờ nó (choToi) nên nó đi trước dọn lối.
        if (j.loai !== 'bo' && uuTien(a, j, ex, ez, hw)) {
          const tau = Math.max(0, g) / Math.max(a.sp, 0.5), latT = lat + j.sp * (j.fx * rx + j.fz * rz) * tau;
          if (!(Math.abs(lat) < hw && Math.abs(latT) < hw)) continue;
        }
        // xe trước đang song song với mình (g<0): chỉ chắn khi thân thật chồng ngang, không tính lề an toàn
        if (Math.abs(lat) < (g < 0 ? nL + 0.05 : hw) && g < f0 && !choMinh()) { f0 = g; vj = Math.max(0, j.sp * (j.fx * fx + j.fz * fz)); ai = j; }
        // khoảng trống phía trước nếu dạt sang trái / phải một thân xe — cả xe máy lẫn ô tô đều lách khi bị chặn
        if (Math.abs(lat + off) < hw) fL = Math.min(fL, g);
        if (Math.abs(lat - off) < hw) fR = Math.min(fR, g);
      }
    }
  }
  const T = xm ? 0.75 : a.loai === 'bus' ? 1.6 : 1.3, s0 = xm ? 0.45 : 1.6;
  // Không dừng chắn ngang trước mũi xe khác: phía trước không đủ chỗ để thân mình qua HẾT làn của xe đang cắt ngang thì
  // dừng trước làn đó, chừa lối cho nó. Dừng giữa làn người khác là cách duy nhất để lòng ngã tư khoá thành vòng chờ nhau
  // — mỗi xe đứng chắn mũi một xe, xe đó lại đứng chắn mũi xe kế. Luật này của từng xe, không phải chặn cả hàng ở vạch.
  if (lanCat.length) {
    const toi = f0 + vj * 1.5; // chỗ xa nhất thân mình sẽ tới (xe trước đang đi thì tính cả quãng nó dọn ra)
    // Nhường lối thoát (tuỳ chọn, cách người VN đi): thấy xe kia đang kẹt mà mình tiến vào chỗ trống trước mũi nó là
    // nó hết đường ra → không lấn vào, dừng ngoài lối đó cho nó đi trước, dù mình lọt qua được. Xe kia lại đang chờ
    // chính mình (choToi) thì mình đi, không thì cả hai nhường nhau đứng im.
    for (const [gan, xa, j, nl] of lanCat) if ((nl || toi < xa) && gan < f0 && !(choToi(j, a) && (!choToi(a, j) || hon(a, j)))) { f0 = gan; vj = 0; ai = j; }
  }
  a.trongNga = a.s > p.sIn && a.s < p.sOut;
  let vt = a.vmax * (a.trongNga && xm ? 0.8 : 1);
  vt = Math.min(vt, Math.max(0, (f0 - s0) / T + vj * 0.85));
  if (f0 < s0 * 0.6) a.sp = Math.min(a.sp, vj); // sát đuôi xe trước: không bao giờ nhanh hơn nó → không húc
  a.choDen = false;
  let latDich = 0;
  if (a.sDon > 0) {
    const con = a.sDon - a.s;
    if (con < 16) {
      latDich = a.s < a.p.sIn ? a.p.hw1 - a.p.o1 - 1.15 : a.p.hw2 - a.p.o2 - 1.15; // tạt sát lề, không xi nhan
      vt = Math.min(vt, con < 0.3 ? 0 : Math.sqrt(2 * 4 * con));
      if (con < 0.3) {
        if (!a.dangDon) { a.dangDon = true; CAI.don++; }
        a.tDon -= dt;
        if (a.tDon <= 0) { a.sDon = -1; a.dangDon = false; }
      }
    }
  }
  // Đèn: xe chưa "được qua" (camKet) và mũi chưa vào lòng ngã tư thì nghe đèn. camKet chỉ có khi mũi xe thật sự qua
  // vạch dừng lúc đang được đi — trước gắn cho mọi xe còn ở phía sau lúc đèn xanh, nên cả hàng đứng chờ cũng thành
  // "đã cam kết", đèn đỏ vẫn chạy, mà bộ đếm lại bỏ qua xe cam kết → liều 0% vẫn vượt, đếm ra 0 lượt.
  const dau = a.s + a.len / 2;
  let m = 'x', duoc = true;
  if (!a.camKet && dau < p.sIn) {
    const [mm, con, qua] = den(a.arm * 3 + QI[a.quay]);
    m = mm;
    const lieu = laLieu(a), lan = lieu ? a.lan : 0; // chỉ xe liều mới lấn qua vạch dừng
    // Đèn vàng / vừa đỏ: chỉ xe không còn phanh kịp trước vạch mới được đi tiếp (đúng luật). Tính lại mỗi bước theo
    // quãng phanh thật — xe đã chậm lại vì kẹt hàng thì phải dừng ở vạch, không được "cam kết" từ lúc vàng rồi bò qua lúc đỏ.
    // Đã bị bảo dừng (đèn vàng lúc còn xa) thì giữ lệnh dừng tới khi xanh lại: trước tính lại mỗi bước nên xe ở xa không
    // phanh sớm (đà phanh êm chỉ hãm khi đã gần), tới sát vạch lại thành "không kịp phanh" và lao qua lúc đỏ vừa bật.
    if (m === 'x') a.lenhDung = false;
    const khongKip = !a.lenhDung && dau < p.sStop && p.sStop - dau < (a.sp * a.sp) / 8 + a.sp * 0.25;
    duoc = m === 'x';
    if (m === 'v') duoc = khongKip || lieu;
    if (m === 'd') duoc = (khongKip && qua < 1.5) || (xm && a.quay === 'phai' && CAI.rePhai) || (lieu && (qua < 3 || con < 2.5));
    // Tuỳ chọn (mặc định tắt): lòng ngã tư đã kẹt / hướng kia còn đầy xe thì đứng chờ ở vạch kể cả đèn xanh.
    if (CAI.choNga && (ketNga > NGUONG_KET || trongNgaG[1 - a.g] > NGUONG_CAT) && dau < p.sStop) duoc = false;
    // Mặc định, kiểu người VN: vẫn lao vào khe — nhưng không lao khi ngay sau vạch phía trước mũi đã kín (không đủ một thân
    // xe + khoảng thoát). Vào rồi đứng chết giữa lòng ngã tư là chặn luôn lối hướng kia; kẹt kín lòng ngã tư từ đây.
    if (duoc && dau < p.sStop && p.sStop - dau < 2 && f0 < a.len + (xm ? 2 : 4)) duoc = false;
    if (!duoc) {
      if (m !== 'x' && !lieu) a.lenhDung = true;
      const gap = p.sStop + lan - 0.15 - dau;
      vt = Math.min(vt, gap < 0.3 ? 0 : Math.sqrt(2 * 3.2 * gap));
      a.choDen = true;
    }
  }
  // Gỡ nút: xe đứng kẹt (không phải chờ đèn) lâu thì được ưu tiên đi trước (hang), tăng tốc gấp hơn khi có chỗ,
  // và dạt sang bên tìm lối — không bao giờ đi xuyên hay cắt mặt xe khác.
  // Bị chặn mũi mà một bên phía trước còn trống → chủ động lách sang đó để thoát (anh 22/11/2026: "còn đoạn trống thì
  // xe chủ động lách sang để thoát, không đứng như vậy"). Chỉ lách khi bên đó có đường thoát thật: phía trước bên đó trống
  // ít nhất một thân xe + khoảng an toàn, và hở sườn bên đó đủ một thân xe — không lách bừa vào khe rồi đứng kẹt chắn
  // luôn lối người khác (21/11/2026). Xe chỉ bẻ lái được khi bánh lăn, nên xe đang đứng phải nhích tới chầm chậm theo
  // hướng lách — trước đây xe đứng im (tốc 0) thì không bao giờ dời ngang được, đứng chết sau xe trước dù cạnh trống.
  const [lo, hi] = bien(a);
  let neThoat = 0;
  if (!latDich && (a.loai !== 'bus' || a.ket > 1) && f0 < a.sp * 1.1 + (xm ? 2.5 : 5)) {
    const can = xm ? 0.6 : 2.5, thoat = Math.max(f0 + can, a.len + (xm ? 1.5 : 3));
    if (fL > thoat && fL >= fR && hoT > a.wid * 0.6 && a.dlat - off * 0.5 > lo) neThoat = -1;
    else if (fR > thoat && hoP > a.wid * 0.6 && a.dlat + off * 0.5 < hi) neThoat = 1;
    if (neThoat && !a.choDen) vt = Math.max(vt, xm ? 0.9 : 0.5);
  }
  if (a.lui > 0) { a.lui -= dt; vt = 0; } // đang lùi nhường lối: không tiến lại vào chỗ vừa chừa
  const ac = (xm ? 2.6 : a.loai === 'bus' ? 1.0 : 1.8) * (a.ket > 1 ? 1.8 : 1);
  a.sp = vt > a.sp ? Math.min(vt, a.sp + ac * dt) : Math.max(vt, a.sp - 9 * dt);
  if (a.sp < 0.2 && !a.choDen && !a.dangDon) a.ket = Math.min(10, a.ket + dt); else a.ket = Math.max(0, a.ket - dt * 0.5);
  {
    let lvt = 0;
    const vNe = xm ? 1.4 : a.loai === 'bus' ? 0.6 : 1.1;
    if (latDich) lvt = (latDich - a.dlat) * 1.2; // taxi tạt sát lề đón khách
    else if (neThoat) lvt = neThoat * vNe; // bị chặn mũi → lách sang bên phía trước thoáng (cả ở ngã tư lẫn ngoài đường)
    // không bị chặn: xe máy lượn nhẹ về giữa, ô tô giữ làn đang đi (ngoài đường) / bám đường cong (trong ngã tư)
    if (!lvt) lvt = xm ? -a.dlat * (a.trongNga ? 0.6 : 0.08) + Math.sin(tg * a.w + a.ph) * 0.25 : -a.dlat * (a.trongNga ? 0.5 : 0.03);
    if (xm) lvt += day * 0.9; // chỉ còn để tách nhẹ khi lỡ chồng nhau, không bật nẩy
    if (a.dlat < lo) lvt = Math.max(lvt, (lo - a.dlat) * 1.5);
    if (a.dlat > hi) lvt = Math.min(lvt, (hi - a.dlat) * 1.5);
    const lim = xm ? 0.35 + a.sp * 0.3 : (a.taxi ? 1.6 : 1.1) * Math.min(1, a.sp / 2 + (a.dangDon ? 0 : 0.4));
    lvt = Math.max(-lim, Math.min(lim, lvt));
    a.lv += (lvt - a.lv) * Math.min(1, dt * (xm ? 5 : 3));
  }
  const sTruoc = a.s, dTruoc = a.dlat, kTruoc = a.k, xT = a.x, zT = a.z, gT = a.goc;
  // không tạt ngang quá khoảng hở thật bên đó
  let dl = a.lv * dt;
  if (dl > 0 && dl > hoP - 0.05) { dl = Math.max(0, hoP - 0.05); a.lv *= 0.5; }
  else if (dl < 0 && -dl > hoT - 0.05) { dl = -Math.max(0, hoT - 0.05); a.lv *= 0.5; }
  // Không xe nào bị đẩy (anh 21/11/2026): xe chỉ dời ngang được khi bánh lăn tới — không quá LAI lần quãng vừa tiến
  // (góc lái tối đa). Trước xe đứng im vẫn trượt ngang (lực tách chồng lấn, kể cả từ người đi bộ; nước "nhích ngang tại
  // chỗ") — nhìn như bị người / xe khác đẩy đi ngang, và chính các cú trượt đó lấp chỗ xe khác sắp đi, gây tắc.
  // Kẹt thì đứng im — xe máy thật ở VN cũng vậy. Xe máy được bẻ lái gấp hơn ô tô (LAI lớn hơn) nhưng vẫn chỉ khi lăn.
  const LAI = xm ? 1.0 : a.loai === 'bus' ? 0.25 : 0.35, mL = LAI * a.sp * dt;
  dl = Math.max(-mL, Math.min(mL, dl));
  if (day) dl += Math.max(-mL, Math.min(mL, day * 0.6 * dt)); // tách khỏi chồng lấn chỉ khi đang lăn, chậm, không giật
  a.lv = Math.max(-LAI * a.sp, Math.min(LAI * a.sp, a.lv));
  // Đặt thử chỗ mới. Thân xe lấn sâu thêm vào xe / người khác thì bỏ bớt: đi thẳng thôi → tạt ngang thôi → đứng yên.
  // Đây là chốt cứng cuối cùng: luật bám đuôi / nhường ở trên có đoán sai thì xe vẫn không đi xuyên qua nhau.
  // Lùi ra khỏi xe j (thân giữ hướng, bẻ lái ra phía xa j theo quãng lùi thật); lùi không nổi thì đứng nguyên.
  const luiRa = (j, goc) => {
    const ket = (g) => vuong(a, a.x, a.z, g, xT, zT, gT);
    const ex = j.x - xT, ez = j.z - zT, xa = ex * -a.fz + ez * a.fx > 0 ? -1 : 1;
    const trong = sTruoc >= p.sIn && sTruoc <= p.sOut, rong = trong ? (xm ? 2.5 : 1.5) : 0.05, loT = lo - (trong ? rong : 1.5), hiT = hi + rong;
    const lui = (xm ? 0.5 : 0.35) * dt;
    for (const h of [xa, 0, -xa]) {
      const d = dTruoc + h * LAI * lui;
      if (h && (d < loT || d > hiT)) continue;
      a.lv = 0;
      goc = datCho(a, sTruoc - lui, d, kTruoc);
      if (!ket(goc)) return goc;
      if (!ket(gT)) return gT; // lùi thẳng theo thân đang nằm, không xoay thân tại chỗ
    }
    goc = datCho(a, sTruoc, dTruoc, kTruoc);
    return ket(goc) ? gT : goc;
  };
  let goc = datCho(a, sTruoc + a.sp * dt, dTruoc + dl, kTruoc);
  // xoay thân tại chỗ (góc theo vận tốc ngang) cũng quét qua xe bên cạnh → cũng phải kiểm, không chỉ khi tiến / tạt
  const len0 = a.sp * dt;
  if (len0 > 1e-4 || Math.abs(dl) > 1e-4 || Math.abs(goc - gT) > 1e-4) {
    const ket = (g) => vuong(a, a.x, a.z, g, xT, zT, gT);
    if (ket(goc)) {
      // chỉ tính "bị xe kia chặn" khi xe muốn TIẾN mà không được; đứng chờ xe trước (vt = 0) mà chỉ vướng lúc xoay / nhích
      // ngang thì người giữ chân nó vẫn là xe phía trước — ghi nhầm thành xe bên cạnh là đẻ ra vòng chờ nhau giả
      chan = len0 > 1e-4 ? vuongJ : null;
      a.lv *= 0.5;
      // Thử lần lượt các nước đi thật của tài xế: tiến thẳng (bớt đánh lái) → tiến chậm hơn → lách sang phía XA xe
      // đang chặn → phía kia; nước lách chỉ ngang theo quãng tiến thật. Mỗi nước thử cả với thân giữ nguyên hướng cũ: thân
      // xoay theo tay lái lúc gần đứng yên quét sang xe bên cạnh, nên giữ hướng là cách duy nhất để trượt ra khỏi chỗ cạ.
      const len = a.sp * dt, ne = (xm ? 1.4 : a.loai === 'oto' ? 0.8 : 0.4) * dt * Math.max(1, a.sp);
      const ex = vuongJ.x - a.x, ez = vuongJ.z - a.z, xa = ex * -a.fz + ez * a.fx > 0 ? -1 : 1; // phía +dlat là (-fz, fx)
      // Biên cho nước THOÁT rộng hơn biên lúc đi thường: dải lệch quanh đường cong hẹp dần khi vào sâu lòng ngã tư, xe
      // đã bị ép ra sát mép dải thì mọi nước né đều "ra ngoài biên" → đứng chết. Lòng ngã tư là mặt đường trống, lách
      // thêm 1,5 m mỗi bên là thật; ngoài đường chỉ được lấn về phía tim đường (như ngoài đời), phía lề vẫn chặn.
      const trong = a.s >= p.sIn && a.s <= p.sOut, rong = trong ? (xm ? 2.5 : 1.5) : 0.05, loT = lo - (trong ? rong : 1.5), hiT = hi + rong;
      let duocDi = false, tien = 1;
      for (tien of [1, 0.6, 0.3]) {
        for (const h of [0, xa, -xa]) {
          const neT = Math.min(ne, LAI * len * tien); // lách theo quãng tiến thật, không trượt ngang tại chỗ
          const d = dTruoc + h * neT;
          if (h && (d < loT || d > hiT)) continue;
          const lv0 = a.lv;
          a.lv = h ? h * neT / dt : a.lv * 0.5;
          goc = datCho(a, sTruoc + len * tien, d, kTruoc);
          if (!ket(goc)) { duocDi = true; break; }
          if (!ket(gT)) { goc = gT; duocDi = true; break; }
          a.lv = lv0;
        }
        if (duocDi) break;
      }
      if (duocDi) a.sp *= tien; // tốc độ theo quãng thật sự đi được
      else {
        a.sp = 0; a.lv = 0;
        goc = datCho(a, sTruoc, dTruoc, kTruoc); // đứng hẳn: không tiến thì cũng không dời ngang
        if (ket(goc)) goc = gT;
        // Hai xe chúi mũi vào nhau (không ai tiến được, không được trượt ngang): xe kém quyền LÙI lại như ngoài đời — xe
        // máy chống chân lùi, ô tô gài số lùi — vừa lùi vừa bẻ lái ra phía xa xe kia, chừa chỗ cho xe quyền cao đi trước.
        // Dời ngang khi lùi cũng chỉ theo quãng bánh lăn thật. Không có bước này cả lòng ngã tư khoá vào một cặp xe đó.
        // Xe kém quyền lùi trước; nó không lùi nổi (đuôi kẹt xe sau) thì sau 4 s xe quyền cao cũng lùi để gỡ.
        if (a.ket > 1.5 && vuongJ && vuongJ.loai !== 'bo' && (hon(vuongJ, a) || a.ket > 4)) goc = luiRa(vuongJ, goc);
        // Xe máy kẹt cứng giữa lòng ngã tư quá 6 s: người lái chống chân dắt xe dạt sang bên ~0,3 m/s — tự mình dời đi,
        // chỉ vào chỗ trống thật (không chạm ai, không đẩy ai). Không có nước này nút tắc kín lòng ngã tư không bao giờ gỡ.
        else if (xm && trong && a.ket > 6) {
          const dat = 0.3 * dt;
          for (const h of [xa, -xa]) {
            const d = dTruoc + h * dat;
            if (d < loT || d > hiT) continue;
            a.lv = 0; goc = datCho(a, sTruoc, d, kTruoc);
            if (!ket(gT)) { goc = gT; a.dat = true; break; }
            goc = datCho(a, sTruoc, dTruoc, kTruoc); if (ket(goc)) goc = gT;
          }
        }
      }
    }
  }
  // ai đang giữ chân xe này (bị chặn thân, hoặc đứng sát chờ / nhường) — để tinhQuyen cho xe đó mượn quyền
  // Ghi cả khi xe còn nhích chậm: vòng bám đuôi nhau trong lòng ngã tư thường có vài xe đang bò 0,3–0,6 m/s — cắt chuỗi
  // ở đó là không xe nào thấy mình nằm trong vòng, cả vòng bò rồi đứng hẳn. Mượn quyền thì chỉ xe đứng thật mới cho.
  // Mình đang đứng nhường j, mà chính thân mình lại chắn cứng mũi j (j muốn đi, bị mình chặn) — đứng nhường như thế là cả
  // hai đứng im mãi (cặp khoá đo được 22/11/2026). Xe nhường phải lùi ra chừa lối, như người ta chống chân lùi xe máy.
  if (!chan && ai && ai.loai !== 'bo' && ai.choAi === a && ai.biChan && a.sp < 0.05 && a.ket > 1.5) goc = luiRa(ai, goc);
  // Hai xe chúi mũi vào nhau, xe kia không lùi nổi (đuôi kẹt xe sau): xe mình lùi hẳn ~2 s, trong lúc đó không tiến lại và
  // xe kia không phải nhường mình (j.lui) — nó đi qua chỗ vừa chừa. Không có thế này thì mình nhích tới, nó nhường mình,
  // mình lại chạm nó: hai xe đứng nhìn nhau cả phút (đo 22/11/2026).
  if (chan && chan.loai !== 'bo' && chan.choAi === a && chan.sp < 0.05 && a.ket > 4 && !(a.lui > 0)) { a.lui = 2; a.luiJ = chan; }
  if (a.lui > 0 && a.luiJ && a.sp < 0.05) goc = luiRa(a.luiJ, goc);
  a.biChan = !!chan;
  a.choAi = chan || (f0 < 2 ? ai : null);
  if (!a.camKet) {
    const dau2 = a.s + a.len / 2;
    // mũi qua vạch dừng lúc đèn cho đi → từ đây đi hết, đèn đổi cũng không tính
    if (dau < p.sStop && dau2 >= p.sStop && m !== 'd') a.camKet = true;
    else if (dau < p.sStop && dau2 >= p.sStop && m === 'd' && duoc && !laLieu(a) && !(xm && a.quay === 'phai' && CAI.rePhai)) a.camKet = true; // đỏ vừa bật, phanh không kịp
    // mũi lao vào lòng ngã tư lúc đèn đỏ mà không có quyền → một lượt vượt đèn đỏ (rẽ phải khi bật tuỳ chọn thì không tính)
    else if (dau2 >= p.sIn) { if (m === 'd' && !(xm && a.quay === 'phai' && CAI.rePhai)) CAI.vuot++; a.camKet = true; }
  }
  a.y = xm && a.s < p.sIn && p.o1 + a.dlat > p.hw1 ? 0.15 : 0;
  let dg = goc - a.goc;
  if (dg > Math.PI) dg -= 2 * Math.PI; else if (dg < -Math.PI) dg += 2 * Math.PI;
  a.goc = goc;
  if (xm) a.nghieng += (Math.max(-0.4, Math.min(0.4, (-dg / Math.max(dt, 1e-3)) * a.sp * 0.05)) - a.nghieng) * Math.min(1, dt * 4);
}
const BONG = { x: 0, z: 0, goc: 0, len: 0, wid: 0 };
function xeTruocMat(a) {
  const g = Math.atan2(-a.fz, a.fx), qx = a.x + a.fx * 1.5, qz = a.z + a.fz * 1.5;
  const cx = cellX(qx), cz = cellX(qz);
  for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
    if (gx < 0 || gz < 0 || gx >= G || gz >= G) continue;
    for (let k = head[gx * G + gz]; k !== -1; k = nxt[k]) {
      const j = DS[k];
      if (!j || j.loai === 'bo' || j.y > 1 || j.nga || j.sp < 0.8) continue;
      BONG.goc = j.goc; BONG.len = j.len; BONG.wid = j.wid + 0.3;
      for (let t = 0; t <= 1.5; t += 0.5) {
        BONG.x = j.x + j.fx * j.sp * t; BONG.z = j.z + j.fz * j.sp * t;
        if (lanSau(qx, qz, g, 2.6, 1.0, BONG) > 0) return true;
      }
    }
  }
  return false;
}
// Trên đường người sắp băng qua (từ chỗ đứng tới hết vạch) có xe đang đứng — xe dồn lên vạch vì ngã tư tắc, xe nằm ngã.
function vachKet(a, c) {
  const dai = c.s1 - a.s + 0.5;
  for (const j of DS) {
    if (j.loai === 'bo' || j.y > 1 || j.sp >= 0.8) continue;
    const ex = j.x - a.x, ez = j.z - a.z, lo = ex * a.fx + ez * a.fz;
    if (lo < -0.5 || lo > dai) continue;
    if (Math.abs(ex * -a.fz + ez * a.fx) < nua(j, -a.fz, a.fx) + 0.35) return true;
  }
  return false;
}
function buocBo(a, dt) {
  if (a.nhac) return bay(a, dt);
  if (a.nga && nam(a, dt)) return;
  let vt = a.vmax;
  let trenDuong = false, cho = false;
  for (const c of a.p.qua) {
    if (a.s > c.s0 && a.s < c.s1) trenDuong = true;
    // Còn đứng trên lề thì xét lại MỖI khoảnh khắc, chưa bước xuống thì chưa có gì "đã quyết": đèn chuyển xanh cho xe
    // trong lúc đang đứng chờ thì thôi không bước nữa (trước quyết một lần rồi giữ, đứng chờ xe xong vẫn bước giữa đèn
    // xanh). Bước khi: đèn cho người (hoặc người liều) VÀ đường qua không có xe đang đứng kẹt (ngã tư tắc, xe dồn lên
    // vạch) — anh 21/11/2026: người đi bộ phải chờ đèn, chờ xe, chờ cả khi ngã tư đang tắc.
    if (a.s < c.s0 && c.s0 - a.s < 2) {
      const [m, con] = denBo(c.g);
      if (!((laLieu(a) || (m === 'd' && con > 6)) && !vachKet(a, c))) { vt = Math.min(vt, Math.max(0, c.s0 - 0.4 - a.s) * 1.5); cho = true; }
    }
  }
  a.choDen = cho; // đứng chờ đèn (kể cả giữa dải phân cách) — xe không coi là "sắp bước ra" mà nhường mãi
  // Có xe đang chạy tới trước mặt (thân xe sẽ quét qua khoảng 0,2–2,8 m trước người trong 1,5 s tới) → đứng chờ xe qua
  // rồi mới bước, kể cả người liều (anh 21/11/2026). Xe đã dừng nhường người thì không tính, không thành hai bên chờ nhau.
  if (vt > 0 && xeTruocMat(a)) { vt = 0; a.choXe = true; } else a.choXe = false;
  a.sp += (vt - a.sp) * Math.min(1, dt * (vt === 0 ? 8 : 3));
  // người đi bộ cũng không đi xuyên xe: vướng thân xe thì né sang bên, né không được thì đứng chờ
  const sT = a.s, kT = a.k, xT = a.x, zT = a.z, gT = a.goc;
  const dat = (s, ne) => {
    a.s = s; a.k = kT; mau(a.p, a);
    a.dlat = Math.sin(tg * 0.35 + a.ph) * (trenDuong ? 0.3 : 0.9) + ne;
    a.x = a.px - a.fz * a.dlat; a.z = a.pz + a.fx * a.dlat;
    return Math.atan2(-a.fz, a.fx);
  };
  a.ne *= 1 - Math.min(1, dt * 0.5);
  let g = dat(sT + a.sp * dt, a.ne), chanBo = null;
  if (vuong(a, a.x, a.z, g, xT, zT, gT)) {
    chanBo = vuongJ.loai === 'bo' ? null : vuongJ;
    // Người thật bị xe ép: bước chéo né sang phía XA xe đó → phía kia → né ngang tại chỗ → lùi lại một bước. Trước chỉ
    // né rất chậm hai bên, không lùi, nên người và xe máy chắn nhau đứng nhìn nhau mãi.
    const ex = vuongJ.x - a.x, ez = vuongJ.z - a.z, xa = ex * -a.fz + ez * a.fx > 0 ? -1 : 1;
    const v = Math.max(a.sp, 0.8) * dt, ne = 1.2 * dt;
    let ok = false;
    for (const [tien, h] of [[0.5, xa], [0.5, -xa], [0, xa], [0, -xa], [-0.6, 0], [-0.4, xa]]) {
      g = dat(sT + v * tien, a.ne + h * ne);
      if (!vuong(a, a.x, a.z, g, xT, zT, gT)) { a.ne += h * ne; a.sp = Math.max(0, a.sp * tien); ok = true; break; }
    }
    if (!ok) { a.sp = 0; g = dat(sT, a.ne); if (vuong(a, a.x, a.z, g, xT, zT, gT)) { a.s = sT; a.k = kT; a.x = xT; a.z = zT; g = gT; } }
  }
  a.trenDuong = trenDuong;
  a.choAi = a.sp < 0.2 && chanBo ? chanBo : null; // người bị xe chắn → xe đó mượn quyền người, dọn lối
  a.y = trenDuong ? 0 : 0.15;
  a.goc = g;
  a.buoc += a.sp * dt * 5.5;
}

// ───────────────────────── nghịch: nhấc đặt bừa, đẩy ngã ─────────────────────────
// Nhấc một xe / người lên trời rồi thả xuống một chỗ trống bất kỳ trên một đường đi mới; thả xong đi tiếp từ đó.
// Chỗ thả: thân xe đặt xuống không đè lên ai (so cả hình chữ nhật, không chỉ khoảng cách tâm).
function timDich(a) {
  for (let t = 0; t < 40; t++) {
    const r = a.loai === 'bo' ? duongBo() : duongXe(a.loai);
    const tam = { k: 0, s: rnd(8, r.p.len - 30) };
    mau(r.p, tam);
    const goc = Math.atan2(-tam.fz, tam.fx);
    if (choTrong(tam.px, tam.pz, goc, a.len, a.wid, a.loai === 'bo' ? 0.6 : 1.4, a.loai === 'bo')) return { ...r, s: tam.s, x: tam.px, z: tam.pz, goc };
  }
  return null;
}
function nhac(a) {
  if (a.nhac || a.nga) return;
  const dich = timDich(a);
  if (!dich) return;
  a.nhac = { t: 0, x0: a.x, z0: a.z, y0: a.y, g0: a.goc, d: dich };
  CAI.nghich++;
}
const CAO = 8;
function bay(a, dt) {
  const n = a.nhac;
  // sắp hạ xuống mà chỗ thả đã có xe khác chạy vào → bay tiếp sang chỗ khác, không rơi đè lên ai
  if (n.t < 0.72 && n.t + dt / 2 >= 0.72 && !choTrong(n.d.x, n.d.z, n.d.goc, a.len, a.wid, a.loai === 'bo' ? 0.3 : 0.8, a.loai === 'bo')) {
    const d2 = timDich(a);
    if (d2) { n.x0 = a.x; n.z0 = a.z; n.g0 = a.goc; n.y0 = a.y; n.d = d2; n.t = 0.25; }
  }
  const D = n.d;
  n.t += dt / 2;
  const t = Math.min(1, n.t);
  let dg = D.goc - n.g0; dg = Math.atan2(Math.sin(dg), Math.cos(dg)) + 2 * Math.PI; // xoay một vòng trên không
  if (t < 0.25) { const u = t / 0.25; a.y = n.y0 + (CAO - n.y0) * (1 - (1 - u) * (1 - u)); }
  else if (t < 0.72) {
    const u = (t - 0.25) / 0.47, e = u * u * (3 - 2 * u);
    a.x = n.x0 + (D.x - n.x0) * e; a.z = n.z0 + (D.z - n.z0) * e; a.y = CAO + Math.sin(u * Math.PI) * 3; a.goc = n.g0 + dg * e;
  } else { const u = (t - 0.72) / 0.28; a.x = D.x; a.z = D.z; a.goc = D.goc; a.y = CAO * (1 - u * u); }
  if (n.t < 1) return;
  // chạm đất: lấy đường mới, đứng yên rồi tự đi tiếp
  a.nhac = null; a.p = D.p; a.s = D.s; a.k = 0; a.dlat = 0; a.lv = 0; a.sp = 0; a.y = 0; a.ket = 0; a.lui = 0;
  if (a.loai !== 'bo') { a.g = D.arm.g; a.arm = ARMS.indexOf(D.arm); a.quay = D.quay; a.camKet = D.s + a.len / 2 >= D.p.sStop; a.sDon = -1; if (a.dangDon) a.dangDon = false; a.nghieng = 0; }
  mau(a.p, a);
  a.x = a.px; a.z = a.pz; a.goc = D.goc;
  if ((a.loai === 'xm' || a.loai === 'bo') && Math.random() < 0.5) dayNga(a); // rơi từ trên cao xuống: một nửa số lần ngã luôn
}
// Đẩy ngã: đổ nghiêng xuống đường, nằm một lúc (xe khác phải đứng chờ / lách qua), rồi tự dựng dậy đi tiếp.
function dayNga(a) {
  if (a.nhac || a.nga) return;
  a.nga = { t: 0, h: Math.random() < 0.5 ? 1 : -1, nam: a.loai === 'bo' ? rnd(3, 5) : a.loai === 'xm' ? rnd(5, 8) : rnd(8, 11) };
  a.sp = 0; a.lv = 0;
  CAI.nghich++;
}
function nam(a, dt) {
  const n = a.nga;
  n.t += dt;
  const MAX = a.loai === 'xm' ? 1.42 : a.loai === 'bo' ? 1.5 : Math.PI / 2, T0 = 0.5, T1 = T0 + n.nam, T2 = T1 + 1.2;
  let r;
  if (n.t < T0) r = MAX * (n.t / T0) ** 2; // đổ xuống, nhanh dần
  else if (n.t < T1) r = MAX - (n.t < T0 + 0.25 ? Math.sin(((n.t - T0) / 0.25) * Math.PI) * 0.1 : 0); // chạm đất nẩy nhẹ
  else if (n.t < T2) { const u = (n.t - T1) / 1.2; r = MAX * (1 - u * u * (3 - 2 * u)); } // dựng dậy
  else { a.nga = null; a.lac = 0; if (a.loai === 'xm') a.nghieng = 0; return false; }
  a.lac = r * n.h;
  if (a.loai === 'xm') a.nghieng = a.lac;
  a.sp = 0;
  return true;
}

// Khung nhìn của máy quay — bớt xe khi giảm mật độ thì bớt chiếc ngoài khung trước, người xem không thấy xe biến mất
const KHUNG = new THREE.Frustum(), MK = new THREE.Matrix4(), VK = new THREE.Vector3();
let daCoKhung = false;
const ngoaiKhung = (a) => !daCoKhung || !KHUNG.containsPoint(VK.set(a.x, 1, a.z));
function buoc(dt) {
  tg += dt;
  dungLuoi();
  moi = [];
  ketNga = 0;
  trongNgaG[0] = trongNgaG[1] = 0;
  DEN.cau.fill(0);
  for (const a of DS) {
    if (a.loai === 'bo' || a.nhac) continue;
    if (a.trongNga) { trongNgaG[a.g]++; if (a.sp < 0.3) ketNga++; }
    else if (!a.camKet) { const t = a.p.sStop - a.s - a.len / 2; if (t > -1 && t < 30) DEN.cau[a.arm * 3 + QI[a.quay]]++; } // xe đang tới vạch — đèn AI đếm
  }
  buocDen(dt);
  tinhQuyen(dt);
  for (let i = 0; i < DS.length; i++) { const a = DS[i]; if (a.loai === 'bo') buocBo(a, dt); else buocXe(a, dt); }
  const muc = { xm: CAI.matDo, oto: Math.min(MAX_OTO, Math.round(CAI.matDo * CAI.tyLeOto / 100)), bus: 3, bo: Math.round(60 + CAI.matDo / 10) };
  const dem = { xm: 0, oto: 0, bus: 0, bo: 0 };
  for (const a of DS) dem[a.loai]++;
  // Giảm mật độ / tỷ lệ ô tô → bớt ngay xe ở rìa bản đồ (xa máy quay, trong sương), không đợi chúng đi hết
  const du = { xm: dem.xm - muc.xm, oto: dem.oto - muc.oto };
  if (du.xm > 0 || du.oto > 0) for (const a of DS) if (du[a.loai] > 0 && (a.s < 30 || a.s > a.p.len - 30 || ngoaiKhung(a) || camera.position.distanceTo(VK.set(a.x, 1, a.z)) > 70) && a !== theoXe && !a.nhac && !a.nga) { a.s = a.p.len; du[a.loai]--; dem[a.loai]--; }
  for (let i = DS.length - 1; i >= 0; i--) if (DS[i].s >= DS[i].p.len - 0.5) { DS[i].het = true; DS[i] = DS[DS.length - 1]; DS.pop(); }
  dungLuoi(); // xe vừa đi / vừa bị bớt làm lệch chỉ số lưới — dựng lại để chỗ sinh xe kiểm đúng thân từng xe
  for (let t = 0; t < 4 && dem.xm < muc.xm; t++) if (sinhXe('xm')) dem.xm++;
  if (dem.oto < muc.oto) sinhXe('oto');
  if (dem.bus < muc.bus && Math.random() < 0.02) sinhXe('bus');
  if (dem.bo < muc.bo && Math.random() < 0.3) sinhBo();
  return dem;
}

// ───────────────────────── cảnh 3D ─────────────────────────
const cv = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !DD, powerPreference: DD ? 'low-power' : 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, DD ? 1.25 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Bóng đổ chỉ tính MỘT lần cho nhà, cây, cột (đứng yên). Xe và người dùng bóng dán sát đất (BONG bên dưới): rẻ hơn hẳn,
// và bóng sát bánh xe nhìn mới thấy xe chạm đất — bóng từ bản đồ bóng lệch + nhoè khiến xe trông như bay (anh 21/11/2026).
renderer.shadowMap.autoUpdate = false;
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
sun.shadow.mapSize.set(DD ? 1024 : 2048, DD ? 1024 : 2048);
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
const vanh = (r, w, x, y, z) => new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.02, 10).rotateX(Math.PI / 2).translate(x, y, z);
const TRANG = '#ffffff', DEN_B = '#151515';

const geoXm = ghep([
  // dáng xe tay ga: sàn để chân thấp giữa hai bánh + thân sau + yếm trước — thân không còn lơ lửng ngang trục bánh
  [box(0.62, 0.1, 0.3).translate(0.02, 0.27, 0), '#2a2a2a'],
  [box(0.72, 0.4, 0.36).translate(-0.3, 0.5, 0), TRANG],
  [box(0.16, 0.6, 0.36).translate(0.4, 0.55, 0), TRANG],
  [box(0.06, 0.3, 0.08).translate(0.6, 0.42, 0), '#555555'],
  [box(0.6, 0.12, 0.3).translate(-0.2, 0.8, 0), '#202020'],
  [banh(0.29, 0.14, 0.62, 0.29, 0), DEN_B], [banh(0.29, 0.14, -0.6, 0.29, 0), DEN_B],
  [vanh(0.29, 0.14, 0.62, 0.29, 0), '#9a9ea4'], [vanh(0.29, 0.14, -0.6, 0.29, 0), '#9a9ea4'],
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
const MAX_OTO = 400;
const geoMui = ghep([[box(0.62, 0.22, 0.42).translate(-0.3, 1.68, 0), TRANG], [box(0.64, 0.08, 0.44).translate(-0.3, 1.6, 0), '#222222']]); // hộp đèn TAXI trên nóc
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
  m.count = 0; m.castShadow = false; m.frustumCulled = false;
  m.setColorAt(0, new THREE.Color());
  scene.add(m);
  return m;
}
const MAX_XM = 1200;
const mXm = inst(geoXm, vatLieuMau, MAX_XM), mNguoi = inst(geoNguoi, vatLieuMau, MAX_XM), mMu = inst(geoMu, vatLieu, MAX_XM);
const mCho = inst(geoCho, vatLieuMau, MAX_XM), mHang = inst(geoHang, vatLieu, MAX_XM);
const mOto = inst(geoOto, vatLieuMau, MAX_OTO), mMui = inst(geoMui, vatLieuMau, MAX_OTO), mBus = inst(geoBus, vatLieuMau, 16);
const mBo = inst(geoBo, vatLieuMau, 400), mDau = inst(geoDau, vatLieu, 400), mNon = inst(geoNon, vatLieu, 400);
const NON_MAU = new THREE.Color('#e8d7a6');
// Đèn xi nhan (anh 22/11/2026): xe sắp rẽ nháy cam ở góc trước + góc sau phía rẽ, từ ~35 m trước lòng ngã tư tới lúc ra
const mXn = (() => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffa31a' }), 2 * (MAX_XM + MAX_OTO + 16)); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; scene.add(m); return m; })();
// [dọc trước, dọc sau, ngang, cao, cỡ] theo loại xe — toạ độ thân xe: +dọc = mũi, +ngang = bên phải
const XN = { xm: [0.78, -0.92, 0.2, 0.95, 0.16], oto: [2.12, -2.12, 0.8, 0.78, 0.2], bus: [5.22, -5.22, 1.18, 1.25, 0.28] };
function xiNhan(a) {
  if (a.quay === 'thang' || a.nhac || a.nga || a.lac) return 0;
  const p = a.p;
  if (p.ve ? a.s > p.sNoi - 6 : (a.s < p.sIn - 35 || a.s > p.sOut + 2)) return 0;
  if (((tg * 1.6 + a.id * 0.37) % 1) > 0.5) return 0; // nháy ~1,6 lần/giây, mỗi xe lệch nhịp nhau
  return a.quay === 'phai' ? 1 : -1;
}
const mBong = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.6, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, MAX_XM + 900);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.renderOrder = 1;
  scene.add(m); return m;
})();
const SB = new THREE.Vector3();
const MUI_TAXI = new THREE.Color('#ffd84a'), DEN_DON = new THREE.Color('#ff5a2a');

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
  const ai = ARMS.indexOf(arm);
  const dsDau = [[-(hw - 1.5), 5.5, ai * 3 + QI.trai], [-0.35, 3.3, ai * 3 + QI.thang]];
  for (const [lx, ly, mv] of dsDau) {
    const den3 = {};
    for (const k of ['d', 'v', 'x']) den3[k] = new THREE.MeshBasicMaterial({ color: MAU_DEN[k][1] });
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
    DEN_ARM.push({ mv, den3, c, tex, m: '', n: '' });
  }
}
// đèn rẽ trái riêng thì đồng hồ của đầu đèn rẽ trái có mũi tên; đèn AI không biết trước còn bao lâu → không hiện số khi xanh
function veSo(c, m, n, trai) {
  const x = c.getContext('2d');
  x.fillStyle = '#060606'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = MAU_DEN[m][0];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (trai) { x.font = 'bold 40px sans-serif'; x.fillText('◀', 22, 34); }
  x.font = (trai ? 'bold 44px' : 'bold 52px') + ' "Courier New", monospace';
  x.fillText(n, trai ? 82 : 64, 35);
}
function capNhatDen() {
  const trai = CAI.kieuPha === 'trai';
  for (const a of DEN_ARM) {
    const [m, con] = den(a.mv);
    const n = con > 98 || (CAI.denAI && m === 'x') ? '--' : String(Math.min(99, Math.ceil(con))).padStart(2, '0');
    const t = trai && a.mv % 3 === QI.trai;
    if (m !== a.m) { for (const k of ['d', 'v', 'x']) a.den3[k].color.set(MAU_DEN[k][k === m ? 0 : 1]); a.m = m; a.n = ''; }
    if (n + t !== a.n) { veSo(a.c, m, n, t); a.tex.needsUpdate = true; a.n = n + t; }
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
const veXm = [], veOto = [], veBus = [], veBo = [];
function datMa(m, i, pos, q, s, c) { M4.compose(pos, q, s); m.setMatrixAt(i, M4); if (c) m.setColorAt(i, c); }
function ve() {
  let ix = 0, io = 0, ib = 0, ip = 0, is = 0, iq = 0;
  veXm.length = 0; veOto.length = 0; veBus.length = 0; veBo.length = 0;
  for (const a of DS) {
    if (is < MAX_XM + 900) { Q.setFromAxisAngle(UP, a.goc); V.set(a.x, a.nhac ? 0.03 : a.y + 0.03, a.z); datMa(mBong, is++, V, Q, a.loai === 'bo' ? SB.set(0.75, 1, 0.75) : SB.set(a.len * 1.15, 1, a.wid * 1.7)); }
    if (a.loai === 'bo') {
      Q.setFromAxisAngle(UP, a.goc);
      V.set(a.x, a.y + Math.abs(Math.sin(a.buoc)) * 0.04, a.z);
      if (a.lac) { Q.multiply(Q2.setFromAxisAngle(TRUC_X, a.lac)); V.y += 0.12 * Math.abs(Math.sin(a.lac)); }
      veBo[ip] = a;
      datMa(mBo, ip, V, Q, MOT, a.c2); datMa(mDau, ip, V, Q, MOT, a.c3); datMa(mNon, ip, V, Q, a.non ? MOT : KHONG, NON_MAU);
      ip++; continue;
    }
    const ben = xiNhan(a);
    if (ben) {
      const [d1, d2, ng, cao, co] = XN[a.loai], fx = Math.cos(a.goc), fz = -Math.sin(a.goc), rx = -fz, rz = fx;
      Q.setFromAxisAngle(UP, a.goc); SB.set(co, co * 0.8, co);
      for (const d of [d1, d2]) { V.set(a.x + fx * d + rx * ng * ben, a.y + cao, a.z + fz * d + rz * ng * ben); datMa(mXn, iq++, V, Q, SB); }
    }
    Q.setFromAxisAngle(UP, a.goc);
    V.set(a.x, a.y + (a.lac ? (a.wid / 2) * Math.abs(Math.sin(a.lac)) : 0), a.z); // nằm nghiêng: nhấc thân lên để không chìm xuống mặt đường
    if (a.loai !== 'xm' && a.lac) Q.multiply(Q2.setFromAxisAngle(TRUC_X, a.lac));
    if (a.loai === 'xm') {
      if (ix >= MAX_XM) continue;
      Q2.setFromAxisAngle(TRUC_X, a.nghieng); Q.multiply(Q2);
      datMa(mXm, ix, V, Q, MOT, a.c1); datMa(mNguoi, ix, V, Q, MOT, a.c2); datMa(mMu, ix, V, Q, MOT, a.c3);
      datMa(mCho, ix, V, Q, a.cho ? MOT : KHONG, a.c4); datMa(mHang, ix, V, Q, a.hang ? MOT : KHONG, a.c5);
      veXm[ix] = a; ix++;
    } else if (a.loai === 'oto') { veOto[io] = a; datMa(mMui, io, V, Q, a.taxi ? MOT : KHONG, a.dangDon ? DEN_DON : MUI_TAXI); datMa(mOto, io++, V, Q, MOT, a.c1); }
    else { veBus[ib] = a; datMa(mBus, ib++, V, Q, MOT, a.c1); }
  }
  for (const [m, n] of [[mXm, ix], [mNguoi, ix], [mMu, ix], [mCho, ix], [mHang, ix], [mOto, io], [mMui, io], [mBus, ib], [mBo, ip], [mDau, ip], [mNon, ip], [mBong, is], [mXn, iq]]) {
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
  if (k === 'theo') { if (!theoXe || theoXe.het) theoXe = chonXeTheo(); return; }
  theoXe = null;
  camera.position.set(...CAM[k][0]); controls.target.set(...CAM[k][1]); controls.update();
}
function chonXeTheo() {
  const ds = DS.filter((a) => a.loai === 'xm' && a.s < 60);
  return ds.length ? chon(ds) : DS.find((a) => a.loai === 'xm') || null;
}
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => datCam(b.dataset.cam)));
// Đang đi theo xe mà người xem kéo xoay / lăn phóng → thả xe ra, máy quay tự do đúng chỗ đang đứng. Esc → về toàn cảnh.
controls.addEventListener('change', () => {
  if (cam !== 'theo') return;
  cam = 'tu'; theoXe = null;
  document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('on'));
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && cam === 'theo') datCam('tong'); });
const $ = (id) => document.getElementById(id);
const chuToc = () => 'Tốc độ ' + String(CAI.toc).replace('.', ',') + '×';
function hienTuyChon() {
  $('md').value = CAI.matDo; $('vMd').textContent = CAI.matDo;
  $('lieu').value = Math.round(CAI.lieu * 100); $('vLieu').textContent = Math.round(CAI.lieu * 100) + '%';
  $('oto').value = CAI.tyLeOto; $('vOto').textContent = CAI.tyLeOto + '%';
  $('rp').checked = CAI.rePhai; $('cn').checked = CAI.choNga; $('nl').checked = CAI.nhuongLoi; $('toc').textContent = chuToc();
  $('ct').value = CAI.choThoat; $('vCt').textContent = CAI.choThoat + ' s';
  $('kp').value = CAI.kieuPha; $('ai').checked = CAI.denAI; $('px').checked = CAI.phaiXanh;
}
dungPha();
hienTuyChon();
$('ct').addEventListener('input', (e) => { CAI.choThoat = +e.target.value; $('vCt').textContent = CAI.choThoat + ' s'; luuTuyChon(); });
$('kp').addEventListener('change', (e) => { CAI.kieuPha = e.target.value; dungPha(); luuTuyChon(); });
$('ai').addEventListener('change', (e) => { CAI.denAI = e.target.checked; luuTuyChon(); });
$('px').addEventListener('change', (e) => { CAI.phaiXanh = e.target.checked; luuTuyChon(); });
$('md').addEventListener('input', (e) => { CAI.matDo = +e.target.value; $('vMd').textContent = CAI.matDo; luuTuyChon(); });
$('lieu').addEventListener('input', (e) => { CAI.lieu = +e.target.value / 100; $('vLieu').textContent = e.target.value + '%'; luuTuyChon(); });
$('oto').addEventListener('input', (e) => { CAI.tyLeOto = +e.target.value; $('vOto').textContent = CAI.tyLeOto + '%'; luuTuyChon(); });
$('rp').addEventListener('change', (e) => { CAI.rePhai = e.target.checked; luuTuyChon(); });
$('cn').addEventListener('change', (e) => { CAI.choNga = e.target.checked; luuTuyChon(); });
$('nl').addEventListener('change', (e) => { CAI.nhuongLoi = e.target.checked; luuTuyChon(); });
$('macdinh').addEventListener('click', () => {
  const doiPha = CAI.kieuPha !== MAC_DINH.kieuPha;
  Object.assign(CAI, MAC_DINH);
  try { localStorage.removeItem(KHOA_LUU); } catch {}
  if (doiPha) dungPha();
  hienTuyChon();
});
// Ngăn đang mở (⚙ trên điện thoại + các mục gập) nằm trên URL ?mo=… để F5 vẫn y nguyên.
const NGAN = new Set((new URLSearchParams(location.search).get('mo') || '').split(',').filter(Boolean));
const ghiNgan = () => { const u = new URL(location.href); if (NGAN.size) u.searchParams.set('mo', [...NGAN].join(',')); else u.searchParams.delete('mo'); history.replaceState(null, '', u); };
const ben = document.querySelector('.ben');
ben.classList.toggle('mo-ra', NGAN.has('ben'));
$('mo').addEventListener('click', () => { const m = ben.classList.toggle('mo-ra'); m ? NGAN.add('ben') : NGAN.delete('ben'); ghiNgan(); });
for (const d of document.querySelectorAll('details[data-ngan]')) {
  d.open = NGAN.has(d.dataset.ngan) && ![...document.querySelectorAll('details[open]')].length;
  // name="ngan": mở mục này thì mục kia tự gập (một lúc một mục) để bảng vừa một màn hình.
  d.addEventListener('toggle', () => { d.open ? NGAN.add(d.dataset.ngan) : NGAN.delete(d.dataset.ngan); ghiNgan(); });
}
$('dung').addEventListener('click', (e) => { CAI.dung = !CAI.dung; e.target.textContent = CAI.dung ? 'Chạy tiếp' : 'Tạm dừng'; });
$('toc').addEventListener('click', (e) => { CAI.toc = CAI.toc === 1 ? 2 : CAI.toc === 2 ? 4 : CAI.toc === 4 ? 0.5 : 1; e.target.textContent = chuToc(); luuTuyChon(); });

// bấm vào một xe máy → máy quay đi theo xe đó
const ray = new THREE.Raycaster(), chuot = new THREE.Vector2();
let xuong = null;
const BANG_XE = () => new Map([[mXm, veXm], [mNguoi, veXm], [mOto, veOto], [mBus, veBus], [mBo, veBo], [mDau, veBo]]);
function chonXe(e) {
  chuot.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const BANG = BANG_XE();
  for (const m of BANG.keys()) m.computeBoundingSphere();
  const hit = ray.intersectObjects([...BANG.keys()], false)[0];
  return hit && BANG.get(hit.object)[hit.instanceId];
}
// ── Vẽ đường riêng cho một xe (anh 22/11/2026): chế độ "Vẽ đường", bấm giữ vào xe rồi kéo → xe chạy theo nét ──
const MAT_DAT = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), DIEM3 = new THREE.Vector3();
const VAT_NET = new THREE.LineBasicMaterial({ color: '#ff2d2d', depthTest: false, transparent: true, opacity: 0.95 });
let ve1 = null; // nét đang vẽ: { a, diem, line }
const NET = new Map(); // xe → đường đỏ của nó, giữ tới khi xe nhập làn xong
function diemDat(e) {
  chuot.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  return ray.ray.intersectPlane(MAT_DAT, DIEM3) ? [DIEM3.x, DIEM3.z] : null;
}
function lineTu(pts) {
  const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0.25, z)));
  const l = new THREE.Line(g, VAT_NET); l.renderOrder = 9; l.frustumCulled = false; scene.add(l); return l;
}
function boNet(a) { const l = NET.get(a); if (l) { scene.remove(l); l.geometry.dispose(); NET.delete(a); } }
function capNhatNet() {
  for (const [a, l] of NET) {
    if (a.het || !a.p.ve || a.p !== l.userData.p || a.nhac || a.s > a.p.sNoi) { boNet(a); continue; }
    l.geometry.setDrawRange(a.k, Math.max(0, l.userData.n - a.k)); // phần đã đi qua thì xoá dần
  }
}
cv.addEventListener('pointerdown', (e) => {
  if (cong !== 've' || e.button > 0) return;
  const a = chonXe(e);
  if (!a || a.loai === 'bo' || a.nhac) return; // bấm ra chỗ trống → vẫn xoay máy quay như thường
  e.stopImmediatePropagation(); e.preventDefault();
  xuong = null;
  cv.setPointerCapture(e.pointerId);
  boNet(a);
  a.dangVe = true;
  ve1 = { a, diem: [], line: null, id: e.pointerId };
}, { capture: true });
cv.addEventListener('pointermove', (e) => {
  if (!ve1 || e.pointerId !== ve1.id) return;
  const P = diemDat(e);
  if (!P) return;
  const D = ve1.diem, truoc = D.length ? D[D.length - 1] : [ve1.a.x, ve1.a.z];
  if (Math.hypot(P[0] - truoc[0], P[1] - truoc[1]) < 1) return;
  if (Math.abs(P[0]) > L - 10 || Math.abs(P[1]) > L - 10) return;
  D.push(P);
  if (ve1.line) { scene.remove(ve1.line); ve1.line.geometry.dispose(); }
  ve1.line = lineTu([[ve1.a.x, ve1.a.z], ...D]);
});
function xongVe(e) {
  if (!ve1 || e.pointerId !== ve1.id) return;
  const { a, diem, line } = ve1;
  ve1 = null;
  if (line) { scene.remove(line); line.geometry.dispose(); }
  a.dangVe = false;
  let dai = 0, t = [a.x, a.z];
  for (const P of diem) { dai += Math.hypot(P[0] - t[0], P[1] - t[1]); t = P; }
  if (dai < 3 || a.het || a.nhac) return; // chạm nhẹ, chưa kéo → giữ đường cũ
  const p = giaoDuongVe(a, diem);
  let n = 0; while (n < p.x.length && p.s[n] <= p.sNoi + 10) n++; // nét đỏ dừng ngay sau chỗ nhập làn, không kéo tới rìa bản đồ
  const l = lineTu(Array.from({ length: n }, (_, i) => [p.x[i], p.z[i]]));
  l.userData = { p, n };
  NET.set(a, l);
  CAI.ve = (CAI.ve || 0) + 1;
}
cv.addEventListener('pointerup', xongVe);
cv.addEventListener('pointercancel', xongVe);
cv.addEventListener('pointerdown', (e) => (xuong = [e.clientX, e.clientY]));
cv.addEventListener('pointerup', (e) => {
  if (!xuong || Math.hypot(e.clientX - xuong[0], e.clientY - xuong[1]) > 6) return;
  const a = chonXe(e);
  if (!a) return;
  if (cong === 'nhac') nhac(a);
  else if (cong === 'nga') dayNga(a);
  else if (cong === 'theo') { theoXe = a; datCam('theo'); theoXe = a; }
});
let cong = 'nhac'; // 'theo' (đi theo xe) tạm bỏ khỏi giao diện 21/11/2026, mã giữ để bật lại
document.querySelectorAll('[data-cong]').forEach((b) => b.addEventListener('click', () => {
  cong = b.dataset.cong;
  document.querySelectorAll('[data-cong]').forEach((c) => c.classList.toggle('on', c === b));
}));

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
  const chip = (p) => {
    const [m, con] = den(p.mv[0]);
    const so = CAI.denAI && m === 'x' ? '' : ' ' + Math.min(99, Math.ceil(con)) + ' s';
    return `<span class="den ${m}"><i></i>${p.ten} <b>${TEN_DEN[m]}${so}</b></span>`;
  };
  $('den').innerHTML = DEN.pha.map(chip).join('') + (CAI.denAI ? '<span class="den ai">AI</span>' : '');
  let cho = 0, leo = 0, taxi = 0, don = 0;
  for (const a of DS) { if (a.loai === 'xm') { if (a.choDen && a.sp < 0.5) cho++; if (a.y > 0) leo++; } else if (a.taxi) { taxi++; if (a.dangDon) don++; } }
  $('so').innerHTML = `<div><b>${cho}</b> xe chờ đèn</div><div><b>${CAI.vuot}</b> lượt vượt đỏ</div>`;
  if ($('soThem').closest('details').open) $('soThem').innerHTML = `<div><b>${demCu.xm}</b> xe máy</div><div><b>${demCu.oto}</b> ô tô (${taxi} taxi)</div><div><b>${demCu.bus}</b> xe buýt</div><div><b>${demCu.bo}</b> người đi bộ</div>`
    + `<div><b>${leo}</b> xe leo lề</div><div><b>${don}</b> taxi tấp lề đón khách</div><div><b>${CAI.nghich}</b> lượt bị nghịch</div>`;
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
  renderer.shadowMap.needsUpdate = true;
  let truoc = performance.now(), boQua = false;
  renderer.setAnimationLoop(() => {
    if (DD && (boQua = !boQua)) return; // điện thoại: vẽ 30 khung/giây thay vì 60 — đủ mượt, máy mát hơn nhiều
    const bay = performance.now();
    const dtThuc = Math.min(0.1, (bay - truoc) / 1000);
    truoc = bay;
    if (!CAI.dung) {
      let con = dtThuc * CAI.toc;
      while (con > 1e-4) { const d = Math.min(con, 1 / 30); demCu = buoc(d); con -= d; }
    }
    capNhatDen();
    capNhatNet();
    ve();
    if (cam === 'theo') capNhatCamTheo(dtThuc); else controls.update();
    hudT -= dtThuc; if (hudT <= 0) { hud(); hudT = 0.25; }
    KHUNG.setFromProjectionMatrix(MK.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); daCoKhung = true;
    renderer.render(scene, camera);
  });
}
requestAnimationFrame(() => setTimeout(khoiDong, 30));
