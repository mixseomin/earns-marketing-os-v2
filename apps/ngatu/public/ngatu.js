// ngatu.js — Ngã tư (ngatu.on.tc): mô phỏng một ngã tư Việt Nam giờ tan tầm trên three.js. Anh 21/11/2026 "Thử đi. Chọn 1 sub mới".
// Bước 1 của lộ trình: một ngã tư, vài trăm xe máy chảy như dòng nước (lách khe, dồn cục ở vạch dừng, leo lề, rẽ phải khi đỏ,
// vượt đèn), ô tô + xe buýt theo làn, đèn có đồng hồ đếm ngược, người đi bộ băng qua kiểu "cứ đi đều, xe sẽ tránh".
// tra-repo-ok: đã tra GitHub (movsim/traffic-simulation-de GPL-3.0 — mô hình theo làn, không có dòng xe máy bầy đàn) nên tự viết lớp giả lập
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { taoMua } from './mua.js?v=1';

// ───────────────────────── hình học đường ─────────────────────────
// Trục x = Đông, trục z = Nam. Đường Đông–Tây rộng 2×10 m, Bắc–Nam 2×8 m, vỉa hè 4 m. Xe đi bên phải.
// Ngã tư thật (bước 2, anh 22/11/2026 "Tìm ngã tư ở Hà Nội"): ?nga=ba-trieu = Bà Triệu × Trần Hưng Đạo (OSM node 21.02156, 105.85028).
// Trần Hưng Đạo hai chiều 4 làn (2 mỗi chiều) chạy Đông–Tây; Bà Triệu một chiều Bắc → Nam 4 làn. Mặt đường đo OSM ≈ 13 m mỗi đường
// (lệch vuông góc ~2° bỏ qua). Dữ liệu gốc: apps/ngatu/du-lieu-osm/.
const NGA_THAT = {
  'ba-trieu': {
    ten: 'Bà Triệu × Trần Hưng Đạo', hwEW: 6.5, hwNS: 6.5, nhom: ['Trần Hưng Đạo', 'Bà Triệu'],
    nhanh: [{ ten: 'Trần Hưng Đạo (Tây)', w: 0.32 }, { ten: 'Trần Hưng Đạo (Đông)', w: 0.32 }, { ten: 'Bà Triệu (Bắc)', w: 0.36, mot: 'vao' }, { ten: 'Bà Triệu (Nam)', w: 0, mot: 'ra' }],
    lan: [{ soLan: 2, lan: ['tudo', 'tudo'], vach: 'dut', dai: 30 }, { soLan: 2, lan: ['tudo', 'tudo'], vach: 'dut', dai: 30 },
      { soLan: 4, lan: ['trai-thang', 'thang', 'thang', 'thang-phai'], vach: 'dut', dai: 30 }, { soLan: 2, lan: ['tudo', 'tudo'], vach: 'dut', dai: 30 }],
    // biển tên phố ở bốn góc + biển hiệu cơ sở thật quanh ngã tư (OSM, du-lieu-osm/ba-trieu-poi.json): [mét Đông, mét Bắc, chữ, màu nền]
    // toạ độ thật xoay −19° để Trần Hưng Đạo nằm trên trục x như cảnh
    xoay: 19, pho: ['TRẦN HƯNG ĐẠO', 'BÀ TRIỆU'], phuong: 'P. Hàng Bài',
    co: [[46.2, 23.4, 'THƯ VIỆN HÀ NỘI · 54E', '#7a1f1f'], [24.6, 13.8, 'VIETNAM SPECIALITY COFFEE', '#3b2a1e'], [-19.4, 28.6, 'NHÀ HÀNG BODHI', '#2f5d3a'],
      [7.1, 88.2, 'THE COFFEE HOUSE · 56 BÀ TRIỆU', '#e07a1f'], [15.3, 58.7, '56B BÀ TRIỆU', '#1f4e8c'], [6.9, 44.3, '58B BÀ TRIỆU', '#1f4e8c'],
      [-45.0, 51.6, 'MAISON MAROU', '#b3262d'], [-101.0, 11.6, 'MAISON SEN', '#6a3d7a'], [-90.7, 6.6, 'GPCARE · 65B TRẦN HƯNG ĐẠO', '#0f7a5a'],
      [-45.7, -35.0, 'TRUNG ƯƠNG ĐOÀN TNCS HỒ CHÍ MINH · 62', '#a3171d'], [-54.4, -127.9, 'XE ĐẠP KHÁNH HIỆP · 53 BÀ TRIỆU', '#c9341b'],
      [-56.2, -152.8, 'TECHCOMBANK', '#d81f26'], [56.5, -85.6, 'ĐẠI SỨ QUÁN PHÁP · 57', '#20376f'], [-103.7, 61.3, 'ĐẠI SỨ QUÁN ẤN ĐỘ · 58-60', '#c46a12'],
      [66.8, 90.2, 'ĐÀI TIẾNG NÓI VIỆT NAM · 37 BÀ TRIỆU', '#1d4f91'], [130.8, -90.0, 'LIÊN HIỆP HỘI VHNT VN · 51', '#5a4632']],
  },
};
// Hành lang nhiều ngã tư (bước 3 nhịp 2, 23/11/2026): ?hl=ba-trieu = 4 nút dọc Bà Triệu một chiều Bắc → Nam
// (du-lieu-osm/ba-trieu-hanh-lang.json). Mỗi nút một bộ đèn riêng lệch pha; xe chạy đường dài xuyên nhiều nút, mang
// danh sách mốc theo nút (p.moc) — qua nút này thì nạp mốc nút kế (napMoc). Engine xe vẫn là một, chỉ đổi ngữ cảnh nút (vaoNut).
const HL_K = new URLSearchParams(location.search).get('hl');
const HL = HL_K === 'ba-trieu' ? {
  // z = mét về phía Nam, khoảng cách thật giữa các nút 196 / 327 / 195 m; lệch x bỏ qua
  z: [-347, -161, 152, 347], ten: ['LÝ THƯỜNG KIỆT', 'TRẦN HƯNG ĐẠO', 'NGUYỄN DU', 'TRẦN NHÂN TÔNG'], lan: [4, 4, 2, 2], thd: 1,
} : null;
const NGA_K = new URLSearchParams(location.search).get('nga'), NGA = NGA_THAT[NGA_K] || (HL ? NGA_THAT['ba-trieu'] : null);
let L = 165, HW_EW = NGA ? NGA.hwEW : 10, HW_NS = NGA ? NGA.hwNS : 8;
const SW = 4, CW = 4;
const right = (d) => [-d[1], d[0]];
const neg = (d) => [-d[0], -d[1]];
// Đồ thị nút giao (bước 1 kế hoạch "ngã tư thật → thành phố", 22/11/2026): mỗi nhánh tự mang hình học của nó
// (hướng vào d, nửa mặt đường hw, nửa lòng ngã tư e đo dọc nhánh) thay vì suy từ trục x/z. Nút giao thật từ OSM
// sau này chỉ cần thay mảng NUT.nhanh; mọi chỗ đọc độ rộng đi qua hwAlong / eAlong.
const NUT = {
  id: 'n0', x: 0, z: 0,
  nhanh: [
    { ten: 'Tây', d: [1, 0], g: 0, w: 0.3, hw: HW_EW, e: HW_NS },
    { ten: 'Đông', d: [-1, 0], g: 0, w: 0.3, hw: HW_EW, e: HW_NS },
    { ten: 'Bắc', d: [0, 1], g: 1, w: 0.2, hw: HW_NS, e: HW_EW },
    { ten: 'Nam', d: [0, -1], g: 1, w: 0.2, hw: HW_NS, e: HW_EW },
  ],
};
if (NGA) NUT.nhanh.forEach((A, i) => Object.assign(A, NGA.nhanh[i]));
let ARMS = NUT.nhanh;
// ngữ cảnh nút: ARMS / DEN / ketNga / trongNgaG / NZ là của nút đang xét; vaoNut(i) đổi sang nút i (chế độ một nút: không làm gì)
let NUTS = null, NI = 0, NZ = 0;
function vaoNut(i) {
  if (!NUTS || i === NI) return;
  NUTS[NI].ket = ketNga; NI = i;
  const n = NUTS[i]; ARMS = n.nhanh; DEN = n.den; trongNgaG = n.tng; ketNga = n.ket; NZ = n.z;
}
// khoảng z cục bộ nút k phụ trách (nửa đường tới nút bên cạnh) — để cảnh dựng một lần rồi nhân theo nút không chồng nhau
function phamNut(k) { const Z = HL.z, N = Z.length; return [k ? -(Z[k] - Z[k - 1]) / 2 : -190, k < N - 1 ? (Z[k + 1] - Z[k]) / 2 : 190]; }
const SO_MV = ARMS.length * 3; // chuyển động: mỗi nhánh × thẳng / phải / trái
NUT.nhom = NGA ? NGA.nhom : ['Đông–Tây', 'Bắc–Nam']; // tên hai nhóm đường giao nhau (g = 0 / 1)
// nhánh nằm trên cùng con đường với hướng d (cùng chiều hoặc ngược chiều)
const nhanhTheo = (d) => {
  let tot = ARMS[0], m = -2;
  for (const A of ARMS) { const c = Math.abs(A.d[0] * d[0] + A.d[1] * d[1]); if (c > m) { m = c; tot = A; } }
  return tot;
};
const hwAlong = (d) => nhanhTheo(d).hw; // nửa mặt đường của con đường chạy theo hướng d
const eAlong = (d) => nhanhTheo(d).e; // nửa lòng ngã tư đo theo hướng d
// Đường một chiều: nhánh 'vao' chỉ có xe đi vào, chiếm cả bề ngang [−hw, hw]; nhánh 'ra' chỉ có xe đi ra, cũng cả bề ngang.
const nhanhVao = (d) => ARMS.find((A) => A.d[0] === d[0] && A.d[1] === d[1]);
const nhanhRa = (d2) => ARMS.find((A) => A.d[0] === -d2[0] && A.d[1] === -d2[1]);
const loVao = (d) => (nhanhVao(d)?.mot === 'vao' ? -hwAlong(d) : 0); // mép trái vùng xe vào (0 = tim đường)
const loRa = (d2) => (nhanhRa(d2)?.mot === 'ra' ? -hwAlong(d2) : 0);
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
// Sổ cấu hình nút giao (anh 22/11/2026, "mọi option như người hoạch định giao thông"): mỗi hướng vào (ARMS[i]) có số làn,
// công năng từng làn, kiểu vạch chia làn, độ dài đoạn vạch trước vạch dừng. Vạch, mũi tên VÀ xe đều đọc chung sổ này.
// Làn chia đều nửa đường, làn 0 sát tim đường. Công năng: 'tudo' | 'trai' | 'thang' | 'phai' | 'trai-thang' | 'thang-phai'.
const CONG_NANG = { tudo: 'Tự do', trai: '↰ Chỉ rẽ trái', thang: '↑ Chỉ đi thẳng', phai: '↱ Chỉ rẽ phải', 'trai-thang': '↰↑ Trái + thẳng', 'thang-phai': '↑↱ Thẳng + phải' };
const MAU_LAN = {
  vn: { ten: 'Tự do kiểu VN', h: { soLan: 2, lan: ['tudo', 'tudo'], vach: 'dut', dai: 30 } },
  chuyen: { ten: 'Làn chuyên rẽ (3 làn, vạch liền)', h: { soLan: 3, lan: ['trai', 'thang', 'phai'], vach: 'lien', dai: 30 } },
  hai: { ten: '2 làn: trái + thẳng / thẳng + phải', h: { soLan: 2, lan: ['trai-thang', 'thang-phai'], vach: 'dut', dai: 30 } },
  camTrai: { ten: 'Cấm rẽ trái', h: { soLan: 2, lan: ['thang', 'thang-phai'], vach: 'lien', dai: 30 } },
  chiPhai: { ten: 'Chỉ cho rẽ phải', h: { soLan: 1, lan: ['phai'], vach: 'lien', dai: 30 } },
};
const lanMau = (k) => ARMS.map(() => structuredClone(MAU_LAN[k].h));
const choQuay = (cn, quay) => cn === 'tudo' || cn.split('-').includes(quay);
const lanKhoang = (h, i, hw, lo = 0) => [lo + (i * (hw - lo)) / h.soLan, lo + ((i + 1) * (hw - lo)) / h.soLan];
const lanHopLe = (v) => Array.isArray(v) && v.length === ARMS.length && v.every((h) => h && h.soLan >= 1 && h.soLan <= 4 && Array.isArray(h.lan)
  && h.lan.length === h.soLan && h.lan.every((c) => c in CONG_NANG) && ['dut', 'lien', 'khong'].includes(h.vach) && h.dai >= 10 && h.dai <= 60);
const GOC_LE = 7; // xe leo vỉa hè phải bước xuống đường trước vạch dừng chừng này mét, không chạy tới góc phố
const RE_TRAI_CACH = 1.6; // nửa khoảng cách hai luồng rẽ trái ngược chiều (m)
function taoDuongXe(d, d2, o1, o2, La = L, Lb = L) {
  const r1 = right(d), r2 = right(d2), e1 = eAlong(d), e2 = eAlong(d2);
  const P0 = [-La * d[0] + o1 * r1[0], -La * d[1] + o1 * r1[1]];
  const Pi = [-e1 * d[0] + o1 * r1[0], -e1 * d[1] + o1 * r1[1]];
  const Pe = [e2 * d2[0] + o2 * r2[0], e2 * d2[1] + o2 * r2[1]];
  const Pf = [Lb * d2[0] + o2 * r2[0], Lb * d2[1] + o2 * r2[1]];
  const cross = d[0] * d2[1] - d[1] * d2[0];
  let C;
  if (Math.abs(cross) < 1e-6) C = [(Pi[0] + Pe[0]) / 2, (Pi[1] + Pe[1]) / 2];
  else {
    const bx = Pe[0] - Pi[0], bz = Pe[1] - Pi[1];
    const t = (bx * d2[1] - bz * d2[0]) / cross;
    C = [Pi[0] + t * d[0], Pi[1] + t * d[1]];
  }
  // Rẽ trái: hai luồng rẽ trái ngược chiều phải là HAI đường riêng, lướt qua nhau (anh 22/11/2026 khoanh ảnh). Đường rẽ
  // trái hướng ngược lại là ảnh đối xứng qua tâm ngã tư, nên giữ cả đường cong ở hẳn một phía đường chéo qua tâm
  // (u = d + r1), cách tâm ít nhất RE_TRAI_CACH → hai luồng cách nhau gấp đôi. Trước: xe máy vào ngoài lề (o1 lớn) cua
  // vòng qua tâm, đè lên luồng rẽ trái đối diện → hai đám gặp nhau giữa lòng ngã tư, kẹt chết.
  if (cross < -0.5) {
    const ux = d[0] + r1[0], uz = d[1] + r1[1], tren = (P) => P[0] * ux + P[1] * uz;
    for (let lap = 0; lap < 6; lap++) {
      let mx = -Infinity, tm = 0.5;
      for (let i = 1; i < 20; i++) {
        const t = i / 20, q = 1 - t, v = q * q * tren(Pi) + 2 * q * t * tren(C) + t * t * tren(Pe);
        if (v > mx) { mx = v; tm = t; }
      }
      const du = mx + RE_TRAI_CACH * Math.SQRT2; // |u| = √2
      if (du <= 0.01) break;
      const k = du / (2 * tm * (1 - tm) * 2); // dời điểm uốn ngược hướng u: tren(C) giảm 2k
      C = [C[0] - k * ux, C[1] - k * uz];
    }
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
  p.o1 = o1; p.o2 = o2; p.hw1 = hwAlong(d); p.hw2 = hwAlong(d2); p.lo1 = loVao(d); p.lo2 = loRa(d2);
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
  let dz = 0;
  if (NUTS) { // hành lang: dựng nét theo nút gần điểm cuối nhất, toạ độ cục bộ rồi dời về thế giới
    const E = diem[diem.length - 1]; let k = 0;
    NUTS.forEach((n, i) => { if (Math.abs(n.z - E[1]) < Math.abs(NUTS[k].z - E[1])) k = i; });
    vaoNut(k); dz = NZ; diem = diem.map((P) => [P[0], P[1] - dz]); a.z -= dz;
  }
  const p = taoDuongVe(a, diem);
  if (NUTS) { a.z += dz; for (let i = 0; i < p.z.length; i++) p.z[i] += dz; p.nut = NI; }
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
let DEN = { pha: [], cua: new Int8Array(SO_MV), i: 0, giai: 'r', t: 0, dai: 0, them: 0, doTu: new Float32Array(SO_MV).fill(99), cau: new Int16Array(SO_MV) };
// thứ tự pha 'từng hướng': xen kẽ hai nhóm đường (Tây, Bắc, Đông, Nam) để hai pha liền nhau không cùng một trục
function thuTuHuong() {
  const hang = ARMS.map((A, i) => ARMS.slice(0, i).filter((B) => B.g === A.g).length);
  return ARMS.map((A, i) => i).sort((a, b) => hang[a] - hang[b] || ARMS[a].g - ARMS[b].g || a - b);
}
function dungPha() { // mọi nút; nút k chạy trước k·7 s để đèn các nút lệch pha nhau
  if (!NUTS) return dungPha1();
  const g = NI;
  NUTS.forEach((n, k) => { vaoNut(k); dungPha1(); for (let t = 0; t < k * 140; t++) buocDen(1 / 20); });
  vaoNut(g);
}
function dungPha1() {
  const k = (i, q) => i * 3 + QI[q];
  const nhom = (g, qs) => ARMS.flatMap((A, i) => (A.g === g ? qs.map((q) => k(i, q)) : []));
  const ca = ['thang', 'phai', 'trai'];
  const P = CAI.kieuPha === 'trai'
    ? [{ ten: NUT.nhom[0] + ' thẳng', mv: nhom(0, ['thang', 'phai']), x: 16 }, { ten: NUT.nhom[0] + ' rẽ trái', mv: nhom(0, ['trai']), x: 8 },
      { ten: NUT.nhom[1] + ' thẳng', mv: nhom(1, ['thang', 'phai']), x: 13 }, { ten: NUT.nhom[1] + ' rẽ trái', mv: nhom(1, ['trai']), x: 7 }]
    : CAI.kieuPha === 'huong'
      ? thuTuHuong().map((i) => ({ ten: 'Từ ' + ARMS[i].ten, mv: ca.map((q) => k(i, q)), x: ARMS[i].g === 0 ? 13 : 10 }))
      : [{ ten: NUT.nhom[0], mv: nhom(0, ca), x: 22 }, { ten: NUT.nhom[1], mv: nhom(1, ca), x: 18 }];
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
  for (let i = 0; i < ARMS.length; i++) if (ARMS[i].g === g) for (let q = 0; q < 3; q++) {
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
  for (let k = 0; k < SO_MV; k++) D.doTu[k] += dt;
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
const MAC_DINH = { matDo: DD ? 200 : 250, lieu: 0.12, rePhai: true, tyLeOto: 7, toc: 1, choNga: false, nhuongLoi: false, lanTrai: true, choThoat: 3, denAI: false, kieuPha: '2pha', phaiXanh: false, nguoiBo: DD ? 80 : 85, lanCfg: NGA ? structuredClone(NGA.lan) : lanMau('vn'), danTrai: true, denLan: true };
if (HL) MAC_DINH.lanCfg = [2, 2, 4, 2].map((n) => ({ soLan: n, lan: Array(n).fill('tudo'), vach: 'dut', dai: 30 }));
const KHOA_LUU = 'ngatu-tuy-chon' + (HL ? '-hl-' + HL_K : NGA ? '-' + NGA_K : '');
const daLuu = (() => { try { const o = JSON.parse(localStorage.getItem(KHOA_LUU) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } })();
const CAI = { ...MAC_DINH, lanCfg: structuredClone(MAC_DINH.lanCfg), dung: false, vuot: 0, don: 0, nghich: 0 };
// Bản lưu cũ (trước 21/11/2026, chưa có _ban) còn mật độ 450 → bỏ mật độ đã lưu, về mặc định mới 250.
if (daLuu._ban !== 2) delete daLuu.matDo;
const napCai = (o) => { for (const k of Object.keys(MAC_DINH)) if (typeof o[k] === typeof MAC_DINH[k] && (k !== 'lanCfg' || lanHopLe(o[k]))) CAI[k] = o[k]; };
napCai(daLuu);
// Link chia sẻ #pa=<base64 JSON các mục khác mặc định> đè lên bản lưu của máy này — mở là ra đúng phương án người gửi
const KHONG_CHIA = new Set(['toc']);
const maPA = () => { const o = {}; for (const k of Object.keys(MAC_DINH)) if (!KHONG_CHIA.has(k) && JSON.stringify(CAI[k]) !== JSON.stringify(MAC_DINH[k])) o[k] = CAI[k];
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const PA_LINK = (() => { const m = /[#&]pa=([\w-]*)/.exec(location.hash); if (!m) return null;
  try { const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))); return o && typeof o === 'object' ? o : null; } catch { return null; } })();
if (PA_LINK) { Object.assign(CAI, MAC_DINH, { lanCfg: structuredClone(MAC_DINH.lanCfg) }); napCai(PA_LINK); }
function luuTuyChon() {
  try { localStorage.setItem(KHOA_LUU, JSON.stringify({ _ban: 2, ...Object.fromEntries(Object.keys(MAC_DINH).map((k) => [k, CAI[k]])) })); } catch {}
}
const NGUONG_KET = 22, NGUONG_CAT = 8;
let tg = 0, ketNga = 0; // ketNga: số xe đang đứng kẹt trong lòng ngã tư
let DIEM = null, DIEM_CHAY = false;
const QUA_GAN = [], CHO_GAN = []; // xe qua trong 60 s gần nhất (thời điểm, giây đã chờ) cho số liệu thời gian thực // bảng chấm phương án: đang đo thì cộng dồn chỉ số; đang chạy chấm thì bớt xe không phụ thuộc máy quay
let trongNgaG = [0, 0]; // số xe mỗi hướng đèn còn nằm trong lòng ngã tư

// ───────────────────────── lưới tra láng giềng ─────────────────────────
const CELL = 6, G = HL ? 192 : 64, OFF = G / 2; // hành lang dài ~1 km → lưới phủ ±576 m
if (HL) { // dựng các nút: nút 0 dùng luôn biến toàn cục, nút sau có đèn / bộ đếm riêng
  NUTS = HL.z.map((z, k) => ({ z, ten: HL.ten[k], ket: 0, nhanh: k ? NUT.nhanh.map((A) => ({ ...A })) : NUT.nhanh,
    den: k ? { pha: [], cua: new Int8Array(SO_MV), i: 0, giai: 'r', t: 0, dai: 0, them: 0, doTu: new Float32Array(SO_MV).fill(99), cau: new Int16Array(SO_MV) } : DEN,
    tng: k ? [0, 0] : trongNgaG }));
  NZ = HL.z[0];
}
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
const SON_BUS = ['#14934a', '#14934a', '#14934a', '#e8611a']; // xe buýt Sài Gòn xanh lá, Hà Nội cam
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
// Đường dài trong hành lang: nối các đoạn qua từng nút (taoDuongXe cục bộ của nút, dời theo z) + danh sách mốc theo nút.
// Xe Bà Triệu vào từ đầu Bắc, đi xuyên các nút, có thể rẽ ra phố cắt ở một nút; xe phố cắt đi thẳng hoặc rẽ vào Bà Triệu
// hướng Nam rồi đi tiếp xuyên các nút sau. Không có xe đi ngược chiều Bà Triệu.
function duongHL(loai) {
  const Z = HL.z, N = Z.length, xm = loai === 'xm', bus = loai === 'bus', BT = [0, 1], hw = HW_NS;
  const vao = (k) => (k ? (Z[k] - Z[k - 1]) / 2 : L), ra = (k) => (k < N - 1 ? (Z[k + 1] - Z[k]) / 2 : L);
  const oBT = (lo, hi) => (xm ? rnd(lo, hi) : bus ? 4.4 : chon([-4.4, -1.6, 1.6, 4.4].filter((v) => v >= lo && v <= hi))); // ô tô / buýt giữa một trong 4 làn
  const segs = [];
  const diThang = (k0, o) => { for (let j = k0; j < N; j++) segs.push([j, 2, 'thang', BT, BT, o, o, vao(j), ra(j)]); };
  if (bus || Math.random() < 0.45) { // xe Bà Triệu
    let t = -1, q = 'thang';
    if (!bus) for (let k = 0; k < N; k++) if (Math.random() < 0.16) { t = k; q = Math.random() < 0.55 ? 'phai' : 'trai'; break; }
    const o = q === 'phai' ? oBT(2, hw - 0.7) : q === 'trai' ? oBT(-hw + 0.7, -2) : xm ? rnd(-hw + 0.7, hw - 0.7) : oBT(-hw + 1.5, hw - 1.5);
    const tMax = t < 0 ? N : t;
    for (let k = 0; k < tMax; k++) segs.push([k, 2, 'thang', BT, BT, o, o, vao(k), ra(k)]);
    if (t >= 0) {
      const d2 = q === 'phai' ? right(BT) : neg(right(BT)), h2 = HW_EW;
      const o2 = xm ? (q === 'phai' ? rnd(h2 * 0.55, h2 - 0.6) : rnd(0.8, h2 * 0.45)) : q === 'phai' ? h2 * 0.5 : 2.2;
      segs.push([t, 2, q, BT, d2, o, o2, vao(t), L]);
    }
  } else { // xe phố cắt
    let r = Math.random() * HL.lan.reduce((a, b) => a + b, 0), k = 0;
    while (k < N - 1 && (r -= HL.lan[k]) > 0) k++;
    const ai = Math.random() < 0.5 ? 0 : 1, d = ARMS[ai].d, h1 = HW_EW;
    const vaoBT = Math.random() < 0.3, q = vaoBT ? (ai === 0 ? 'phai' : 'trai') : 'thang';
    const o = xm ? (q === 'phai' ? rnd(h1 * 0.55, h1 - 0.6) : q === 'trai' ? rnd(0.6, Math.min(3, h1 * 0.4)) : rnd(0.8, h1 - 0.6)) : q === 'phai' ? h1 * 0.5 : 2.2;
    if (!vaoBT) segs.push([k, ai, 'thang', d, d, o, o, L, L]);
    else {
      const o2 = q === 'phai' ? (xm ? rnd(2, hw - 0.7) : 4.4) : xm ? rnd(-hw + 0.7, -2) : -4.4;
      segs.push([k, ai, q, d, BT, o, o2, L, ra(k)]);
      diThang(k + 1, o2);
    }
  }
  const pts = [], moc = [];
  let off = 0;
  for (const [k, ai, q, d, d2, o1, o2, La, Lb] of segs) {
    vaoNut(k);
    const c = taoDuongXe(d, d2, o1, o2, La, Lb);
    for (let i = pts.length ? 1 : 0; i < c.x.length; i++) pts.push([c.x[i], c.z[i] + NZ]);
    moc.push({ nut: k, ai, quay: q, sIn: off + c.sIn, sStop: off + c.sStop, sOut: off + c.sOut, o1: c.o1, o2: c.o2, hw1: c.hw1, hw2: c.hw2, lo1: c.lo1, lo2: c.lo2 });
    off += c.len;
  }
  const p = taoPath(pts);
  p.moc = moc; p.mi = 0; Object.assign(p, moc[0]);
  vaoNut(moc[0].nut);
  return { arm: ARMS[moc[0].ai], quay: moc[0].quay, p };
}
// xe đã qua hết lòng nút hiện tại → nạp mốc nút kế (vạch dừng, đèn, hướng đèn của nút đó)
function napMoc(a) {
  const p = a.p;
  while (p.mi < p.moc.length - 1 && a.s > p.sOut + 0.5) {
    const m = p.moc[++p.mi];
    Object.assign(p, m); vaoNut(m.nut);
    a.arm = m.ai; a.g = ARMS[m.ai].g; a.quay = m.quay; a.camKet = a.s + a.len / 2 >= p.sStop; a.lenhDung = false;
  }
}
function duongXe(loai) {
  if (HL) return duongHL(loai);
  const arm = chonArm(loai === 'bus');
  const d = arm.d, h = CAI.lanCfg[ARMS.indexOf(arm)], tuDo = h.lan.every((c) => c === 'tudo');
  let quay = 'thang';
  if (loai !== 'bus') { const r = Math.random(); quay = r < 0.6 ? 'thang' : r < 0.8 ? 'phai' : 'trai'; }
  const raDuoc = (q) => nhanhRa(q === 'thang' ? d : q === 'phai' ? right(d) : neg(right(d)))?.mot !== 'vao'; // không rẽ ngược chiều vào đường một chiều
  if (!raDuoc(quay) || (!tuDo && !h.lan.some((c) => choQuay(c, quay)))) { // hướng này cấm kiểu rẽ vừa bốc → bốc lại trong các kiểu được phép
    const duoc = [['thang', 0.6], ['phai', 0.2], ['trai', 0.2]].filter(([q]) => raDuoc(q) && (tuDo || h.lan.some((c) => choQuay(c, q))));
    let r = Math.random() * duoc.reduce((t, x) => t + x[1], 0);
    for (const [q, w] of duoc) { quay = q; if ((r -= w) <= 0) break; }
  }
  const d2 = quay === 'thang' ? d : quay === 'phai' ? right(d) : neg(right(d));
  const hw1 = hwAlong(d), hw2 = hwAlong(d2), lo1 = loVao(d), lo2 = loRa(d2);
  const m2 = (o) => (lo2 ? lo2 + (o * (hw2 - lo2)) / hw2 : o); // đường ra một chiều: giãn khoảng [0, hw] thành [−hw, hw]
  let o1, o2;
  if (!tuDo) { // vào một làn cho phép kiểu rẽ của mình; làn chuyên dụng ưu tiên hơn làn tự do
    const ds = h.lan.map((c, i) => [c, i]).filter(([c]) => choQuay(c, quay));
    const rieng = ds.filter(([c]) => c !== 'tudo'), [cn, i] = (rieng.length ? rieng : ds)[Math.floor(Math.random() * (rieng.length || ds.length))];
    const [l0, l1] = lanKhoang(h, i, hw1, lo1), m0 = loai === 'xm' ? Math.min(0.5, (l1 - l0) / 2 - 0.45) : 0;
    o1 = loai === 'xm' ? rnd(l0 + m0 + (l0 ? 0 : 0.1), l1 - m0) : (l0 + l1) / 2;
    o2 = loai === 'xm' ? (quay === 'phai' ? rnd(hw2 * 0.55, hw2 - 0.6) : quay === 'trai' ? rnd(0.8, hw2 * 0.45) : rnd(0.8, hw2 - 0.6)) : loai === 'oto' ? (quay === 'phai' ? hw2 * 0.5 : 2.2) : hw2 * 0.55;
    const p = taoDuongXe(d, d2, o1, m2(o2));
    if (cn !== 'tudo' && h.vach === 'lien') { p.lan = [l0, l1]; p.lanDai = h.dai; } // vạch liền: cấm chuyển làn trong đoạn đó
    return { arm, quay, p };
  }
  if (loai === 'xm') {
    // rẽ trái: đi sát tim đường từ trước vạch, ra vào nửa trong của làn đích — đường cong bám vạch dẫn. Trước o1 tới 3/4 nửa
    // đường + o2 tới sát lề: đường cong bị đẩy tách luồng trái đối diện dạt hẳn ra góc, chạy dọc vạch đi bộ (anh 22/11/2026 khoanh ảnh)
    o1 = quay === 'phai' ? rnd(hw1 * 0.55, hw1 - 0.6) : quay === 'trai' ? rnd(0.6, Math.min(3, hw1 * 0.4)) : rnd(0.8, hw1 - 0.6);
    o2 = quay === 'phai' ? rnd(hw2 * 0.55, hw2 - 0.6) : quay === 'trai' ? rnd(0.8, hw2 * 0.45) : rnd(0.8, hw2 - 0.6);
  } else if (loai === 'oto') { o1 = quay === 'phai' ? hw1 * 0.5 : 2.2; o2 = quay === 'phai' ? hw2 * 0.5 : 2.2; }
  else o1 = o2 = hw1 * 0.55;
  if (lo1) o1 = lo1 + (o1 * (hw1 - lo1)) / hw1;
  return { arm, quay, p: taoDuongXe(d, d2, o1, m2(o2)) };
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
  if (NUTS) { const k = (Math.random() * NUTS.length) | 0; vaoNut(k); for (let i = 0; i < p.z.length; i++) p.z[i] += NZ; p.nut = k; }
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
        // Xe máy kẹt lâu (> 3 s) len qua xe máy khác: hai xe máy VN lách sát, gương sượt gương — cho thân chồng tới 0,2 m (sâu hơn nhìn như dính nhau, anh 22/11/2026)
        // khi đang TIẾN tới (không lùi, không bị đẩy). Thay nước lùi / dắt dạt ngang đã bỏ (anh 22/11/2026); không có nước
        // này lòng ngã tư khoá cứng khi đông (link anh gửi: 35 xe kẹt lòng).
        // Hai xe máy đã lỡ chồng sườn nhau, nằm gần song song (lệch < 25°): đi tới theo thân mà chỗ chồng KHÔNG sâu thêm là
        // trượt dọc qua nhau (vượt sát gương), không phải xuyên. Cấm thì cả hai đứng chết dính nhau ở mép ngã tư (anh
        // 22/11/2026 khoanh ảnh: "sao 2 con này lại dừng lại"). Lệch góc lớn thì không áp — trượt chéo mới thành xuyên.
        if (a.loai === 'xm' && j.loai === 'xm' && o0 > CHAM && o0 <= 0.4 && o <= o0 + 1e-6 &&
          Math.abs(Math.cos(g - j.goc)) > 0.9 && (x - xT) * Math.cos(g) - (z - zT) * Math.sin(g) > 0) continue;
        if (a.loai === 'xm' && j.loai === 'xm' && (a.ket > 3 || a.lui > 0) && o <= 0.2 && o0 <= 0.2) continue;
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
// a và j đang rẽ trái từ hai hướng đối diện, cả hai theo đường máy (không phải nét anh vẽ) → mỗi xe một làn rẽ riêng
function renRieng(a, j) {
  if (a.quay !== 'trai' || j.quay !== 'trai' || a.loai === 'bo' || j.loai === 'bo' || a.p.ve || j.p.ve) return false;
  const da = ARMS[a.arm].d, dj = ARMS[j.arm].d;
  return da[0] * dj[0] + da[1] * dj[1] < -0.5;
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
  if (p.lan && a.s > p.sStop - p.lanDai && a.s < p.sIn) { // đoạn vạch liền: ở yên trong làn của mình
    const leo = p.lan[1] >= p.hw1 - 0.01 && a.hayLeo && a.s < p.sStop - GOC_LE && a.sp < 2.5 ? 2.0 : 0;
    return [p.lan[0] + h - p.o1, p.lan[1] - h2 - p.o1 + leo];
  }
  if (a.s < p.sIn) {
    // leo lề khi kẹt trước đèn đỏ — chỉ ở đoạn vỉa hè còn cách vạch dừng GOC_LE m; góc phố (cột đèn, người chờ sang đường)
    // không bao giờ leo tới (anh 22/11/2026 khoanh ảnh: xe leo lề đều dồn vào góc rồi kẹt ở đó)
    const leo = a.hayLeo && a.s < p.sStop - GOC_LE && a.sp < 2.5 ? 2.0 : 0;
    return [h + (p.lo1 || 0) - p.o1 - (a.lanTrai || 0), p.hw1 - h2 - p.o1 + leo];
  }
  if (a.s > p.sOut) return [h + (p.lo2 || 0) - p.o2 - (a.lanTrai || 0), p.hw2 - h2 - p.o2];
  // rẽ phải: quẹo gọn sát góc, không dạt ra giữa lòng ngã tư
  if (a.quay === 'phai') { const bp = a.loai === 'xm' ? 1.2 + Math.min(1, a.ket * 0.2) : 0.6; return [-bp, bp]; }
  const b = a.loai === 'xm' ? Math.max(2.2, 4.5 - (a.s - p.sIn) * 0.3) + Math.min(3, a.ket * 0.6) : Math.max(0.8, 3.5 - (a.s - p.sIn) * 0.35) + Math.min(2, a.ket * 0.4);
  return [-b, b];
}
function buocXe(a, dt) {
  if (a.nhac) return bay(a, dt);
  if (a.dangVe) { a.sp = 0; return; } // đang được vẽ đường: đứng chờ nét vẽ xong
  if (a.nga && nam(a, dt)) return;
  if (trangThaiTro(a, dt)) return;
  if (a.p.moc) napMoc(a);
  const xm = a.loai === 'xm';
  const p = a.p;
  const fx = a.fx, fz = a.fz, rx = -fz, rz = fx;
  const look = xm ? 11 : 18;
  let ai = null, chan = null;
  let f0 = 99, fL = 99, fR = 99, vj = 0, day = 0, hoT = 99, hoP = 99, neBo = 0, boG = 99, boJ = null;
  const lanCat = []; // làn trước mũi các xe đang cắt ngang đường mình: [mép gần, mép xa, xe]
  const cr = xm ? 2 : 3, off = xm ? 1.3 : a.wid + 0.5;
  const cx = cellX(a.x), cz = cellX(a.z), tim = a.dlat + (a.s < p.sIn ? p.o1 : p.o2); // tim: mình cách tim đường bao xa
  let nguoc = false; // có xe ngược chiều đang đi tới trên nửa đường bên kia, trước mặt mình
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
        if (j.loai !== 'bo' && lon > -1 && j.fx * fx + j.fz * fz < -0.3 && tim + lat < nua(j, rx, rz) + 0.6) nguoc = true;
        // bề ngang / bề dọc chung của hai thân theo hướng mình đi, tính cả góc nằm của từng xe (xe cắt ngang chiếm cả làn)
        const nL = nua(a, rx, rz) + nua(j, rx, rz);
        // Hai xe rẽ trái ngược chiều đi hai làn rẽ riêng đã kẻ vạch, lướt qua nhau → không coi nhau là vật cản, không phanh
        // vì đi gần (anh 22/11/2026: "làn đang là rẽ riêng từng xe → chậm chung"). Thân thật chồng nhau thì chốt va chạm lo.
        if (renRieng(a, j) && Math.hypot(ex, ez) > nL + 0.1) continue;
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
        // Người đi bộ đang băng qua và đã đi quá tim mũi mình (đang rời khỏi làn mình) → luồn ra sau lưng họ mà đi, không
        // đứng chờ người đi chậm qua hết (anh 22/11/2026: "xe VN thấy phía trước đủ rộng là chủ động đi vào, luồn ra sau
        // lưng họ"). Chỉ khi phía sau lưng họ còn đủ chỗ cho thân mình; người còn chắn ngay trước mũi thì vẫn chờ.
        if (j.loai === 'bo' && j.trenDuong && lon > 0.1 && lon < 6 && !j.choXe) {
          const sJ = j.fx * rx + j.fz * rz;
          // Xe máy VN không đứng nhường người đi bộ khi vượt được (anh 22/11/2026): người còn trước mũi cũng vòng qua —
          // ưu tiên phía sau lưng người (họ đang bước ra xa), người đi dọc đường thì bên nào dạt ít hơn. Ô tô giữ luật cũ.
          let lui = null;
          if (Math.abs(sJ) > 0.5 && lat * sJ > 0 && Math.abs(lat) > 0.25) lui = -Math.sign(sJ) * (nL + 0.35 - Math.abs(lat));
          else if (xm && !j.nga) {
            const dT = lat + (nL + 0.35), dP = lat - (nL + 0.35); // dạt để người nằm hẳn bên phải / bên trái mình
            lui = Math.abs(sJ) > 0.5 ? (sJ > 0 ? dP : dT) : Math.abs(dT) < Math.abs(dP) ? dT : dP;
          }
          if (lui !== null) {
            if (Math.abs(lui) < (xm ? 2.0 : 1.2)) { neBo = Math.abs(lui) > Math.abs(neBo) ? lui : neBo; if (lon - hl < boG) { boG = lon - hl; boJ = j; } continue; }
          }
        }
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
  // Né / lách sang TRÁI được lấn qua tim đường sang nửa ngược chiều khi bên đó đang trống (anh 22/11/2026: "xe ở VN khi
  // né không nhất thiết chỉ bên phải, mà cả bên trái nếu còn khoảng trống"). Trước biên trái là tim đường → xe sát tim
  // hết chỗ dạt, chỉ còn né phải. Có xe ngược chiều tới trên nửa kia thì biên co về tim, xe tự lách trả về làn mình.
  // Không lấn tim đường trong 25 m trước vạch dừng, và xe sắp rẽ phải không bao giờ lấn trái (anh 22/11/2026 khoanh
  // ảnh: xe máy vượt hàng chờ đèn bằng nửa đường ngược chiều rồi rẽ phải chéo cả lòng ngã tư — "đi ngu"). Lấn trái chỉ
  // để né trên đoạn đường thoáng; gần ngã tư xe về nửa đường của mình (biên kéo về), rẽ phải thì bám mép phải.
  a.lanTrai = CAI.lanTrai && !nguoc && !p.ve && a.quay !== 'phai' && (a.s < p.sStop - 25 || a.s > p.sOut) ? (xm ? 1.8 : 2.8) : 0;
  // Luồn sau lưng người đi bộ chỉ khi bên đó CÓ KHOẢNG TRỐNG thật (anh 22/11/2026: "luồn lách nhưng phải có khoảng
  // trống"): sườn bên đó sau khi dạt vẫn hở ≥ 0,2 m, phía trước bên đó trống quá chỗ người đứng, không lấn ra ngoài mép
  // đường. Không đủ thì người đi bộ vẫn là vật cản — dừng chờ như thường.
  if (neBo) {
    const [lo0, hi0] = bien(a), trai = neBo < 0;
    const ho = trai ? hoT : hoP, fS = trai ? fL : fR, dich = a.dlat + neBo;
    if (!(ho > Math.abs(neBo) + 0.2 && fS > boG + a.len && dich > lo0 && dich < hi0)) { neBo = 0; if (boG < f0) { f0 = boG; vj = 0; ai = boJ; } }
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
  // trong lòng ngã tư xe máy đi chậm lại khi đông, nhưng trước mũi thoáng thì vít ga thoát ra cho nhanh (anh 22/11/2026)
  let vt = a.vmax * (a.trongNga && xm && f0 < 8 ? 0.8 : 1);
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
        if (!a.dangDon) { a.dangDon = true; if (!a.lauAo) CAI.don++; }
        a.tDon -= dt;
        if (a.tDon <= 0) { a.sDon = -1; a.dangDon = false; a.lauAo = false; }
      }
    }
  }
  // Đèn: xe chưa "được qua" (camKet) và mũi chưa vào lòng ngã tư thì nghe đèn. camKet chỉ có khi mũi xe thật sự qua
  // vạch dừng lúc đang được đi — trước gắn cho mọi xe còn ở phía sau lúc đèn xanh, nên cả hàng đứng chờ cũng thành
  // "đã cam kết", đèn đỏ vẫn chạy, mà bộ đếm lại bỏ qua xe cam kết → liều 0% vẫn vượt, đếm ra 0 lượt.
  const dau = a.s + a.len / 2;
  let m = 'x', duoc = true, vDen = Infinity;
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
    // Xe liều chỉ vượt vàng/đỏ khi lòng ngã tư phía trước thật sự trống: hướng kia chưa có xe trong lòng, không ai đứng kẹt,
    // trước mũi thoáng một quãng dài (anh 22/11/2026: "vượt đèn đỏ là nguyên nhân lớn nhất"). Trước liều là lao bất kể,
    // đứng chết giữa dòng hướng kia đang xanh → nút vòng cả lòng ngã tư.
    const loTrong = trongNgaG[1 - a.g] <= 1 && ketNga === 0 && f0 > a.len + 8;
    if (m === 'v') duoc = khongKip || (lieu && loTrong);
    if (m === 'd') duoc = (khongKip && qua < 1.5) || (xm && a.quay === 'phai' && CAI.rePhai) || (lieu && loTrong && (qua < 3 || con < 2.5));
    // Tuỳ chọn (mặc định tắt): lòng ngã tư đã kẹt / hướng kia còn đầy xe thì đứng chờ ở vạch kể cả đèn xanh.
    if (CAI.choNga && (ketNga > NGUONG_KET || trongNgaG[1 - a.g] > NGUONG_CAT) && dau < p.sStop) duoc = false;
    // Mặc định, kiểu người VN: vẫn lao vào khe — nhưng không lao khi ngay sau vạch phía trước mũi đã kín (không đủ một thân
    // xe + khoảng thoát). Vào rồi đứng chết giữa lòng ngã tư là chặn luôn lối hướng kia; kẹt kín lòng ngã tư từ đây.
    if (duoc && dau < p.sStop && p.sStop - dau < 2 && f0 < a.len + (xm ? 2 : 4)) duoc = false;
    if (!duoc) {
      if (m !== 'x' && !lieu) a.lenhDung = true;
      const gap = p.sStop + lan - 0.15 - dau;
      vDen = gap < 0.3 ? 0 : Math.sqrt(2 * 3.2 * gap);
      vt = Math.min(vt, vDen);
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
    const tTrai = fL > thoat && hoT > a.wid * 0.6 && a.dlat - off * 0.5 > lo, tPhai = fR > thoat && hoP > a.wid * 0.6 && a.dlat + off * 0.5 < hi;
    // hai bên cùng thoáng: chọn bên trống xa hơn phía trước, bằng nhau thì bên còn rộng hơn tới mép — trước luôn ưu tiên
    // bên trái nên cả hàng dồn về tim đường, nửa sát lề bỏ trống
    if (tTrai && tPhai) neThoat = fL !== fR ? (fL > fR ? -1 : 1) : a.dlat - lo > hi - a.dlat ? -1 : 1;
    else neThoat = tTrai ? -1 : tPhai ? 1 : 0;
    // Cả lúc đang dồn hàng chờ đèn đỏ: xe sau dồn lên chỗ trống bên cạnh (tới sát vạch), không xếp một hàng dọc dài sau
    // xe trước trong khi nửa đường bên cạnh bỏ trống (anh 22/11/2026 khoanh ảnh). Chỉ nhích trong quãng tới vạch dừng.
    if (neThoat) vt = Math.max(vt, Math.min(xm ? 0.9 : 0.5, vDen));
  }
  // Phóng lách (anh 22/11/2026: "xe máy kẹt quá lâu mà khe hẹp nhất — vẫn phải có khoảng trống — cũng phóng vọt lên lách
  // cho qua"): xe máy đứng kẹt > 4 s, một bên còn khe thật (hoT/hoP đã trừ hai nửa thân + 0,15 m) và phía trước bên đó trống
  // ≥ 1,5 m → bốc đầu lách vào khe trong 1,5 s: tăng tốc gấp, bẻ lái gắt. Chốt cứng va chạm phía dưới vẫn giữ — không xuyên xe.
  if (a.phong > 0) a.phong -= dt;
  if (xm && !latDich && a.ket > 4 && !(a.phong > 0) && (vDen === undefined || vDen > 1) && f0 < 2.5) {
    const kT = hoT > 0.05 && fL > Math.max(1.5, f0 + 0.6) && a.dlat > lo, kP = hoP > 0.05 && fR > Math.max(1.5, f0 + 0.6) && a.dlat < hi;
    if (kT || kP) { a.phong = 1.5; a.phongBen = kT && kP ? (fL >= fR ? -1 : 1) : kT ? -1 : 1; }
  }
  if (a.phong > 0) {
    // khe khép lại (bên đó hết hở sườn / phía trước bên đó bị lấp) thì thôi phóng ngay, không chen cố vào rồi đứng chắn ngang
    const fB = a.phongBen < 0 ? fL : fR, hB = a.phongBen < 0 ? hoT : hoP;
    if (hB < 0.02 || fB < 1.2) { a.phong = 0; a.ket = Math.min(a.ket, 2); }
    else { neThoat = a.phongBen; vt = Math.max(vt, Math.min(4, (fB - 0.5) * 1.5, vDen)); }
  }
  // xe máy đứng kẹt giữa lòng ngã tư > 6 s (thường là vòng chờ nhau): bỏ khoảng giữ đuôi, bò lên 0,6 m/s — thân chỉ được
  // sượt xe máy khác tới 0,3 m (chốt va chạm), không lùi, không trượt ngang. Thay nước lùi gỡ vòng đã bỏ.
  if (xm && a.trongNga && a.ket > 6) vt = Math.max(vt, 0.6);
  // xe máy không lùi: lượt "lùi nhường" của nó thành lượt len lên chỗ hở phía trước, sượt gương xe máy bên cạnh
  if (a.lui > 0 && xm) { a.lui -= dt; vt = Math.max(vt, 0.8); if (a.lui <= 0) a.camLui = 3; }
  else if (a.lui > 0) { a.lui -= dt; vt = 0; if (a.lui <= 0 && a.luiDuoc === 0) a.camLui = 6; } // đang lùi nhường lối: không tiến lại vào chỗ vừa chừa
  if (a.camLui > 0) a.camLui -= dt;
  // Đang ở trên vỉa hè: chưa bước xuống được lòng đường thì dừng trên lề trước góc phố, kể cả đèn xanh, kể cả đang lách /
  // phóng — chờ khe rồi mới xuống. Đặt sau mọi nước tăng tốc để không luật nào đẩy xe chạy tiếp trên lề tới góc.
  // Bên trái (phía lòng đường) có khe thì bò 0,5 m/s chéo xuống — xe chỉ bẻ lái được khi bánh lăn, đứng im là kẹt trên lề mãi.
  if (xm && a.s < p.sIn && p.o1 + a.dlat > p.hw1 && dau < p.sStop - GOC_LE + 2.5) {
    const g = p.sStop - GOC_LE - dau, xuong = hoT > 0.3 && dau < p.sStop - GOC_LE + 2;
    vt = Math.min(vt, Math.max(g < 0.3 ? 0 : Math.sqrt(2 * 3.2 * g), xuong ? 0.5 : 0));
    if (xuong) neThoat = -1;
  }
  const ac = (a.phong > 0 ? 3 : 1) * (xm ? 2.6 : a.loai === 'bus' ? 1.0 : 1.8) * (a.ket > 1 ? 1.8 : a.trongNga && f0 > 4 ? 1.5 : 1); // có chỗ thoát khỏi lòng ngã tư → tăng tốc gấp
  a.sp = vt > a.sp ? Math.min(vt, a.sp + ac * dt) : Math.max(vt, a.sp - 9 * dt);
  if (a.sp < 0.2 && !a.choDen && !a.dangDon) a.ket = Math.min(10, a.ket + dt); else a.ket = Math.max(0, a.ket - dt * 0.5);
  {
    let lvt = 0;
    const vNe = xm ? (a.phong > 0 ? 2.5 : 1.4) : a.loai === 'bus' ? 0.6 : 1.1;
    if (latDich) lvt = (latDich - a.dlat) * 1.2; // taxi tạt sát lề đón khách
    else if (neThoat) lvt = neThoat * vNe; // bị chặn mũi → lách sang bên phía trước thoáng (cả ở ngã tư lẫn ngoài đường)
    else if (neBo) lvt = Math.sign(neBo) * vNe; // luồn ra sau lưng người đi bộ
    // không bị chặn: xe máy lượn nhẹ về giữa, ô tô giữ làn đang đi (ngoài đường) / bám đường cong (trong ngã tư)
    if (!lvt) lvt = xm ? -a.dlat * (a.trongNga ? 0.6 : 0.08) + Math.sin(tg * a.w + a.ph) * 0.25 : -a.dlat * (a.trongNga ? 0.5 : 0.03);
    if (xm) lvt += day * 0.9; // chỉ còn để tách nhẹ khi lỡ chồng nhau, không bật nẩy
    if (a.dlat < lo) lvt = Math.max(lvt, (lo - a.dlat) * 1.5);
    if (a.dlat > hi) lvt = Math.min(lvt, (hi - a.dlat) * 1.5);
    const lim = xm ? (a.phong > 0 ? 0.8 : 0.35) + a.sp * (a.phong > 0 ? 0.6 : 0.3) : (a.taxi ? 1.6 : 1.1) * Math.min(1, a.sp / 2 + (a.dangDon ? 0 : 0.4));
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
  const LAI = xm ? (a.phong > 0 ? 1.6 : 1.0) : a.loai === 'bus' ? 0.25 : 0.35, mL = LAI * a.sp * dt;
  dl = Math.max(-mL, Math.min(mL, dl));
  if (day) dl += Math.max(-mL, Math.min(mL, day * 0.6 * dt)); // tách khỏi chồng lấn chỉ khi đang lăn, chậm, không giật
  a.lv = Math.max(-LAI * a.sp, Math.min(LAI * a.sp, a.lv));
  // Đặt thử chỗ mới. Thân xe lấn sâu thêm vào xe / người khác thì bỏ bớt: đi thẳng thôi → tạt ngang thôi → đứng yên.
  // Đây là chốt cứng cuối cùng: luật bám đuôi / nhường ở trên có đoán sai thì xe vẫn không đi xuyên qua nhau.
  // Lùi ra khỏi xe j (thân giữ hướng, bẻ lái ra phía xa j theo quãng lùi thật); lùi không nổi thì đứng nguyên.
  const luiRa = (j, goc) => {
    // Xe máy không lùi (anh 22/11/2026: "không để xe máy đi lùi") — chỉ ô tô gài số lùi gỡ kẹt; xe máy đứng chờ.
    if (xm) return goc;
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
        // Bỏ nước "chống chân dắt xe dạt ngang" lúc đứng im (anh 22/11/2026): nhìn như người đi bộ cạnh đó đẩy xe đi.
        else if (false) {
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
  // Hai xe máy đứng dính thân nhau (lỡ sượt sâu khi lách, rồi cả hai cùng đứng): người lái chống chân dắt xe tách ra
  // ~0,35 m/s theo hướng rời xa xe kia, chỉ những bước làm chỗ chồng NÔNG đi và không lấn ai khác (chốt va chạm). Không
  // có nước này hai xe dính nhau mãi không tách (anh 22/11/2026 khoanh ảnh). Chỉ tách chồng — không trượt vào chỗ trống.
  if (xm && a.sp < 0.4 && !a.nga) { // cả lúc đang bò chậm trong nút: bò mà vẫn dính thì vẫn tách
    let jD = null, oD = CHAM * 1.5;
    const cx2 = cellX(a.x), cz2 = cellX(a.z);
    for (let gx = cx2 - 1; gx <= cx2 + 1; gx++) for (let gz = cz2 - 1; gz <= cz2 + 1; gz++) {
      if (gx < 0 || gx >= G || gz < 0 || gz >= G) continue;
      for (let k = head[gx * G + gz]; k !== -1; k = nxt[k]) {
        const j = DS[k];
        if (!j || j === a || j.loai !== 'xm' || j.y > 2) continue;
        const o = lanSau(a.x, a.z, a.goc, a.len, a.wid, j);
        if (o > oD) { oD = o; jD = j; }
      }
    }
    if (jD) {
      const vx = a.x - jD.x, vz = a.z - jD.z, l = Math.hypot(vx, vz) || 1, b = 0.35 * dt;
      const ds = ((vx * a.fx + vz * a.fz) / l) * b, dd = ((vx * -a.fz + vz * a.fx) / l) * b;
      const s0 = a.s, d0 = a.dlat, x0 = a.x, z0 = a.z, [bl, bh] = bien(a);
      for (const [u, w] of [[ds, dd], [0, Math.sign(dd || 1) * b], [Math.sign(ds || 1) * b, 0]]) {
        if ((w > 0 && d0 + w > bh) || (w < 0 && d0 + w < bl)) continue; // không dắt ra ngoài biên (lên vỉa hè, sang làn ngược)
        datCho(a, s0 + u, d0 + w, a.k);
        if (!vuong(a, a.x, a.z, goc, x0, z0, goc) && lanSau(a.x, a.z, goc, a.len, a.wid, jD) < oD) { a.lv = 0; break; }
        datCho(a, s0, d0, a.k);
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
  if (chan && chan.loai !== 'bo' && chan.choAi === a && chan.sp < 0.05 && a.ket > 4 && !(a.lui > 0) && !(a.camLui > 0)) { a.lui = 2; a.luiJ = chan; a.luiDuoc = 0; }
  // Vòng chờ nhau từ ba xe trở lên (A bị thân B chặn, B chờ C, C lại chờ A — đo 22/11/2026, ảnh anh "sao lại kẹt"):
  // luật trên chỉ gỡ cặp hai xe, vòng dài thì cả cụm đứng chết dù quanh còn trống. Xe đang chắn thân mình (chan) mà chuỗi
  // chờ của nó vòng về chính mình → báo nó lùi ra khỏi mình một nhịp, mình đi qua chỗ vừa chừa, vòng tự tan.
  // Lùi cả nhịp mà không nhích nổi (sau đuôi kín) thì thôi nhận lệnh lùi một lúc — không thì bị báo lùi mãi, đứng chết
  // trong khi phía trước đã trống (ô tô lượt 3 đo 22/11/2026).
  if (a.luiBao && a.sp < 0.05 && !(a.lui > 0) && !(a.camLui > 0)) { a.lui = 2; a.luiJ = a.luiBao; a.luiDuoc = 0; }
  a.luiBao = null;
  // Xe được báo mà sau đuôi kín (vừa lùi không nổi) thì báo xe kế trong vòng lùi khỏi xe đang chờ nó.
  if (chan && chan.loai !== 'bo' && a.ket > 2 && chan.choAi !== a) {
    const vong = [a, chan];
    let x = chan.choAi;
    while (x && x !== a && vong.length < 9) { vong.push(x); x = x.choAi; }
    if (x === a && !vong.some((v) => v.lui > 0)) {
      for (let i = 1; i < vong.length; i++) if (vong[i].loai !== 'bo' && !(vong[i].camLui > 0)) { vong[i].luiBao = vong[i - 1]; break; }
    }
  }
  if (a.lui > 0 && a.luiJ && a.sp < 0.05) { goc = luiRa(a.luiJ, goc); if (a.s < sTruoc - 1e-6) a.luiDuoc = 1; }
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
  let tMin = Infinity;
  const g = Math.atan2(-a.fz, a.fx), qx = a.x + a.fx * 1.5, qz = a.z + a.fz * 1.5;
  const cx = cellX(qx), cz = cellX(qz);
  for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
    if (gx < 0 || gz < 0 || gx >= G || gz >= G) continue;
    for (let k = head[gx * G + gz]; k !== -1; k = nxt[k]) {
      const j = DS[k];
      if (!j || j.loai === 'bo' || j.y > 1 || j.nga || j.sp < 0.8) continue;
      BONG.goc = j.goc; BONG.len = j.len; BONG.wid = j.wid + 0.3;
      for (let t = 0; t <= 3 && t < tMin; t += 0.5) {
        BONG.x = j.x + j.fx * j.sp * t; BONG.z = j.z + j.fz * j.sp * t;
        if (lanSau(qx, qz, g, 2.6, 1.0, BONG) > 0) { tMin = t; break; }
      }
    }
  }
  return tMin;
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
  trangThaiTro(a, dt);
  let vt = a.vmax;
  let trenDuong = false, cho = false;
  for (const c of a.p.qua) {
    if (a.s > c.s0 && a.s < c.s1) {
      trenDuong = true;
      // Đang giữa vạch mà đèn cho người sắp hết (hoặc đã hết) thì rảo bước / chạy cho kịp sang, không lờ đờ (anh 22/11/2026).
      const [m, con] = denBo(c.g), conLai = c.s1 - a.s;
      if (m !== 'd' || con < 7) vt = Math.min(2.5, Math.max(vt, a.vmax * 1.35, m === 'd' ? conLai / Math.max(0.6, con - 1) : 2.3));
    }
    // Còn đứng trên lề thì xét lại MỖI khoảnh khắc, chưa bước xuống thì chưa có gì "đã quyết": đèn chuyển xanh cho xe
    // trong lúc đang đứng chờ thì thôi không bước nữa (trước quyết một lần rồi giữ, đứng chờ xe xong vẫn bước giữa đèn
    // xanh). Bước khi: đèn cho người (hoặc người liều) VÀ đường qua không có xe đang đứng kẹt (ngã tư tắc, xe dồn lên
    // vạch) — anh 21/11/2026: người đi bộ phải chờ đèn, chờ xe, chờ cả khi ngã tư đang tắc.
    if (a.s < c.s0 && c.s0 - a.s < 2) {
      const [m, con] = denBo(c.g);
      // Chỉ bước xuống khi còn đủ giờ đi hết vạch trước lúc xe hướng này xanh (+2 s dư) — trước chỉ cần còn 6 s, người
      // bước muộn còn giữa đường khi xe được đi, xe đứng chờ dồn ngược vào lòng ngã tư (anh 22/11/2026: "đèn cho người
      // đi bộ cũng cần tối ưu"). Hết giờ bước thì cuối pha vạch trống, xe rẽ cùng pha thoát hết.
      const canDi = (c.s1 - a.s) / a.vmax + 2;
      if (!((laLieu(a) || (m === 'd' && con > canDi)) && !vachKet(a, c))) { vt = Math.min(vt, Math.max(0, c.s0 - 0.4 - a.s) * 1.5); cho = true; }
    }
  }
  a.choDen = cho; // đứng chờ đèn (kể cả giữa dải phân cách) — xe không coi là "sắp bước ra" mà nhường mãi
  // Có xe đang chạy tới trước mặt (thân xe sẽ quét qua khoảng 0,2–2,8 m trước người trong 1,5 s tới) → đứng chờ xe qua
  // rồi mới bước, kể cả người liều (anh 21/11/2026). Xe đã dừng nhường người thì không tính, không thành hai bên chờ nhau.
  // Xe còn xa hơn (1,5–3 s) → bước chậm lại, nhường xe qua trước, không cắm đầu chạy (anh 22/11/2026).
  const tXe = vt > 0 ? xeTruocMat(a) : Infinity;
  if (tXe <= 1.5) { vt = 0; a.choXe = true; } else { a.choXe = false; if (tXe <= 3) vt *= 0.3 + 0.25 * (tXe - 1.5); }
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
// ── Trò nghịch thêm (anh 22/11/2026: "thêm trò dội nước lên xe… thêm trò nữa") ──
// 💦 Dội nước: một xô nước đổ từ trên xuống chỗ bấm. Người lái / người đi bộ bị dội giật mình: xe phanh khựng ~1 s, xe máy
// có khi loạng choạng ngã; người đi bộ ướt thì chạy vội. Nước để lại vũng trên mặt đường ~25 s — xe máy phóng nhanh qua
// vũng có thể trượt bánh ngã.
// 🍌 Vỏ chuối: bấm lên mặt đường thả một vỏ chuối. Xe máy / người đi bộ giẫm phải là ngã; ô tô cán qua thì bẹp mất.
const GIOT = [], VUNG = [], CHUOI = [];
const VAT_GIOT = new THREE.MeshBasicMaterial({ color: '#7fc8ff', transparent: true, opacity: 0.85 });
const HINH_GIOT = new THREE.SphereGeometry(0.07, 6, 4);
const HINH_VUNG = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
const HINH_CHUOI = new THREE.TorusGeometry(0.16, 0.05, 6, 10, Math.PI * 1.3).rotateX(-Math.PI / 2);
const VAT_CHUOI = new THREE.MeshLambertMaterial({ color: '#ffd84a' });
function doiNuoc(x, z, a) {
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(HINH_GIOT, VAT_GIOT);
    const r = Math.random() * 0.9, t = Math.random() * Math.PI * 2;
    m.position.set(x + Math.cos(t) * r * 0.4, 5 + Math.random() * 1.5, z + Math.sin(t) * r * 0.4);
    scene.add(m);
    GIOT.push({ m, vx: Math.cos(t) * r * 2.2, vz: Math.sin(t) * r * 2.2, vy: -Math.random() * 2, tre: Math.random() * 0.15 });
  }
  const vm = new THREE.Mesh(HINH_VUNG, new THREE.MeshBasicMaterial({ color: '#3d6f94', transparent: true, opacity: 0, depthWrite: false }));
  vm.position.set(x, 0.035, z); vm.scale.setScalar(0.3); vm.renderOrder = 3; scene.add(vm);
  VUNG.push({ m: vm, x, z, t: 0, r: rnd(1.4, 2), qua: new Set() });
  // nước rơi tới người thì mới giật mình — ai đứng trong tầm xô nước (~1,6 m) cũng ướt, không chỉ chiếc được bấm trúng
  if (a) a.choDoi = 0.45;
  for (const j of DS) if (j !== a && !j.nhac && (j.x - x) ** 2 + (j.z - z) ** 2 < 1.6 * 1.6) j.choDoi = 0.45;
  CAI.nghich++;
}
// Bị dội thì ƯỚT THẬT và có hậu quả (anh 22/11/2026: "dội nước thì phải ướt và có hậu quả"): người / xe sẫm màu nước,
// nhỏ giọt suốt ~25 s. Xe máy: giật mình (có khi ngã), rồi tấp vào lề dừng 6–9 s vắt áo, ướt thì đi chậm lại. Ô tô: kính
// ướt nhoè, chạy chậm nửa tốc tới khi khô. Người đi bộ: chạy vội tìm chỗ trú, rồi đứng giũ người.
const MAU_UOT = new THREE.Color('#22476a'), CU = new THREE.Color();
function uot(c, a) { return a.uot > 0 ? CU.copy(c).lerp(MAU_UOT, Math.min(0.6, a.uot / 25 * 0.9)) : c; }
function trungNuoc(a) {
  if (a.nhac) return;
  a.uot = 25; a.vmax0 = a.vmax0 || a.vmax;
  if (a.nga) return;
  if (a.loai === 'bo') { a.vmax = a.vmax0 * 2.2; a.chayUot = 4; return; }
  if (a.loai === 'xm') {
    if (Math.random() < 0.35) { dayNga(a); CAI.nghich--; }
    else a.khung = 1.1;
    if (a.sDon < 0 && (a.s < a.p.sIn - 14 || a.s > a.p.sOut + 2)) { a.sDon = a.s + 8; a.tDon = rnd(6, 9); a.lauAo = true; } // tấp lề vắt áo
    return;
  }
  a.khung = 1.1; // giật mình phanh khựng
}
function thaChuoi(x, z) {
  const m = new THREE.Mesh(HINH_CHUOI, VAT_CHUOI);
  m.position.set(x, 0.06, z); m.rotation.y = Math.random() * 6.3; scene.add(m);
  CHUOI.push({ m, x, z });
  if (CHUOI.length > 12) { const c = CHUOI.shift(); scene.remove(c.m); }
}
function buocTro(dt) {
  for (let i = GIOT.length - 1; i >= 0; i--) {
    const g = GIOT[i];
    if (g.tre > 0) { g.tre -= dt; continue; }
    g.vy -= 14 * dt; g.m.position.x += g.vx * dt; g.m.position.y += g.vy * dt; g.m.position.z += g.vz * dt;
    if (g.m.position.y < 0.05) { scene.remove(g.m); GIOT.splice(i, 1); }
  }
  for (let i = VUNG.length - 1; i >= 0; i--) {
    const v = VUNG[i]; v.t += dt;
    const lon = Math.min(1, v.t / 0.8), mo = v.t < 0.5 ? 0 : v.t < 20 ? 0.55 : Math.max(0, 0.55 * (1 - (v.t - 20) / 5));
    v.m.scale.setScalar(v.r * (0.3 + 0.7 * lon)); v.m.material.opacity = mo;
    if (v.t > 25) { scene.remove(v.m); v.m.material.dispose(); VUNG.splice(i, 1); continue; }
    if (v.t < 0.6) continue;
    for (const a of DS) {
      if (a.loai !== 'xm' || a.nga || a.nhac || a.sp < 3 || v.qua.has(a)) continue;
      if ((a.x - v.x) ** 2 + (a.z - v.z) ** 2 > v.r * v.r) continue;
      v.qua.add(a);
      if (Math.random() < 0.3) dayNga(a);
    }
  }
  for (let i = CHUOI.length - 1; i >= 0; i--) {
    const c = CHUOI[i];
    for (const a of DS) {
      if (a.nga || a.nhac || a.y > 0.3) continue;
      const r = a.loai === 'bo' ? 0.35 : a.loai === 'xm' ? 0.6 : Math.max(a.len, a.wid) / 2;
      if ((a.x - c.x) ** 2 + (a.z - c.z) ** 2 > r * r) continue;
      if (a.loai === 'xm' || a.loai === 'bo') dayNga(a);
      scene.remove(c.m); CHUOI.splice(i, 1); break;
    }
  }
}
function trangThaiTro(a, dt) {
  if (a.choDoi > 0) { a.choDoi -= dt; if (a.choDoi <= 0) trungNuoc(a); }
  if (a.chayUot > 0) { a.chayUot -= dt; if (a.chayUot <= 0) { a.vmax = a.vmax0 * 0.15; a.giu = rnd(2, 3); } } // tới chỗ trú: đứng giũ người
  if (a.giu > 0) { a.giu -= dt; if (a.giu <= 0) a.vmax = a.vmax0; }
  if (a.uot > 0) {
    a.uot -= dt;
    if (a.loai !== 'bo' && !a.giu) a.vmax = a.uot > 0 ? a.vmax0 * (a.loai === 'xm' ? 0.6 : 0.5) : a.vmax0; // ướt / kính nhoè: đi chậm
    if (Math.random() < dt * (a.uot / 25) * (a.loai === 'bo' || a.loai === 'xm' ? 10 : 18)) { // nhỏ giọt
      const m = new THREE.Mesh(HINH_GIOT, VAT_GIOT);
      m.position.set(a.x + rnd(-0.3, 0.3), a.loai === 'oto' ? 1.2 : a.loai === 'bus' ? 2.8 : 1.3, a.z + rnd(-0.3, 0.3)); m.scale.setScalar(0.6); scene.add(m);
      GIOT.push({ m, vx: 0, vz: 0, vy: 0, tre: 0 });
    }
  }
  if (a.khung > 0) { a.khung -= dt; a.sp = Math.max(0, a.sp - 8 * dt); return true; }
  return false;
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
const ngoaiKhung = (a) => !daCoKhung || DIEM_CHAY || !KHUNG.containsPoint(VK.set(a.x, 1, a.z));
function buoc(dt) {
  tg += dt;
  dungLuoi();
  moi = [];
  if (NUTS) for (const n of NUTS) { n.ket = 0; n.tng[0] = n.tng[1] = 0; n.den.cau.fill(0); }
  ketNga = 0;
  trongNgaG[0] = trongNgaG[1] = 0;
  DEN.cau.fill(0);
  for (const a of DS) {
    if (a.loai === 'bo' || a.nhac) continue;
    if (NUTS) vaoNut(a.p.nut | 0);
    if (a.trongNga) { trongNgaG[a.g]++; if (a.sp < 0.3) ketNga++; }
    else if (!a.camKet) { const t = a.p.sStop - a.s - a.len / 2; if (t > -1 && t < 30) DEN.cau[a.arm * 3 + QI[a.quay]]++; } // xe đang tới vạch — đèn AI đếm
  }
  if (NUTS) NUTS.forEach((n, k) => { vaoNut(k); buocDen(dt); }); else buocDen(dt);
  tinhQuyen(dt);
  for (let i = 0; i < DS.length; i++) { const a = DS[i]; if (NUTS) vaoNut(a.p.nut | 0); if (a.loai === 'bo') buocBo(a, dt); else buocXe(a, dt); }
  if (NUTS) { vaoNut(0); ketNga = NUTS.reduce((t, n, k) => t + (k ? n.ket : 0), ketNga); NUTS[0].ket = 0; }
  buocTro(dt);
  for (const a of DS) if (a.loai !== 'bo' && !a.nhac && a.sp < 0.5 && a.s < a.p.sStop) a.tCho = (a.tCho || 0) + dt; // giây đứng chờ trước vạch của từng xe
  if (DIEM) { DIEM.t += dt; DIEM.ket += ketNga * dt; if (ketNga > DIEM.ketMax) DIEM.ketMax = ketNga; }
  const muc = { xm: CAI.matDo, oto: Math.min(MAX_OTO, Math.round(CAI.matDo * CAI.tyLeOto / 100)), bus: 3, bo: CAI.nguoiBo }; // người đi bộ có thanh kéo riêng — không phố nào cũng đông như nhau (anh 22/11/2026)
  const dem = { xm: 0, oto: 0, bus: 0, bo: 0 };
  for (const a of DS) dem[a.loai]++;
  // Giảm mật độ / tỷ lệ ô tô → bớt ngay xe ở rìa bản đồ (xa máy quay, trong sương), không đợi chúng đi hết
  const du = { xm: dem.xm - muc.xm, oto: dem.oto - muc.oto, bo: dem.bo - muc.bo };
  if (du.xm > 0 || du.oto > 0 || du.bo > 0) for (const a of DS) if (du[a.loai] > 0 && !a.trenDuong && (a.loai === 'bo' || a.s < 30 || a.s > a.p.len - 30 || ngoaiKhung(a) || camera.position.distanceTo(VK.set(a.x, 1, a.z)) > 70) && a !== theoXe && !a.nhac && !a.nga) { a.s = a.p.len; a.bot = true; du[a.loai]--; dem[a.loai]--; }
  for (let i = DS.length - 1; i >= 0; i--) if (DS[i].s >= DS[i].p.len - 0.5) {
    const a = DS[i];
    if (!a.bot && a.loai !== 'bo') { QUA_GAN.push(tg); CHO_GAN.push(a.tCho || 0); }
    if (DIEM && !a.bot) { if (a.loai === 'bo') DIEM.bo++; else { DIEM.qua++; DIEM.cho += a.tCho || 0; } } // bị bớt vì giảm mật độ thì không tính là qua
    a.het = true; DS[i] = DS[DS.length - 1]; DS.pop(); }
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
renderer.setPixelRatio(Math.min(devicePixelRatio, DD ? 1.25 : 1.5)); // 2× trên màn Retina = gấp ~1,8 lần điểm ảnh phải tô, nhìn gần như không khác
const TRAN_FPS = +(new URLSearchParams(location.search).get('fps') || 30);
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

const troi = new THREE.HemisphereLight('#dfefff', '#8a7a66', 1.1); scene.add(troi);
const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
sun.position.set(90, 160, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(DD ? 1024 : 2048, DD ? 1024 : 2048);
Object.assign(sun.shadow.camera, HL ? { left: -260, right: 260, top: 560, bottom: -560, near: 10, far: 900 } : { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 500 });
if (HL) { scene.fog.near = 700; scene.fog.far = 1700; camera.far = 1900; camera.updateProjectionMatrix(); controls.maxDistance = 1300; }
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
const geoHang = ghep([[box(0.55, 0.5, 0.62).translate(-0.72, 1.06, 0), '#ffffff'], [box(0.56, 0.012, 0.1).translate(-0.72, 1.312, 0), '#d8c9a0'], [box(0.1, 0.512, 0.632).translate(-0.72, 1.06, 0), '#d8c9a0']]);
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
// mũ bảo hiểm nửa đầu kiểu VN cho bản người thật: vỏ bóng ôm đầu, lưỡi trai ngắn phía trước, quai đen hai bên; gốc = tâm đầu, +x là hướng nhìn
const geoMuT = ghep([
  [new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1.12, 0.92, 0.98), '#ffffff'],
  [new THREE.TorusGeometry(0.118, 0.008, 6, 24).rotateX(Math.PI / 2).scale(1.12, 1, 0.98).translate(0, -0.035, 0), '#dddddd'],
  [new THREE.SphereGeometry(0.1, 12, 4, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.5, 0.06).scale(1.25, 1, 1.15).translate(0.01, -0.03, 0), '#ffffff'],
  [box(0.012, 0.11, 0.01).translate(0.015, -0.09, 0.112), '#202020'], [box(0.012, 0.11, 0.01).translate(0.015, -0.09, -0.112), '#202020'],
]);
const mKhau = inst(new THREE.SphereGeometry(0.098, 12, 8, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.55, Math.PI * 0.25).scale(1, 1.1, 1.08).translate(0.005, -0.01, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX_XM * 2); mKhau.userData.n = 0;
const mMuT = inst(geoMuT, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05 }), MAX_XM * 2); mMuT.userData.n = 0;
const mXm = inst(geoXm, vatLieuMau, MAX_XM), mNguoi = inst(geoNguoi, vatLieuMau, MAX_XM), mMu = inst(geoMu, vatLieu, MAX_XM);
const mCho = inst(geoCho, vatLieuMau, MAX_XM), mHang = inst(geoHang, vatLieuMau, MAX_XM);
const mOto = inst(geoOto, vatLieuMau, MAX_OTO), mMui = inst(geoMui, vatLieuMau, MAX_OTO), mBus = inst(geoBus, vatLieuMau, 16);
const mBo = inst(geoBo, vatLieuMau, 400), mDau = inst(geoDau, vatLieu, 400), mNon = inst(geoNon, vatLieu, 400);
const NON_MAU = new THREE.Color('#e8d7a6');
// Đèn xi nhan (anh 22/11/2026): xe sắp rẽ nháy cam ở góc trước + góc sau phía rẽ, từ ~35 m trước lòng ngã tư tới lúc ra
// Đèn gắn liền thân xe: dựng trong khung toạ độ của chính xe (bên phải, +z), bên trái lật z; vẽ cùng vị trí + góc quay + độ nghiêng của thân
const VL_XN = new THREE.MeshBasicMaterial({ color: '#ffa31a', side: THREE.DoubleSide });
const denXn = (ds) => { const g = mergeGeometries(ds.map(([w, h, d, x, y, z]) => box(w, h, d).translate(x, y, z))); return inst(g, VL_XN, 2 * MAX_XM); };
const XN = {
  // xe máy: góc trên yếm trước + đuôi thân sau
  xm: denXn([[0.08, 0.11, 0.12, 0.5, 0.78, 0.14], [0.08, 0.11, 0.12, -0.68, 0.62, 0.13]]),
  // ô tô: góc đầu, góc đuôi, đèn hông trên vè trước
  oto: denXn([[0.06, 0.13, 0.17, 2.18, 0.74, 0.8], [0.06, 0.13, 0.17, -2.18, 0.74, 0.8], [0.22, 0.08, 0.04, 1.55, 0.86, 0.9]]),
  bus: denXn([[0.06, 0.22, 0.3, 5.28, 0.9, 1.05], [0.06, 0.22, 0.3, -5.28, 0.9, 1.05], [0.34, 0.12, 0.04, 0, 1.0, 1.26]]),
};
const SXN = new THREE.Vector3();
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
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, 2 * (MAX_XM + 900));
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.renderOrder = 1;
  scene.add(m); return m;
})();
const NANG = (() => { const d = sun.position.clone().normalize(), l = Math.hypot(d.x, d.z) / d.y; return { x: d.x / Math.hypot(d.x, d.z) * l, z: d.z / Math.hypot(d.x, d.z) * l, l, g: Math.atan2(-d.z, d.x) }; })();
const SB = new THREE.Vector3(), VY = new THREE.Vector3(), VO = new THREE.Vector3(), VD = new THREE.Vector3();
const CARTON = ['#b8925f', '#a98352', '#c7a676'].map((h) => new THREE.Color(h));
const KHAU = ['#7fb3e0', '#f2f2f2', '#2b2b2b', '#5f8fc4', '#e9a0b4'].map((h) => new THREE.Color(h));
const MU_SAU = ['#e8e8e8', '#c0392b', '#1f3a68', '#f2c94c', '#2d2d2d', '#e88fb0'].map((h) => new THREE.Color(h));
const MUI_TAXI = new THREE.Color('#ffd84a'), DEN_DON = new THREE.Color('#ff5a2a');

// ── mặt đất, vỉa hè, vạch kẻ
const mat0 = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4a4c50' }));
if (HL) { mat0.geometry.dispose(); mat0.geometry = new THREE.PlaneGeometry(1000, 1400).rotateX(-Math.PI / 2); }
mat0.receiveShadow = true; scene.add(mat0);
const SC0 = scene.children.length; // vật dựng cho một nút từ đây → hành lang nhân theo từng nút
const HOP = [], TRU = [], TAN = [], NON = [], PHANG = [], BIEN = [], CAU = [], XM_DO = [];
for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
  const x0 = HW_NS, z0 = HW_EW, x1 = 190, z1 = 190;
  HOP.push([qx * (x0 + x1) / 2, 0.075, qz * (z0 + z1) / 2, x1 - x0, 0.15, z1 - z0, 0, '#b8aa9c']);
  HOP.push([qx * (x0 + x1) / 2, 0.09, qz * (z0 + 0.15), x1 - x0, 0.18, 0.3, 0, '#d9d3c9']); // bó vỉa
  HOP.push([qx * (x0 + 0.15), 0.09, qz * (z0 + z1) / 2, 0.3, 0.18, z1 - z0, 0, '#d9d3c9']);
}
const VANG = '#f2c230', TRANG_V = '#ededed', H2 = Math.SQRT1_2;
// tim đường vàng kép chỉ trên đường hai chiều; đường một chiều thay bằng vạch trắng đứt ở giữa
const motEW = ARMS.some((A) => A.g === 0 && A.mot), motNS = ARMS.some((A) => A.g === 1 && A.mot);
for (const sx of [-1, 1]) {
  const ea = HW_NS + CW, la = L - ea;
  if (!motEW) for (const off of [-0.16, 0.16]) PHANG.push([sx * (ea + la / 2), off, la, 0.12, VANG]);
  else for (let u = ea + 1; u < L; u += 6) PHANG.push([sx * (u + 1.5), 0, 3, 0.13, TRANG_V]);
  const eb = HW_EW + CW, lb = L - eb;
  if (!motNS) for (const off of [-0.16, 0.16]) PHANG.push([off, sx * (eb + lb / 2), 0.12, lb, VANG]);
  else for (let u = eb + 1; u < L; u += 6) PHANG.push([0, sx * (u + 1.5), 0.13, 3, TRANG_V]);
}
for (const arm of ARMS) {
  const d = arm.d, r = right(d), hw = hwAlong(d), e = eAlong(d);
  const lo = loVao(d), st = -(e + CW), cx = st * d[0] + ((hw + lo) / 2) * r[0], cz = st * d[1] + ((hw + lo) / 2) * r[1];
  if (arm.mot !== 'ra') PHANG.push([cx, cz, d[0] ? 0.45 : hw - lo, d[0] ? hw - lo : 0.45, TRANG_V]); // vạch dừng (đường ra một chiều: không có)
  const mid = -(e + CW / 2);
  for (let u = -hw + 0.6; u < hw - 0.3; u += 1.1) {
    const px = mid * d[0] + u * r[0], pz = mid * d[1] + u * r[1];
    PHANG.push([px, pz, d[0] ? 3 : 0.55, d[0] ? 0.55 : 3, TRANG_V]); // vạch qua đường
  }
}

// Vạch chia làn + mũi tên từng làn: vẽ lại từ sổ lanCfg mỗi khi người dùng đổi (veLan, dưới phần dựng cảnh).
const vach = (arr, x, z, vx, vz, l, w, mau) => arr.push([x, z, l, w, mau, Math.atan2(-vz, vx)]);
function muiTen(PHANG, cx, cz, f, sd) { // sd = null: thẳng; [x,z]: hướng rẽ
  const W = 0.22, H = Math.SQRT1_2;
  if (!sd) {
    vach(PHANG, cx - f[0] * 0.4, cz - f[1] * 0.4, f[0], f[1], 2.4, W, TRANG_V);
    const tx = cx + f[0] * 0.85, tz = cz + f[1] * 0.85;
    for (const k of [1, -1]) { const ux = (f[0] + k * f[1]) * H, uz = (f[1] - k * f[0]) * H; vach(PHANG, tx - ux * 0.42, tz - uz * 0.42, ux, uz, 0.95, W, TRANG_V); }
    return;
  }
  vach(PHANG, cx - f[0] * 0.5, cz - f[1] * 0.5, f[0], f[1], 1.8, W, TRANG_V);
  const bx = cx + f[0] * 0.4, bz = cz + f[1] * 0.4;
  vach(PHANG, bx + sd[0] * 0.45, bz + sd[1] * 0.45, sd[0], sd[1], 1.1, W, TRANG_V);
  const tx = bx + sd[0] * 1.0, tz = bz + sd[1] * 1.0;
  for (const k of [1, -1]) { const ux = (sd[0] + k * f[0]) * H, uz = (sd[1] + k * f[1]) * H; vach(PHANG, tx - ux * 0.4, tz - uz * 0.4, ux, uz, 0.9, W, TRANG_V); }
}
// Vạch mắt võng vàng phủ lòng ngã tư: cấm dừng trong ô — hiện khi bật luật "lòng ngã tư kẹt thì chờ ở vạch" (choNga).
const MV = [];
{
  const X = HW_NS, Z = HW_EW, VG = '#f2c230';
  vach(MV, 0, -Z + 0.1, 1, 0, 2 * X, 0.2, VG); vach(MV, 0, Z - 0.1, 1, 0, 2 * X, 0.2, VG);
  vach(MV, -X + 0.1, 0, 0, 1, 2 * Z, 0.2, VG); vach(MV, X - 0.1, 0, 0, 1, 2 * Z, 0.2, VG);
  for (const sg of [1, -1]) for (let c = -(X + Z) + 2.4; c < X + Z - 1; c += 2.4) {
    // đường x − sg·z = c cắt trong hình chữ nhật |x|<X, |z|<Z
    const t0 = Math.max(-X, c - Z * 1), t1 = Math.min(X, c + Z * 1); // x chạy từ t0 tới t1, z = sg·(x − c)
    const a0 = Math.max(t0, sg > 0 ? c - Z : c - Z), a1 = Math.min(t1, c + Z);
    if (a1 - a0 < 0.3) continue;
    const xm = (a0 + a1) / 2, zm = sg * (xm - c), l = (a1 - a0) * Math.SQRT2;
    vach(MV, xm, zm, H2, sg * H2, l, 0.16, VG);
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
const NHA_CT = []; // nhà đã dựng, để bản thật thêm chi tiết mặt tiền
function dayNha(diemF, n, u0, u1) {
  let u = u0;
  while (u < u1) {
    const w = rnd(3.6, 5.6);
    if (Math.random() < 0.08) { u += 2.6; continue; } // hẻm
    const F = diemF(u + w / 2);
    const tang = Math.random() < 0.05 ? 7 + ((Math.random() * 3) | 0) : 2 + ((Math.random() * 4) | 0);
    const h = 4 + (tang - 1) * 3.4, sau = rnd(13, 18), mauNha = chon(NHA);
    NHA_CT.push([F, n, w, tang, Math.random() * 1e9 | 0]);
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
// Ngã tư thật: biển tên phố xanh ở bốn góc + biển hiệu cơ sở thật gắn lên mặt tiền gần chỗ thật nhất (anh 23/11/2026:
// "phải có tên phố ở biển hiệu, các toà nhà hay cửa hàng thực thì mới nhận ra được phố này").
function bienChu(chu, nen, rong, cao, phu) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round((1024 * cao) / rong);
  const g = c.getContext('2d'); g.fillStyle = nen; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#ffffff'; g.lineWidth = c.height * 0.06; g.strokeRect(g.lineWidth, g.lineWidth, c.width - 2 * g.lineWidth, c.height - 2 * g.lineWidth);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let px = c.height * (phu ? 0.42 : 0.58); g.font = `800 ${px}px system-ui, sans-serif`;
  while (g.measureText(chu).width > c.width * 0.9 && px > 10) { px *= 0.93; g.font = `800 ${px}px system-ui, sans-serif`; }
  g.fillText(chu, c.width / 2, c.height * (phu ? 0.4 : 0.52));
  if (phu) { g.font = `600 ${c.height * 0.2}px system-ui, sans-serif`; g.fillText(phu, c.width / 2, c.height * 0.78); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: t });
}
// biển hai mặt: hai tấm một mặt quay lưng nhau → đứng phía nào cũng đọc xuôi (DoubleSide làm mặt sau ngược chữ)
function hai(geo, mat, x, y, z, ry) {
  for (const d of [0, Math.PI]) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry + d; scene.add(m); }
}
function dungBienThat() {
  if (!NGA || !NGA.co) return;
  const cot = new THREE.MeshLambertMaterial({ color: '#5d6166' });
  for (const [kN, nN] of (NUTS || [null]).entries()) { // hành lang: biển tên phố ở mọi nút, biển cơ sở thật chỉ quanh nút Trần Hưng Đạo
  const dz = nN ? nN.z : 0, phuong = nN ? '' : NGA.phuong;
  const mEW = bienChu(nN ? nN.ten : NGA.pho[0], '#1546a0', 2.4, 0.6, phuong), mNS = bienChu(NGA.pho[1], '#1546a0', 2.4, 0.6, phuong);
  for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
    const x = qx * (HW_NS + 0.9), z = qz * (HW_EW + 0.9) + dz;
    const tru = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), cot); tru.position.set(x, 1.7, z); scene.add(tru);
    const gb = new THREE.PlaneGeometry(2.4, 0.6);
    hai(gb, mEW, x + qx * 1.25, 3.05, z, 0); // dọc Trần Hưng Đạo
    hai(gb, mNS, x, 3.75, z + qz * 1.25, Math.PI / 2);
  }
  if (nN && kN !== HL.thd) continue;
  const k = (NGA.xoay * Math.PI) / 180, cs = Math.cos(k), sn = Math.sin(k), dung = new Set();
  for (const [e, nb, chu, nen] of NGA.co) {
    const x = e * cs + nb * sn, z = -(-e * sn + nb * cs) + dz;
    let tot = -1, dm = 40;
    NHA_CT.forEach(([F], i) => { const dd = Math.hypot(F[0] - x, F[1] - z); if (dd < dm && !dung.has(i)) { dm = dd; tot = i; } });
    if (tot < 0) continue;
    dung.add(tot); BIEN[tot][3] = BIEN[tot][4] = 0.001; // nhà có biển thật → giấu biển ngẫu nhiên
    const [F, n, w] = NHA_CT[tot], p = theo(F, n, 0, 0.42), rw = Math.max(3, w - 0.3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rw, 1.05), bienChu(chu, nen, rw, 1.05)); m.position.set(p[0], 3.3, p[1]); m.rotation.y = Math.atan2(n[0], n[1]); scene.add(m);
  }
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
      // tán cây = cụm 7 chùm lá lệch nhau, đậm nhạt khác nhau (một quả cầu trơn nhìn như kẹo mút)
      const R = rnd(1.8, 2.7), la = new THREE.Color(chon(LA));
      for (let j = 0; j < 7; j++) { const g = (j / 7) * Math.PI * 2 + rnd(-0.4, 0.4), d = j ? R * rnd(0.45, 0.7) : 0, r = R * (j ? rnd(0.5, 0.72) : 0.75);
        TAN.push([P[0] + Math.cos(g) * d, 4.3 + (j ? rnd(-0.5, 0.7) : 0.5), P[1] + Math.sin(g) * d, r, '#' + la.clone().offsetHSL(rnd(-0.02, 0.02), 0, rnd(-0.07, 0.06)).getHexString(), rnd(0, 6)]); }
      TRU.push([P[0] + 0.5, 3.3, P[1], 0.07, 1.6, '#5a3d27']); TRU.push([P[0] - 0.45, 3.5, P[1] + 0.3, 0.06, 1.4, '#5a3d27']);
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

// ── hành lang: cảnh vừa dựng là của một nút ở gốc toạ độ → nhân cho từng nút, mỗi bản chỉ giữ phần trong khoảng z của nút
if (NUTS) {
  const N = NUTS.length;
  const nhan = (arr, iz, iXoay, iDai) => { // iXoay: chỉ số góc xoay; iDai: chỉ số bề dài theo z (khối không xoay thì cắt)
    const goc = arr.splice(0);
    for (let k = 0; k < N; k++) {
      const [lo, hi] = phamNut(k), dz = NUTS[k].z;
      for (const b of goc) {
        const z = b[iz];
        if (iXoay >= 0 && !(b[iXoay] || 0)) { // khối không xoay: cắt theo khoảng z
          const sz = b[iDai], z0 = Math.max(lo, z - sz / 2), z1 = Math.min(hi, z + sz / 2);
          if (z1 - z0 < 0.3) continue;
          const c = b.slice(); c[iz] = (z0 + z1) / 2 + dz; c[iDai] = z1 - z0; arr.push(c); continue;
        }
        if (z >= lo && z < hi) { const c = b.slice(); c[iz] = z + dz; arr.push(c); }
      }
    }
  };
  nhan(HOP, 2, 6, 5); nhan(PHANG, 1, 5, 3); for (const A of [TRU, TAN, NON, BIEN]) nhan(A, 2, -1); nhan(XM_DO, 1, -1); nhan(MV, 1, -1);
  { const goc = NHA_CT.splice(0); for (let k = 0; k < N; k++) { const [lo, hi] = phamNut(k); for (const b of goc) if (b[0][1] >= lo && b[0][1] < hi) NHA_CT.push([[b[0][0], b[0][1] + NUTS[k].z], ...b.slice(1)]); } }
  { const goc = CAU.splice(0); for (let k = 0; k < N; k++) { const [lo, hi] = phamNut(k); for (let i = 0; i < goc.length; i += 6) if (goc[i + 2] >= lo && goc[i + 2] < hi) for (let j = 0; j < 6; j++) CAU.push(goc[i + j] + (j % 3 === 2 ? NUTS[k].z : 0)); } }
  const vat = scene.children.slice(SC0);
  for (let k = 1; k < N; k++) for (const o of vat) { const c = o.clone(); c.position.z += NUTS[k].z; scene.add(c); }
  for (const o of vat) o.position.z += NUTS[0].z;
}
// ── cột đèn giao thông + đồng hồ đếm ngược
const DEN_ARM = [];
const MAU_DEN = { d: ['#ff2a1f', '#3b1010'], v: ['#ffc21a', '#3b3010'], x: ['#2bff5e', '#0f3b18'] };
for (const [kN, nN] of (NUTS || [null]).entries()) { if (nN) vaoNut(kN); // mỗi nút một bộ cột đèn
for (const arm of ARMS) {
  const d = arm.d, r = right(d), hw = hwAlong(d), e = eAlong(d), n = neg(d);
  const B = [-(e + CW + 1) * d[0] + (hw + 1.2) * r[0], -(e + CW + 1) * d[1] + (hw + 1.2) * r[1] + (nN ? NZ : 0)];
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
    DEN_ARM.push({ mv, den3, c, tex, m: '', n: '', nut: kN });
  }
}
}
vaoNut(0);
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
    if (NUTS) vaoNut(a.nut);
    const [m, con] = den(a.mv);
    const n = con > 98 || (CAI.denAI && m === 'x') ? '--' : String(Math.min(99, Math.ceil(con))).padStart(2, '0');
    const t = trai && a.mv % 3 === QI.trai;
    if (m !== a.m) { for (const k of ['d', 'v', 'x']) a.den3[k].color.set(MAU_DEN[k][k === m ? 0 : 1]); a.m = m; a.n = ''; }
    if (n + t !== a.n) { veSo(a.c, m, n, t); a.tex.needsUpdate = true; a.n = n + t; }
  }
  vaoNut(0);
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
const mHop = tinh(box(1, 1, 1), HOP, (b) => { Q.setFromAxisAngle(UP, b[6]); M4.compose(V.set(b[0], b[1], b[2]), Q, S3.set(b[3], b[4], b[5])); CL.set(b[7]); });
tinh(new THREE.CylinderGeometry(1, 1, 1, 12), TRU, (b) => { M4.compose(V.set(b[0], b[1], b[2]), Q.identity(), S3.set(b[3], b[4], b[3])); CL.set(b[5]); });
{ // chùm lá: khối 20 mặt gồ ghề (đỉnh xô lệch ngẫu nhiên cố định) → bóng sáng tối lốm đốm như tán lá
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, mo = new Map();
  for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; if (!mo.has(k)) mo.set(k, 0.82 + Math.random() * 0.3); const f = mo.get(k); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); }
  g.computeVertexNormals();
  tinh(g, TAN, (b) => { Q.setFromAxisAngle(UP, b[5] || 0); M4.compose(V.set(b[0], b[1], b[2]), Q, S3.set(b[3], b[3] * 0.8, b[3])); CL.set(b[4]); });
}
tinh(new THREE.ConeGeometry(1, 1, 16), NON, (b) => { M4.compose(V.set(b[0], b[1], b[2]), Q.identity(), S3.set(b[3], b[4], b[3])); CL.set(b[5]); });
{
  const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -2 }), PHANG.length);
  PHANG.forEach((b, i) => { Q.setFromAxisAngle(UP, b[5] || 0); M4.compose(V.set(b[0], 0.02, b[1]), Q, S3.set(b[2], 1, b[3])); m.setMatrixAt(i, M4); m.setColorAt(i, CL.set(b[4])); });
  m.receiveShadow = true; scene.add(m);
}
const MV_MESH = (() => {
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -3 }), MV.length);
  MV.forEach((b, i) => { Q.setFromAxisAngle(UP, b[5] || 0); M4.compose(V.set(b[0], 0.025, b[1]), Q, S3.set(b[2], 1, b[3])); m.setMatrixAt(i, M4); m.setColorAt(i, CL.set(b[4])); });
  m.receiveShadow = true; m.visible = CAI.choNga; scene.add(m); return m;
})();
// Vạch dẫn hướng rẽ trái trong lòng ngã tư (anh 22/11/2026: "đoạn giữa đường cũng phải kẻ vạch"): nét đứt theo mép
// trong làn rẽ trái của mỗi hướng — mép phía luồng rẽ trái đối diện. Hai nét đối diện kẹp khoảng trống giữa hai luồng.
function danReTrai(PHANG) {
for (const arm of ARMS) {
  if (arm.mot === 'ra' || nhanhRa(neg(right(arm.d)))?.mot === 'vao') continue; // một chiều: không có luồng rẽ trái này
  const d = arm.d, hw = hwAlong(d), p = taoDuongXe(d, neg(right(d)), loVao(d) + (hw - loVao(d)) * 0.0625, 1.2);
  const n = p.s.length;
  for (let u = p.sIn + 0.6; u < p.sOut - 0.6; u += 1.6) {
    let i = 0; while (i < n - 2 && p.s[i + 1] < u) i++;
    const t = (u - p.s[i]) / (p.s[i + 1] - p.s[i] || 1);
    const x = p.x[i] + (p.x[i + 1] - p.x[i]) * t, z = p.z[i] + (p.z[i + 1] - p.z[i]) * t;
    const tx = p.tx[i], tz = p.tz[i], ng = 0.55; // dời sang mép trong (phía trái xe đang rẽ)
    PHANG.push([x + tz * ng, z - tx * ng, 0.8, 0.12, TRANG_V, Math.atan2(-tz, tx)]);
  }
}
}
// Vạch theo sổ lanCfg: nửa đường chiều vào của mỗi hướng — vạch chia làn (đứt / liền / không, đoạn `dai` m trước vạch
// dừng; xa hơn luôn đứt), mũi tên theo công năng làn (làn tự do không kẻ), vạch dẫn rẽ trái trong lòng ngã tư.
let LAN_MESH = null;
// ── đèn mũi tên trên từng làn: hướng nào có làn chuyên (không tự do) thì dựng giá ngang trên vạch dừng, mỗi làn một mặt đèn
// mang đúng mũi tên các hướng làn đó được đi, mỗi mũi tên sáng màu đèn của chính hướng ấy (xe trong làn vẫn chạy theo đèn hướng mình).
const DEN_LAN = new THREE.Group(); scene.add(DEN_LAN);
const MAT_GIA = new THREE.MeshLambertMaterial({ color: '#5f6368' });
let MAT_DEN = [];
function veDenLan() {
  for (const c of DEN_LAN.children) { c.geometry.dispose(); if (c.material !== MAT_GIA) { c.material.map?.dispose(); c.material.dispose(); } }
  DEN_LAN.clear(); MAT_DEN = [];
  if (!CAI.denLan) return;
  ARMS.forEach((arm, ia) => {
    const h = CAI.lanCfg[ia]; if (h.lan.every((c) => c === 'tudo')) return;
    const d = arm.d, r = right(d), n = neg(d), hw = hwAlong(d), u = eAlong(d) + CW + 1;
    const at = (b) => [-u * d[0] + b * r[0], -u * d[1] + b * r[1]];
    const [gx, gz] = at((hw + loVao(d) + 1.2) / 2), gia = new THREE.Mesh(new THREE.BoxGeometry(hw - loVao(d) + 1.6, 0.16, 0.16), MAT_GIA);
    gia.position.set(gx, 6.1, gz); gia.rotation.y = Math.atan2(-r[1], r[0]); DEN_LAN.add(gia);
    h.lan.forEach((cn, i) => {
      const [l0, l1] = lanKhoang(h, i, hw, loVao(d)), [x, z] = at((l0 + l1) / 2);
      const qs = cn === 'tudo' ? ['trai', 'thang', 'phai'] : cn.split('-');
      const c = document.createElement('canvas'); c.width = 64 * qs.length; c.height = 64;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const w = Math.min(0.55 * qs.length, (l1 - l0) * 0.9);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / qs.length), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(x, 5.65, z); m.rotation.y = Math.atan2(n[0], n[1]); DEN_LAN.add(m);
      MAT_DEN.push({ c, tex, mv: qs.map((q) => ia * 3 + QI[q]), qs, k: '' });
    });
  });
}
// mũi tên vẽ tay trên canvas (không phụ thuộc phông có ký tự ↰ ↱): góc 0 = lên (đi thẳng), -90° = trái, +90° = phải
function muiTenDen(x, cx, goc, mau) {
  x.save(); x.translate(cx, 32); x.rotate(goc); x.fillStyle = mau;
  x.fillRect(-5, -6, 10, 26); x.beginPath(); x.moveTo(0, -24); x.lineTo(16, -4); x.lineTo(-16, -4); x.closePath(); x.fill(); x.restore();
}
function capNhatDenLan() {
  for (const o of MAT_DEN) {
    const ms = o.mv.map((k) => den(k)[0]), key = ms.join('');
    if (key === o.k) continue;
    o.k = key; const x = o.c.getContext('2d');
    x.fillStyle = '#060606'; x.fillRect(0, 0, o.c.width, 64);
    o.qs.forEach((q, j) => muiTenDen(x, 32 + 64 * j, q === 'thang' ? 0 : q === 'trai' ? -Math.PI / 2 : Math.PI / 2, MAU_DEN[ms[j]][0]));
    o.tex.needsUpdate = true;
  }
}
function veLan() {
  const A = [];
  ARMS.forEach((arm, ia) => {
    if (arm.mot === 'ra') return; // đường ra một chiều: không có làn vào
    const h = CAI.lanCfg[ia], d = arm.d, r = right(d), hw = hwAlong(d), e0 = eAlong(d) + CW, lo = loVao(d);
    const at = (u, b) => [-u * d[0] + b * r[0], -u * d[1] + b * r[1]];
    for (let k = 1; k < h.soLan; k++) {
      const b = lo + (k * (hw - lo)) / h.soLan;
      if (h.vach === 'lien') { const [x, z] = at(e0 + h.dai / 2, b); vach(A, x, z, d[0], d[1], h.dai, 0.15, TRANG_V); }
      for (let u = e0 + 1; u < L; u += 6) {
        if (u < e0 + h.dai && h.vach !== 'dut') continue;
        const [x, z] = at(u + 1.5, b); vach(A, x, z, d[0], d[1], 3, 0.13, TRANG_V);
      }
    }
    h.lan.forEach((cn, i) => {
      if (cn === 'tudo') return;
      const [l0, l1] = lanKhoang(h, i, hw, lo), c = (l0 + l1) / 2;
      for (const k of h.dai >= 16 ? [6, h.dai - 6] : [6]) {
        const [x, z] = at(e0 + k, c);
        for (const q of cn.split('-')) muiTen(A, x, z, d, q === 'thang' ? null : q === 'phai' ? r : neg(r));
      }
    });
  });
  if (CAI.danTrai) danReTrai(A);
  if (NUTS) { const B = A.splice(0); NUTS.forEach((n, k) => { const [lo, hi] = phamNut(k); for (const b of B) if (b[1] >= lo && b[1] < hi) { const c = b.slice(); c[1] += n.z; A.push(c); } }); }
  veDenLan();
  if (LAN_MESH) { scene.remove(LAN_MESH); LAN_MESH.geometry.dispose(); LAN_MESH.material.dispose(); LAN_MESH = null; }
  if (!A.length) return;
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -2 }), A.length);
  A.forEach((b, i) => { Q.setFromAxisAngle(UP, b[5] || 0); M4.compose(V.set(b[0], 0.02, b[1]), Q, S3.set(b[2], 1, b[3])); m.setMatrixAt(i, M4); m.setColorAt(i, CL.set(b[4])); });
  m.receiveShadow = true; scene.add(m); LAN_MESH = m;
}
dungBienThat();
veLan();
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
  let ix = 0, io = 0, ib = 0, ip = 0, is = 0; const nx = { xm: 0, oto: 0, bus: 0 };
  veXm.length = 0; veOto.length = 0; veBus.length = 0; veBo.length = 0;
  for (const a of DS) {
    if (is < MAX_XM + 900) { Q.setFromAxisAngle(UP, a.goc); V.set(a.x, a.nhac ? 0.03 : a.y + 0.03, a.z); datMa(mBong, is++, V, Q, a.loai === 'bo' ? SB.set(0.75, 1, 0.75) : SB.set(a.len * 1.15, 1, a.wid * 1.7));
      // bản thật: thêm bóng đổ dài theo hướng nắng (cao vật × độ nghiêng nắng), như bóng thật trên mặt nhựa
      if (THAT.on && is < 2 * (MAX_XM + 900)) { const h = a.loai === 'bo' || a.loai === 'xm' ? 1.7 : a.loai === 'bus' ? 3.2 : 1.5; V.x -= NANG.x * h * 0.5; V.z -= NANG.z * h * 0.5; V.y += 0.002; Q.setFromAxisAngle(UP, NANG.g); datMa(mBong, is++, V, Q, SB.set(h * NANG.l + (a.loai === 'bo' ? 0.4 : a.len * 0.6), 1, a.loai === 'bo' ? 0.55 : a.wid * 1.2)); } }
    if (a.loai === 'bo') {
      Q.setFromAxisAngle(UP, a.goc);
      V.set(a.x, a.y + Math.abs(Math.sin(a.buoc)) * 0.04, a.z);
      if (a.lac) { Q.multiply(Q2.setFromAxisAngle(TRUC_X, a.lac)); V.y += 0.12 * Math.abs(Math.sin(a.lac)); }
      veBo[ip] = a;
      if (NG.on) { if (NGT.ok) { const k = NGT.ds[(a.mau ??= (Math.random() * 1e6) | 0) % NGT.ds.length], di = a.sp > 0.05 && !a.nga; const m = k.m[di ? Math.floor((((a.buoc / (Math.PI * 2)) % 1) + 1) % 1 * NGT.buoc) % NGT.buoc : NGT.buoc]; datMa(m, m.userData.n++, V, Q, MOT, uot(a.c2, a)); } else veNguoi(V, Q, a, ip, uot(a.c2, a)); }
      datMa(mBo, ip, V, Q, MOT, uot(a.c2, a)); datMa(mDau, ip, V, Q, MOT, uot(a.c3, a)); datMa(mNon, ip, V, Q, a.non ? MOT : KHONG, NON_MAU);
      ip++; continue;
    }
    const ben = xiNhan(a);
    Q.setFromAxisAngle(UP, a.goc);
    V.set(a.x, a.y + (a.lac ? (a.wid / 2) * Math.abs(Math.sin(a.lac)) : 0), a.z); // nằm nghiêng: nhấc thân lên để không chìm xuống mặt đường
    if (a.loai !== 'xm' && a.lac) Q.multiply(Q2.setFromAxisAngle(TRUC_X, a.lac));
    if (a.loai === 'xm') {
      if (ix >= MAX_XM) continue;
      Q2.setFromAxisAngle(TRUC_X, a.nghieng); Q.multiply(Q2);
      if (XMT.on) { const k = XMT.ds[(a.mau ??= (Math.random() * 1e6) | 0) % XMT.ds.length]; datMa(k.t, k.n, V, Q, MOT, uot(a.c1, a)); datMa(k.f, k.n++, V, Q, MOT); }
      // bản thật: người lái đặt hông vào yên đo của mẫu xe; mũ đi theo đầu người lái; người ngồi sau là người thật (mẫu khác) lùi 0,36 m, cao hơn 0,05
      const nThat = NG.on && NGT.ok, yen = nThat && XMT.on ? XMT.ds[(a.mau ??= (Math.random() * 1e6) | 0) % XMT.ds.length].yen : null;
      VY.copy(V); if (yen) VY.add(VO.copy(yen).applyQuaternion(Q));
      if (nThat) {
        const mau = (a.mau ??= (Math.random() * 1e6) | 0), m = NGT.ds[mau % NGT.ds.length].m[NGT.buoc + 1]; datMa(m, m.userData.n++, VY, Q, MOT, uot(a.c2, a));
        const d1 = NGT.ds[mau % NGT.ds.length].dau; if (d1) { datMa(mMuT, mMuT.userData.n++, VD.copy(d1.v).applyQuaternion(Q).add(VY), Q, d1.s, uot(a.c3, a)); if (mau % 5 < 3) datMa(mKhau, mKhau.userData.n++, VD.copy(d1.v).add(VO.set(0.0, 0.0, 0)).applyQuaternion(Q).add(VY), Q, d1.s, KHAU[mau % KHAU.length]); }
        if (a.cho) { const k2 = NGT.ds[(mau + 1) % NGT.ds.length], m2 = k2.m[NGT.buoc + 1]; VO.set(-0.36, 0.05, 0).applyQuaternion(Q).add(VY); datMa(m2, m2.userData.n++, VO, Q, MOT, uot(a.c4, a));
          if (k2.dau && mau % 4) datMa(mMuT, mMuT.userData.n++, VD.copy(k2.dau.v).applyQuaternion(Q).add(VO), Q, k2.dau.s, MU_SAU[mau % MU_SAU.length]); }
      }
      datMa(mXm, ix, V, Q, MOT, uot(a.c1, a)); datMa(mNguoi, ix, V, Q, MOT, uot(a.c2, a)); datMa(mMu, ix, VY, Q, nThat ? KHONG : MOT, uot(a.c3, a));
      datMa(mCho, ix, V, Q, a.cho && !nThat ? MOT : KHONG, a.c4); datMa(mHang, ix, VY, Q, a.hang && !(nThat && a.cho) ? MOT : KHONG, nThat ? CARTON[(a.mau ?? 0) % CARTON.length] : a.c5);
      if (ben) datMa(XN.xm, nx.xm++, V, Q, SXN.set(1, 1, ben));
      veXm[ix] = a; ix++;
    } else if (a.loai === 'oto') { veOto[io] = a; datMa(mMui, io, V, Q, a.taxi ? MOT : KHONG, a.dangDon ? DEN_DON : MUI_TAXI); datMa(mOto, io++, V, Q, MOT, uot(a.c1, a)); if (OTT.on) { const k = a.taxi && OTT.taxi ? OTT.taxi : OTT.ds[(a.mau ??= (Math.random() * 1e6) | 0) % OTT.ds.length]; datMa(k.t, k.n, V, Q, MOT, uot(a.c1, a)); datMa(k.f, k.n++, V, Q, MOT); } if (ben) datMa(XN.oto, nx.oto++, V, Q, SXN.set(1, 1, ben)); }
    else { veBus[ib] = a; datMa(mBus, ib++, V, Q, MOT, uot(a.c1, a)); if (OTT.on && OTT.bus) { const k = OTT.bus; datMa(k.t, k.n, V, Q, MOT, uot(a.cb ??= new THREE.Color(chon(SON_BUS)), a)); datMa(k.f, k.n++, V, Q, MOT); } if (ben) datMa(XN.bus, nx.bus++, V, Q, SXN.set(1, 1, ben)); }
  }
  mKhau.count = mKhau.userData.n; mKhau.userData.n = 0; mKhau.instanceMatrix.needsUpdate = true; if (mKhau.instanceColor) mKhau.instanceColor.needsUpdate = true;
  mMuT.count = mMuT.userData.n; mMuT.userData.n = 0; mMuT.instanceMatrix.needsUpdate = true; if (mMuT.instanceColor) mMuT.instanceColor.needsUpdate = true;
  if (NG.on && NGT.ok) for (const k of NGT.ds) for (const m of k.m) { m.count = m.userData.n; m.userData.n = 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  if (NG.on) { for (const [m, c] of [[NG.than, ip], [NG.tay, ip * 2], [NG.chan, ip * 2]]) { m.count = c; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
  if (OTT.on) for (const k of OTT.tat) { for (const m of [k.t, k.f]) { m.count = k.n; m.instanceMatrix.needsUpdate = true; } k.t.instanceColor.needsUpdate = true; k.n = 0; }
  if (XMT.on) for (const k of XMT.ds) { for (const m of [k.t, k.f]) { m.count = k.n; m.instanceMatrix.needsUpdate = true; } k.t.instanceColor.needsUpdate = true; k.n = 0; }
  for (const [m, n] of [[mXm, ix], [mNguoi, ix], [mMu, ix], [mCho, ix], [mHang, ix], [mOto, io], [mMui, io], [mBus, ib], [mBo, ip], [mDau, ip], [mNon, ip], [mBong, is], [XN.xm, nx.xm], [XN.oto, nx.oto], [XN.bus, nx.bus]]) {
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
if (HL) { // bao cả ~750 m hành lang; góc phố đặt ở nút Trần Hưng Đạo
  const z1 = HL.z[HL.thd];
  CAM.tong = [[430, 340, 260], [0, 0, 0]]; CAM.tren = [[0.1, 640, 0.1], [0, 0, 0]];
  CAM.goc = [[-(HW_NS + 3.4), 4.2, HW_EW + 5 + z1], [6, 0.8, -4 + z1]];
}
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
// Bảng "Làn & vạch": chọn hướng (hoặc cả 4) → số làn, công năng từng làn, kiểu vạch, độ dài; mẫu nhanh áp cho hướng đang chọn.
let lanChon = 'ca';
const lanDang = () => (lanChon === 'ca' ? [0, 1, 2, 3] : [+lanChon]);
function hienLan() {
  const h = CAI.lanCfg[lanDang()[0]], khac = lanChon === 'ca' && CAI.lanCfg.some((x) => JSON.stringify(x) !== JSON.stringify(h));
  $('lanSo').value = h.soLan; $('lanVach').value = h.vach; $('lanDai').value = h.dai; $('vLanDai').textContent = h.dai + ' m';
  $('lanKhac').hidden = !khac;
  $('lanDs').innerHTML = h.lan.map((c, i) => `<label>Làn ${i + 1} ${i === 0 ? '(sát tim đường)' : i === h.soLan - 1 ? '(sát lề)' : ''}<select data-lan="${i}">`
    + Object.entries(CONG_NANG).map(([k, t]) => `<option value="${k}"${k === c ? ' selected' : ''}>${t}</option>`).join('') + '</select></label>').join('');
}
function doiLan(f) { for (const i of lanDang()) f(CAI.lanCfg[i]); veLan(); hienLan(); luuTuyChon(); if (chinh) veChinh(); }
function hienTuyChon() {
  $('md').value = CAI.matDo; $('vMd').textContent = CAI.matDo;
  $('lieu').value = Math.round(CAI.lieu * 100); $('vLieu').textContent = Math.round(CAI.lieu * 100) + '%';
  $('oto').value = CAI.tyLeOto; $('vOto').textContent = CAI.tyLeOto + '%';
  $('nb').value = CAI.nguoiBo; $('vNb').textContent = CAI.nguoiBo; MV_MESH.visible = CAI.choNga; $('dt').checked = CAI.danTrai; $('dl').checked = CAI.denLan; hienLan();
  $('rp').checked = CAI.rePhai; $('cn').checked = CAI.choNga; $('nl').checked = CAI.nhuongLoi; $('lt').checked = CAI.lanTrai; $('toc').textContent = chuToc();
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
$('cn').addEventListener('change', (e) => { CAI.choNga = e.target.checked; MV_MESH.visible = CAI.choNga; luuTuyChon(); });
$('nb').addEventListener('input', (e) => { CAI.nguoiBo = +e.target.value; $('vNb').textContent = CAI.nguoiBo; luuTuyChon(); });
$('nl').addEventListener('change', (e) => { CAI.nhuongLoi = e.target.checked; luuTuyChon(); });
$('lt').addEventListener('change', (e) => { CAI.lanTrai = e.target.checked; luuTuyChon(); });
$('lanHuong').addEventListener('change', (e) => { lanChon = e.target.value; hienLan(); });
$('lanMau').addEventListener('change', (e) => { const k = e.target.value; e.target.value = ''; if (k) doiLan((h) => Object.assign(h, structuredClone(MAU_LAN[k].h))); });
$('lanSo').addEventListener('change', (e) => doiLan((h) => { const n = +e.target.value; h.lan = Array.from({ length: n }, (_, i) => h.lan[i] || 'tudo'); h.soLan = n; }));
$('lanVach').addEventListener('change', (e) => doiLan((h) => { h.vach = e.target.value; }));
$('lanDai').addEventListener('input', (e) => doiLan((h) => { h.dai = +e.target.value; }));
$('lanDs').addEventListener('change', (e) => { const i = +e.target.dataset.lan; if (e.target.dataset.lan != null) doiLan((h) => { if (i < h.soLan) h.lan[i] = e.target.value; }); });
$('dt').addEventListener('change', (e) => { CAI.danTrai = e.target.checked; veLan(); luuTuyChon(); });
$('dl').addEventListener('change', (e) => { CAI.denLan = e.target.checked; veLan(); luuTuyChon(); });
$('chiaSe').addEventListener('click', async () => {
  const u = new URL(location.href); u.hash = 'pa=' + maPA();
  const o = $('linkPA'); o.hidden = false; o.value = u.href; o.select();
  try { await navigator.clipboard.writeText(u.href); $('chiaSe').textContent = '✓ Đã chép link'; } catch { $('chiaSe').textContent = 'Chép link ô dưới'; }
  setTimeout(() => ($('chiaSe').textContent = '🔗 Chép link phương án này'), 2500);
});
if (PA_LINK) { luuTuyChon(); history.replaceState(null, '', location.pathname + location.search); } // đã nạp vào máy này → bỏ #pa để sửa tiếp không bị link cũ đè khi F5

$('macdinh').addEventListener('click', () => {
  const doiPha = CAI.kieuPha !== MAC_DINH.kieuPha;
  Object.assign(CAI, MAC_DINH, { lanCfg: structuredClone(MAC_DINH.lanCfg) });
  veLan();
  try { localStorage.removeItem(KHOA_LUU); } catch {}
  if (doiPha) dungPha();
  hienTuyChon();
});
// Ngăn đang mở (⚙ trên điện thoại + các mục gập) nằm trên URL ?mo=… để F5 vẫn y nguyên.
const NGAN = new Set((new URLSearchParams(location.search).get('mo') || '').split(',').filter(Boolean));
const ghiNgan = () => { const u = new URL(location.href); if (NGAN.size) u.searchParams.set('mo', [...NGAN].join(',')); else u.searchParams.delete('mo'); history.replaceState(null, '', u); };
const ben = document.querySelector('.ben');
ben.classList.toggle('mo-ra', NGAN.has('ben'));
{ // thu gọn bảng điều khiển (mọi cỡ màn), nhớ theo từng người xem
  const KG = 'ngatu-gon', datGon = (g) => { ben.classList.toggle('gon', g); const b = $('gon'); b.textContent = g ? '▾' : '▴'; b.title = g ? 'Mở lại bảng điều khiển' : 'Thu gọn bảng để xem toàn cảnh'; try { localStorage.setItem(KG, g ? '1' : ''); } catch {} };
  let g0 = false; try { g0 = localStorage.getItem(KG) === '1'; } catch {}
  datGon(g0); $('gon').addEventListener('click', () => datGon(!ben.classList.contains('gon')));
}
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
  if (Math.abs(P[0]) > L - 10 || Math.abs(P[1]) > (HL ? 500 : L - 10)) return;
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
  if (cong === 'chuoi') { const d = diemDat(e); if (d) thaChuoi(d[0], d[1]); return; }
  if (cong === 'nuoc') { const d = a ? [a.x, a.z] : diemDat(e); if (d) doiNuoc(d[0], d[1], a); return; }
  if (!a) { if (SUA) moChinh(e); return; } // chỉnh làn / vạch / lòng ngã tư = điều tiết → chỉ khi bật 🛠
  dongChinh();
  if (cong === 'nhac') nhac(a);
  else if (cong === 'nga') dayNga(a);
  else if (cong === 'theo') { theoXe = a; datCam('theo'); theoXe = a; }
});
// ── Bấm thẳng vào đường để chỉnh (anh 22/11/2026: "option phải bấm vào đối tượng mới trực quan"): bấm vào một làn → ô
// chỉnh công năng làn đó + số làn của hướng; bấm vào vạch chia làn → kiểu vạch + độ dài; bấm lòng ngã tư → mắt võng,
// vạch dẫn rẽ trái. Chỗ đang chỉnh được tô vàng trên mặt đường. Cùng sổ lanCfg với bảng "Làn & vạch" bên phải.
const SANG = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.32, depthWrite: false }));
SANG.position.y = 0.04; SANG.renderOrder = 8; SANG.visible = false; scene.add(SANG);
let chinh = null; // { loai: 'lan' | 'vach' | 'nga', ia, i }
function trungDat([x, z]) {
  if (Math.abs(x) < HW_NS && Math.abs(z) < HW_EW) return { loai: 'nga' };
  for (let ia = 0; ia < ARMS.length; ia++) {
    const d = ARMS[ia].d, r = right(d), hw = hwAlong(d), t = x * d[0] + z * d[1], b = x * r[0] + z * r[1];
    const lo = loVao(d);
    if (ARMS[ia].mot === 'ra' || t > -eAlong(d) || b < lo || b > hw) continue;
    const h = CAI.lanCfg[ia], w = (hw - lo) / h.soLan, k = Math.round((b - lo) / w);
    if (k > 0 && k < h.soLan && Math.abs(b - k * w) < 0.45) return { loai: 'vach', ia, i: k };
    return { loai: 'lan', ia, i: Math.min(h.soLan - 1, Math.floor((b - lo) / w)) };
  }
  return null;
}
// Tô một vùng bấm được lên mặt đường: lòng ngã tư / một làn / một vạch chia làn (đoạn trước vạch dừng).
function toVung(m, t) {
  if (!t) { m.visible = false; return; }
  if (t.loai === 'nga') { m.position.set(0, m.position.y, 0); m.scale.set(2 * HW_NS, 1, 2 * HW_EW); m.visible = true; return; }
  const h = CAI.lanCfg[t.ia], d = ARMS[t.ia].d, r = right(d), hw = hwAlong(d), e0 = eAlong(d) + CW;
  if (t.loai === 'lan' && t.i >= h.soLan) t.i = h.soLan - 1;
  const lo = loVao(d), [l0, l1] = t.loai === 'lan' ? lanKhoang(h, t.i, hw, lo) : [lo + (t.i * (hw - lo)) / h.soLan - 0.3, lo + (t.i * (hw - lo)) / h.soLan + 0.3];
  const dai = Math.max(h.dai, 12), u = e0 + dai / 2, c = (l0 + l1) / 2;
  m.position.set(-u * d[0] + c * r[0], m.position.y, -u * d[1] + c * r[1]);
  m.scale.set(d[0] ? dai : l1 - l0, 1, d[0] ? l1 - l0 : dai); m.visible = true;
}
const toSang = () => toVung(SANG, chinh);
// Rê chuột (anh 22/11/2026: "cái nào bấm được thì khi hover vào highlight nó lên"): xe / người → vòng sáng dưới chân,
// làn / vạch / lòng ngã tư → tô nhạt vùng đó; con trỏ thành bàn tay. Không chạy khi đang kéo xoay hay trên màn cảm ứng.
const RE = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0.3, depthWrite: false }));
RE.position.y = 0.035; RE.renderOrder = 7; RE.visible = false; scene.add(RE);
const VONG = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
VONG.renderOrder = 9; VONG.visible = false; scene.add(VONG);
let reXe = null, reCho = 0, reE = null;
function reVao() {
  reCho = 0;
  const e = reE; reXe = null; RE.visible = false;
  if (!e) { cv.style.cursor = ''; return; }
  const a = chonXe(e);
  if (a && !a.het) { reXe = a; cv.style.cursor = 'pointer'; return; }
  const P = SUA && diemDat(e), t = P && trungDat(P); // tô làn / vạch chỉ khi đang điều tiết
  if (t && !(chinh && JSON.stringify(t) === JSON.stringify(chinh))) toVung(RE, t);
  cv.style.cursor = t ? 'pointer' : '';
}
cv.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' || e.buttons) { reE = null; } else reE = e;
  if (!reCho) reCho = setTimeout(reVao, 60);
});
cv.addEventListener('pointerleave', () => { reE = null; if (!reCho) reCho = setTimeout(reVao, 0); });
(function bamVong() {
  requestAnimationFrame(bamVong);
  if (!reXe || reXe.het) { VONG.visible = false; return; }
  const k = Math.max(0.7, (reXe.len || 1) * 0.6);
  VONG.position.set(reXe.x, 0.06, reXe.z); VONG.scale.set(k, 1, k); VONG.visible = true;
})();
const chonO = (id, ds, v) => `<select id="${id}">` + ds.map(([k, t]) => `<option value="${k}"${String(k) === String(v) ? ' selected' : ''}>${t}</option>`).join('') + '</select>';
function veChinh() {
  const o = $('oLan'), c = chinh;
  if (!c) { o.hidden = true; toSang(); return; }
  let html;
  if (c.loai === 'nga') {
    html = `<b>Lòng ngã tư</b><label class="chk"><input id="cMv" type="checkbox"${CAI.choNga ? ' checked' : ''}> Ô mắt võng vàng (kẹt thì chờ ở vạch, không dừng trong ô)</label>`
      + `<label class="chk"><input id="cDt" type="checkbox"${CAI.danTrai ? ' checked' : ''}> Vạch dẫn rẽ trái</label>`;
  } else {
    const h = CAI.lanCfg[c.ia], ten = 'Từ ' + ARMS[c.ia].ten;
    if (c.loai === 'lan' && c.i >= h.soLan) c.i = h.soLan - 1;
    if (c.loai === 'vach' && c.i >= h.soLan) { chinh = { loai: 'lan', ia: c.ia, i: h.soLan - 1 }; return veChinh(); }
    html = c.loai === 'lan'
      ? `<b>${ten} · làn ${c.i + 1}/${h.soLan}</b><label>Làn này cho đi${chonO('cCn', Object.entries(CONG_NANG), h.lan[c.i])}</label>`
      : `<b>${ten} · vạch giữa làn ${c.i} và ${c.i + 1}</b>`;
    html += `<label>Vạch chia làn trước vạch dừng${chonO('cVach', [['dut', 'Đứt (được chuyển làn)'], ['lien', 'Liền (cấm chuyển làn)'], ['khong', 'Không kẻ']], h.vach)}</label>`
      + `<label>Độ dài đoạn vạch <b id="cVd">${h.dai} m</b><input id="cDai" type="range" min="10" max="60" step="2" value="${h.dai}"></label>`
      + `<label>Số làn chiều vào${chonO('cSo', [1, 2, 3, 4].map((n) => [n, n + ' làn']), h.soLan)}</label>`
      + `<label>Mẫu nhanh cho hướng này${chonO('cMau', [['', 'Chọn mẫu…'], ...Object.entries(MAU_LAN).map(([k, m]) => [k, m.ten])], '')}</label>`
      + '<button id="cCa">Áp y hệt cho cả 4 hướng</button>';
  }
  o.innerHTML = '<div class="dau">' + html.replace(/^<b>(.*?)<\/b>/, '<b>$1</b><button id="cDong" title="Đóng">✕</button></div>');
  o.hidden = false; toSang();
  const sua = (f) => { f(CAI.lanCfg[c.ia]); veLan(); hienLan(); luuTuyChon(); veChinh(); };
  const on = (id, ev, f) => { const el = $(id); if (el) el.addEventListener(ev, f); };
  on('cDong', 'click', dongChinh);
  on('cMv', 'change', (e) => { CAI.choNga = e.target.checked; MV_MESH.visible = CAI.choNga; $('cn').checked = CAI.choNga; luuTuyChon(); });
  on('cDt', 'change', (e) => { CAI.danTrai = e.target.checked; $('dt').checked = CAI.danTrai; veLan(); luuTuyChon(); });
  on('cCn', 'change', (e) => sua((h) => { h.lan[c.i] = e.target.value; }));
  on('cVach', 'change', (e) => sua((h) => { h.vach = e.target.value; }));
  on('cDai', 'input', (e) => { CAI.lanCfg[c.ia].dai = +e.target.value; $('cVd').textContent = e.target.value + ' m'; veLan(); hienLan(); luuTuyChon(); toSang(); });
  on('cSo', 'change', (e) => sua((h) => { const n = +e.target.value; h.lan = Array.from({ length: n }, (_, i) => h.lan[i] || 'tudo'); h.soLan = n; }));
  on('cMau', 'change', (e) => { const k = e.target.value; if (k) sua((h) => Object.assign(h, structuredClone(MAU_LAN[k].h))); });
  on('cCa', 'click', () => { const h = CAI.lanCfg[c.ia]; CAI.lanCfg = CAI.lanCfg.map(() => structuredClone(h)); veLan(); hienLan(); luuTuyChon(); });
}
function moChinh(e) {
  const P = diemDat(e), t = P && trungDat(P);
  if (!t) { dongChinh(); return; }
  chinh = t; veChinh();
  const o = $('oLan'), W = o.offsetWidth, H = o.offsetHeight;
  o.style.left = Math.max(8, Math.min(innerWidth - W - 8, e.clientX + 14)) + 'px';
  o.style.top = Math.max(8, Math.min(innerHeight - H - 8, e.clientY - H - 24 > 8 ? e.clientY - H - 24 : e.clientY + 24)) + 'px'; // đặt trên điểm bấm, không che chỗ tô vàng
}
function dongChinh() { chinh = null; veChinh(); }
addEventListener('keydown', (e) => { if (e.key === 'Escape') dongChinh(); });
// Nút troll (Túm, Đẩy ngã, Dội nước, Vỏ chuối, Vẽ) LUÔN hiện + bấm được (anh 23/11/2026); 🛠 chỉ là ĐIỀU TIẾT giao thông: bấm làn / vạch / lòng ngã tư.
// Chế độ chỉnh sửa (anh 22/11/2026): mặc định chỉ XEM — bấm vào xe / người / đường không làm gì, chỉ xoay máy quay.
// Bật ✏️ Chỉnh sửa mới hiện hàng công cụ (Túm, Đẩy ngã, Dội nước, Vỏ chuối, Vẽ) và cho bấm vào đối tượng. Nhớ trên URL ?sua.
let SUA = new URLSearchParams(location.search).has('sua');
function datSua(on) {
  SUA = on; ben.classList.toggle('sua', on);
  const b = $('sua'); if (b) { b.classList.toggle('on', on); b.title = on ? 'Đang ĐIỀU TIẾT — bấm làn, vạch, lòng ngã tư để chỉnh; bấm lại để tắt' : 'Bật điều tiết giao thông: bấm vào làn, vạch, lòng ngã tư để chỉnh'; }
  if (!on) { dongChinh(); reE = null; cv.style.cursor = ''; }
  const u = new URL(location.href); if (on) u.searchParams.set('sua', '1'); else u.searchParams.delete('sua'); history.replaceState(null, '', u);
}
$('sua')?.addEventListener('click', () => datSua(!SUA));
datSua(SUA);
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
  while (QUA_GAN.length && QUA_GAN[0] < tg - 60) { QUA_GAN.shift(); CHO_GAN.shift(); }
  const qpp = QUA_GAN.length * 60 / Math.max(10, Math.min(60, tg));
  const choTB = CHO_GAN.length ? CHO_GAN.reduce((x, y) => x + y, 0) / CHO_GAN.length : 0;
  $('so').innerHTML = `<div><b>${Math.round(qpp)}</b>xe/phút</div><div><b>${choTB.toFixed(0)}s</b>chờ TB</div><div><b>${cho}</b>chờ đèn</div><div><b>${ketNga}</b>kẹt lòng</div><div><b>${CAI.vuot}</b>vượt đỏ</div>`;
  if ($('soThem').closest('details').open) $('soThem').innerHTML = `<div><b>${demCu.xm}</b> xe máy</div><div><b>${demCu.oto}</b> ô tô (${taxi} taxi)</div><div><b>${demCu.bus}</b> xe buýt</div><div><b>${demCu.bo}</b> người đi bộ</div>`
    + `<div><b>${leo}</b> xe leo lề</div><div><b>${don}</b> taxi tấp lề đón khách</div><div><b>${CAI.nghich}</b> lượt bị nghịch</div>`;
}

function coKhung() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', coKhung);
coKhung();

// ───────────────────────── hai bản hình: hiện tại ↔ bản thật (anh 22/11/2026, "giống castle, làm 2 option") ─────────────────────────
// Cùng một dòng xe, chỉ đổi cách VẼ. Nút 🧩 (hoặc ?hinh=that) bật bản thật: vật liệu PBR + ánh sáng môi trường + che bóng góc (GTAO)
// + mặt đường nhựa có vân. Lớp 1/4 của kế hoạch "mô hình thật"; xe máy, nhà phố, người thật sẽ nạp ngầm vào cùng nút này.
const THAT = { on: false, vl: new Map(), composer: null, env: null, duong: null };
function vlThat(m) {
  if (THAT.vl.has(m)) return THAT.vl.get(m);
  const n = new THREE.MeshStandardMaterial({
    color: m.color, map: m.map, vertexColors: m.vertexColors, transparent: m.transparent, opacity: m.opacity,
    side: m.side, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, depthWrite: m.depthWrite,
    roughness: 0.62, metalness: 0.08, envMapIntensity: 0.25,
  });
  THAT.vl.set(m, n); return n;
}
// Vân bề mặt thật (bản thật, bước 2): ảnh ambientCG CC0 nén 512 px (~140 KB cả ba). Hộp tĩnh (nhà, vỉa hè, bó vỉa) là hộp đơn vị
// kéo giãn nên không dùng UV được → chiếu theo toạ độ thế giới: mặt ngang thấp (vỉa hè) lấy gạch, mặt đứng + mái lấy tường vôi,
// nhân vào màu từng hộp (ảnh xám, chia trung bình → giữ nguyên màu sơn, chỉ thêm loang, vết bẩn, ron gạch).
function vanThe(vl) {
  const ld = new THREE.TextureLoader(), tx = (f) => { const t = ld.load(`mohinh/${f}?v=1`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const U = { tGach: { value: tx('van-gach.jpg') }, tVoi: { value: tx('van-voi.jpg') } };
  vl.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ mat4 mw = modelMatrix; \n#ifdef USE_INSTANCING\n mw = mw * instanceMatrix;\n#endif\n vWP = (mw * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(mw) * objectNormal); }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform sampler2D tGach; uniform sampler2D tVoi;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 an = abs(vWN); float d;
        if (an.y > 0.5 && vWP.y < 0.4) d = texture2D(tGach, vWP.xz / 1.6).r / 0.8;
        else { vec2 q = an.y > 0.5 ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy); d = mix(1.0, texture2D(tVoi, q / 3.0).r / 0.74, 0.55); }
        diffuseColor.rgb *= clamp(d, 0.55, 1.25); }`);
  };
  vl.customProgramCacheKey = () => 'vanThe'; vl.needsUpdate = true;
}
function vanNhuaThat() { // nhựa đường ảnh thật, phủ mặt đất 900 m, mỗi ô 5 m
  const t = new THREE.TextureLoader().load('mohinh/van-nhua.jpg?v=1'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(180, 180);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
function vanNhua() { // vân nhựa đường: hạt sỏi + vệt bánh xe, tự sinh (0 byte tải)
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const d = x.createImageData(512, 512);
  for (let i = 0; i < d.data.length; i += 4) { const v = 150 + (Math.random() - 0.5) * 70 + (Math.random() < 0.02 ? 50 : 0); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140, 140); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// Xe máy thật (bản thật): 3 mẫu tay ga low-poly, CC BY trên poly.pizza — Thomas Saint Pierre, Jasmine Roberts, Poly by Google.
// Mỗi mẫu = 2 InstancedMesh: phần thân (nhuộm theo màu xe a.c1) + phần cố định (bánh, yên, đèn). Tải nền khi bật 🧩 lần đầu.
const XMT = { on: false, ds: [], tai: null };
const XM_DAI = 1.5; // dài bằng khối hộp cũ (bánh ±0.6, r 0.29)
function geoTuGlb(goc) {
  goc.updateMatrixWorld(true);
  const phan = new Map(); // vật liệu -> [geo]
  goc.traverse((o) => {
    if (!o.isMesh || /^cube$/i.test(o.name) && goc.children.length > 1 && o.geometry.attributes.position.count <= 24) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.clearGroups(); const ml = Array.isArray(o.material) ? o.material : [o.material];
    const nhom = o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: (g.index || g.attributes.position).count, materialIndex: 0 }];
    for (const gr of nhom) {
      const m = ml[gr.materialIndex] || ml[0];
      let gg = g;
      if (nhom.length > 1) { gg = g.clone(); gg.setIndex(g.index ? Array.from(g.index.array.slice(gr.start, gr.start + gr.count)) : null); }
      if (!phan.has(m)) phan.set(m, []); phan.get(m).push(gg.index ? gg.toNonIndexed() : gg);
    }
  });
  // thân = vật liệu sáng có nhiều đỉnh nhất
  let than = null, nMax = -1;
  for (const [m, gs] of phan) { const c = m.color, sang = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, n = gs.reduce((s, g) => s + g.attributes.position.count, 0); if (sang > 0.12 && n > nMax) { nMax = n; than = m; } }
  const to = (ds, mau) => mergeGeometries(ds.map(([g, c]) => { const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; }));
  const T = [], F = [], TRANG_L = new THREE.Color(1, 1, 1);
  for (const [m, gs] of phan) for (const g of gs) (m === than ? T : F).push([g, m === than ? TRANG_L : m.color]);
  const gt = to(T), gf = F.length ? to(F) : new THREE.BufferGeometry();
  // đặt chiều dài dọc +x, đáy ở y = 0
  const bb = new THREE.Box3().setFromBufferAttribute(gt.attributes.position); if (F.length) bb.union(new THREE.Box3().setFromBufferAttribute(gf.attributes.position));
  const sz = bb.getSize(new THREE.Vector3()), tam = bb.getCenter(new THREE.Vector3());
  const M = new THREE.Matrix4().makeTranslation(-tam.x, -bb.min.y, -tam.z);
  if (sz.z > sz.x) M.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  M.premultiply(new THREE.Matrix4().makeScale(XM_DAI / Math.max(sz.x, sz.z), XM_DAI / Math.max(sz.x, sz.z), XM_DAI / Math.max(sz.x, sz.z)));
  for (const g of [gt, gf]) if (g.attributes.position) { g.applyMatrix4(M); g.computeVertexNormals(); }
  return [gt, gf];
}
function taiXm() {
  if (XMT.tai) return XMT.tai;
  const ld = new GLTFLoader(), vl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.6 });
  XMT.tai = Promise.all([1, 2, 3].map((i) => ld.loadAsync(`mohinh/xm${i}.glb?v=1`).then((g) => {
    const [gt, gf] = geoTuGlb(g.scene), lat = XMT.lat?.[i] ? Math.PI : 0;
    if (lat) { gt.rotateY(lat); gf.rotateY(lat); }
    const t = new THREE.InstancedMesh(gt, vl, MAX_XM), f = new THREE.InstancedMesh(gf, vl, MAX_XM);
    for (const m of [t, f]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.visible = false; scene.add(m); }
    t.setColorAt(0, new THREE.Color());
    // yên = điểm cao nhất của dải giữa-sau thân xe (không tính ghi-đông phía trước) → hông người ngồi đặt vào đây, mỗi mẫu một chỗ
    let yx = 0, yy = 0, n = 0; const L = XM_DAI / 2, cao = [];
    for (const g of [gt, gf]) { const p = g.attributes.position; if (!p) continue; for (let j = 0; j < p.count; j++) { const x = p.getX(j), z = p.getZ(j); if (x > -0.6 * L && x < -0.08 * L && Math.abs(z) < 0.15) cao.push([p.getY(j), x]); } }
    cao.sort((u, v) => v[0] - u[0]); for (const [y, x] of cao.slice(0, Math.max(8, cao.length * 0.03 | 0))) { yy += y; yx += x; n++; }
    const yen = n ? new THREE.Vector3(yx / n - 0.02, Math.min(0.05, yy / n + 0.06 - 0.9), 0) : new THREE.Vector3(); // trần 0,05: mẫu có kính chắn / tựa lưng cao bị đo nhầm làm yên
    return { t, f, n: 0, yen };
  }).catch((e) => { console.warn('xe máy thật', i, e); return null; }))).then((ds) => { XMT.ds = ds.filter(Boolean); datXm(THAT.on); });
  return XMT.tai;
}
// Ô tô thật (bản thật): Kenney Car Kit (CC0, kenney.nl) — sedan, SUV, van 16 chỗ, hatchback, xe tải nhỏ, taxi.
// Màu nằm trong ảnh bảng màu (colormap) → lấy mẫu ảnh theo UV ra màu đỉnh; mảng màu chiếm nhiều đỉnh nhất của "body" là sơn xe → nhuộm theo a.c1.
const OTT = { on: false, ds: [], tai: null, taxi: null };
const OTO_MAU = ['sedan', 'sedan', 'suv', 'van', 'hatchback-sports', 'delivery', 'truck', 'suv-luxury', 'sedan'];
function geoOtoGlb(goc, dai = 4.4, sonMoiManh = false) {
  goc.updateMatrixWorld(true);
  const T = [], F = [], cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  let anh = null, W = 0, H = 0;
  goc.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material.map;
    if (map && !anh) { W = cv.width = map.image.width; H = cv.height = map.image.height; cx.drawImage(map.image, 0, 0); anh = cx.getImageData(0, 0, W, H).data; }
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    const uv = g.attributes.uv, n = g.attributes.position.count, col = new Float32Array(n * 3), dem = new Map();
    for (let i = 0; i < n; i++) {
      let r = 1, gg = 1, b = 1;
      if (anh && uv) { const u = uv.getX(i) - Math.floor(uv.getX(i)), v = uv.getY(i) - Math.floor(uv.getY(i)); const k = (Math.min(H - 1, (v * H) | 0) * W + Math.min(W - 1, (u * W) | 0)) * 4; r = anh[k] / 255; gg = anh[k + 1] / 255; b = anh[k + 2] / 255; }
      const c = new THREE.Color().setRGB(r, gg, b, THREE.SRGBColorSpace); col.set([c.r, c.g, c.b], i * 3);
      const key = ((r * 31) | 0) + ',' + ((gg * 31) | 0) + ',' + ((b * 31) | 0); dem.set(key, (dem.get(key) || 0) + 1);
    }
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    let son = null;
    if (sonMoiManh || /body/i.test(o.name)) { let m = 0; for (const [k, c] of dem) { const [r, gg, b] = k.split(',').map(Number); if (r + gg + b > 12 && c > m) { m = c; son = k; } } }
    // tách tam giác: sơn xe → T (trắng, nhuộm), còn lại → F (giữ màu ảnh)
    const ps = g.attributes.position.array, nt = [], nf = [], ct = [], cf = [];
    for (let i = 0; i < n; i += 3) {
      const k0 = i * 3, key = ((col[k0] > 0 ? Math.pow(col[k0], 1 / 2.2) : 0) * 31 | 0);
      const r = col.subarray(k0, k0 + 9); void key;
      let laSon = false;
      if (son) { const c = new THREE.Color(r[0], r[1], r[2]).convertLinearToSRGB(); laSon = ((c.r * 31) | 0) + ',' + ((c.g * 31) | 0) + ',' + ((c.b * 31) | 0) === son; }
      (laSon ? nt : nf).push(...ps.subarray(k0, k0 + 9)); (laSon ? ct.push(1, 1, 1, 1, 1, 1, 1, 1, 1) : cf.push(...r));
    }
    const mk = (pp, cc) => { if (!pp.length) return null; const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); q.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); return q; };
    const a = mk(nt, ct), b2 = mk(nf, cf); if (a) T.push(a); if (b2) F.push(b2);
  });
  const gt = T.length ? mergeGeometries(T) : new THREE.BufferGeometry(), gf = mergeGeometries(F);
  const bb = new THREE.Box3().setFromBufferAttribute(gf.attributes.position); if (gt.attributes.position) bb.union(new THREE.Box3().setFromBufferAttribute(gt.attributes.position));
  const sz = bb.getSize(new THREE.Vector3()), tam = bb.getCenter(new THREE.Vector3());
  const M = new THREE.Matrix4().makeTranslation(-tam.x, -bb.min.y, -tam.z);
  if (sz.z > sz.x) M.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const k = dai / Math.max(sz.x, sz.z); M.premultiply(new THREE.Matrix4().makeScale(k, k, k));
  for (const g of [gt, gf]) if (g.attributes.position) { g.applyMatrix4(M); g.computeVertexNormals(); }
  return [gt, gf];
}
function taiOto() {
  if (OTT.tai) return OTT.tai;
  const ld = new GLTFLoader(), vl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.15, envMapIntensity: 0.7 });
  const ten = [...new Set(OTO_MAU), 'taxi'];
  OTT.tai = Promise.all(ten.map((t) => ld.loadAsync(`mohinh/${t}.glb?v=1`).then((g) => {
    const [gt, gf] = geoOtoGlb(g.scene);
    const t1 = new THREE.InstancedMesh(gt, vl, MAX_OTO), f = new THREE.InstancedMesh(gf, vl, MAX_OTO);
    for (const m of [t1, f]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.visible = false; m.castShadow = !DD; scene.add(m); }
    t1.setColorAt(0, new THREE.Color());
    return { ten: t, t: t1, f, n: 0 };
  }).catch((e) => { console.warn('ô tô thật', t, e); return null; }))).then((ds) => {
    const ok = ds.filter(Boolean); OTT.taxi = ok.find((k) => k.ten === 'taxi') || null;
    OTT.ds = OTO_MAU.map((t) => ok.find((k) => k.ten === t)).filter(Boolean); OTT.tat = ok;
    // xe buýt thành phố (Poly by Google, CC BY): một lưới có vân, sơn = màu sáng chiếm nhiều nhất → nhuộm xanh Sài Gòn / cam Hà Nội
    return ld.loadAsync('mohinh/xe-buyt.glb?v=1').then((g) => {
      const [gt, gf] = geoOtoGlb(g.scene, 10.5, true);
      const t1 = new THREE.InstancedMesh(gt, vl, 16), f = new THREE.InstancedMesh(gf, vl, 16);
      for (const m of [t1, f]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.visible = false; m.castShadow = !DD; scene.add(m); }
      t1.setColorAt(0, new THREE.Color()); OTT.bus = { ten: 'xe-buyt', t: t1, f, n: 0 }; OTT.tat.push(OTT.bus);
    }).catch((e) => console.warn('xe buýt thật', e)).then(() => datOto(THAT.on));
  });
  return OTT.tai;
}
function datOto(on) {
  OTT.on = on && OTT.ds.length > 0;
  mOto.visible = mMui.visible = !OTT.on; mBus.visible = !(OTT.on && OTT.bus);
  for (const k of OTT.tat || []) k.t.visible = k.f.visible = OTT.on;
}
function datXm(on) {
  XMT.on = on && XMT.ds.length > 0;
  mXm.visible = !XMT.on;
  for (const k of XMT.ds) { k.t.visible = k.f.visible = XMT.on; }
}
// Chi tiết mặt tiền nhà phố VN cho bản thật: máy lạnh, lan can sắt, cửa cuốn có gân, khung cửa sổ, chậu cây, đồ phơi, biển dọc.
// Dựng một lần thành MỘT khối gộp (một lần vẽ), chỉ hiện khi bật 🧩. Hạt ngẫu nhiên theo từng nhà → bật/tắt không đổi dáng.
function dungChiTiet() {
  const ds = [], DT = !!DD, kinh = [];
  for (const [F, n, w, tang, hat] of NHA_CT) {
    let h0 = hat; const r = () => { h0 = (h0 * 1103515245 + 12345) & 0x7fffffff; return h0 / 0x7fffffff; };
    const goc = Math.atan2(n[0], n[1]);
    const b = (lx, ly, lz, sx, sy, sz, hex) => { const p = theo(F, n, lx, lz); ds.push(p[0], ly, p[1], sx, sy, sz, goc, hex); };
    // cửa cuốn tầng trệt: gân ngang (nửa nhà kéo lên, nửa kéo xuống)
    const cuon = r() < 0.4, cw = w - 0.5;
    if (cuon) for (let k = 0; k < (DT ? 4 : 9); k++) b(0, 0.25 + k * 0.28, 0.1, cw, 0.05, 0.03, '#a7abb0');
    b(-cw / 2, 1.4, 0.1, 0.08, 2.7, 0.1, '#5a5e63'); b(cw / 2, 1.4, 0.1, 0.08, 2.7, 0.1, '#5a5e63');
    // biển dọc
    if (r() < 0.3) { const sx = (r() < 0.5 ? -1 : 1) * (w / 2 - 0.3); b(sx, 5.2, 0.6, 0.12, 2.4, 0.6, ['#d32f2f', '#1565c0', '#f9a825', '#2e7d32'][(r() * 4) | 0]); }
    for (let f = 1; f < tang; f++) {
      const y0 = 4 + (f - 1) * 3.4, ww = w * 0.6;
      // khung cửa sổ + song sắt
      b(0, y0 + 2.48, 0.07, ww + 0.16, 0.08, 0.08, '#e8e6e0'); b(0, y0 + 0.92, 0.07, ww + 0.16, 0.08, 0.08, '#e8e6e0');
      b(-ww / 2, y0 + 1.7, 0.07, 0.08, 1.6, 0.08, '#e8e6e0'); b(ww / 2, y0 + 1.7, 0.07, 0.08, 1.6, 0.08, '#e8e6e0');
      { const p = theo(F, n, 0, 0.04); kinh.push(p[0], y0 + 1.7, p[1], ww, 1.5, 0.02, goc, r() < 0.45 ? ['#c9b38f', '#9fb4c4', '#d8c8d8', '#b9c7a6'][(r() * 4) | 0] : '#26303a'); }
      if (!DT) for (let k = 1; k < 5; k++) b(-ww / 2 + (ww * k) / 5, y0 + 1.7, 0.12, 0.03, 1.5, 0.03, '#2b2b2b');
      // lan can sắt ban công
      if (r() < 0.8) {
        const lw = w - 0.6, nb = DT ? 0 : Math.max(4, Math.round(lw / 0.25));
        b(0, y0 + 1.05, 0.88, lw, 0.05, 0.05, '#2d2d2d');
        for (let k = 0; k <= nb; k++) b(-lw / 2 + (lw * k) / Math.max(1, nb), y0 + 0.6, 0.88, 0.025, 0.9, 0.025, '#2d2d2d');
        if (r() < 0.6) { const cx = (r() - 0.5) * (lw - 0.6); b(cx, y0 + 0.32, 0.7, 0.32, 0.3, 0.32, '#8d5a3b'); b(cx, y0 + 0.62, 0.7, 0.5, 0.42, 0.5, ['#3f7d3a', '#5c9a48', '#2f6b34'][(r() * 3) | 0]); }
        if (r() < 0.35) { b(0, y0 + 1.95, 0.6, lw * 0.8, 0.02, 0.02, '#777'); for (let k = 0; k < 3; k++) b(-lw * 0.3 + k * lw * 0.3, y0 + 1.6, 0.6, 0.45, 0.6, 0.03, ['#e53935', '#fafafa', '#1e88e5', '#fdd835', '#8e24aa'][(r() * 5) | 0]); }
      }
      // cục nóng máy lạnh
      if (r() < 0.6) { const ax = (r() < 0.5 ? -1 : 1) * (w / 2 - 0.55); b(ax, y0 + 2.2, 0.3, 0.8, 0.55, 0.3, '#eceff1'); b(ax + 0.12, y0 + 2.2, 0.46, 0.42, 0.42, 0.02, '#78858f'); }
    }
  }
  // một InstancedMesh hộp đơn vị (24 đỉnh dùng chung) thay cho gộp hàng nghìn hộp: ít bộ nhớ, dựng nhanh
  const N = ds.length / 8, m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05, envMapIntensity: 0.3 }), N);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0), MAU = new Map();
  for (let i = 0; i < N; i++) {
    const k = i * 8; v.set(ds[k], ds[k + 1], ds[k + 2]); sc.set(ds[k + 3], ds[k + 4], ds[k + 5]); q.setFromAxisAngle(Y, ds[k + 6]);
    m.setMatrixAt(i, mm.compose(v, q, sc));
    const hx = ds[k + 7]; if (!MAU.has(hx)) MAU.set(hx, new THREE.Color(hx)); m.setColorAt(i, MAU.get(hx));
  }
  m.receiveShadow = true; m.castShadow = !DT; m.matrixAutoUpdate = false; m.computeBoundingSphere(); scene.add(m);
  // kính cửa sổ: bóng như gương, phản chiếu trời HDRI; sau kính có ô rèm màu (45%) hoặc phòng tối
  const NK = kinh.length / 8, mk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.06, metalness: 0.7, envMapIntensity: 1.1 }), Math.max(1, NK));
  for (let i = 0; i < NK; i++) { const k = i * 8; v.set(kinh[k], kinh[k + 1], kinh[k + 2]); sc.set(kinh[k + 3], kinh[k + 4], kinh[k + 5]); q.setFromAxisAngle(Y, kinh[k + 6]); mk.setMatrixAt(i, mm.compose(v, q, sc)); mk.setColorAt(i, c.set(kinh[k + 7])); }
  mk.count = NK; mk.matrixAutoUpdate = false; mk.computeBoundingSphere(); m.add(mk); // con của khối chi tiết → ẩn/hiện theo bản thật
  return m;
}
// Người đi bộ có khớp (bản thật, lớp 4): thân + 2 tay + 2 chân là InstancedMesh riêng, tay chân đung đưa theo nhịp bước a.buoc.
// Trục +x là hướng đi (như geoBo), vai/hông nằm theo trục z. Chân treo ở hông (y 0.86), tay treo ở vai (y 1.42).
const NG = { on: false };
function dungNguoi() {
  const vl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, envMapIntensity: 0.3 });
  const mk = (g) => { const m = new THREE.InstancedMesh(g, vl, 400); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.visible = false; scene.add(m); return m; };
  const than = mk(ghep([[box(0.22, 0.56, 0.38).translate(0, 1.15, 0), TRANG], [box(0.24, 0.16, 0.36).translate(0, 0.88, 0), '#3a3a40'], [box(0.1, 0.08, 0.1).translate(0, 1.48, 0), '#d9a982']]));
  than.setColorAt(0, new THREE.Color());
  // tay: áo (nhuộm) + bàn tay da; gốc ở vai. Chân: quần + giày; gốc ở hông.
  const tay = mk(ghep([[box(0.1, 0.5, 0.1).translate(0, -0.25, 0), TRANG], [box(0.09, 0.1, 0.09).translate(0, -0.55, 0), '#d9a982']])); tay.setColorAt(0, new THREE.Color());
  const chan = mk(ghep([[box(0.13, 0.78, 0.14).translate(0, -0.39, 0), '#3a3a40'], [box(0.24, 0.08, 0.13).translate(0.04, -0.82, 0), '#1c1c1c']]));
  Object.assign(NG, { than, tay, chan });
}
const NG_M = new THREE.Matrix4(), NG_L = new THREE.Matrix4(), NG_R = new THREE.Matrix4(), NG_Z = new THREE.Vector3(0, 0, 1);
function veNguoi(V, Q, a, ip, mau) {
  const { than, tay, chan } = NG;
  NG_M.compose(V, Q, MOT); than.setMatrixAt(ip, NG_M); than.setColorAt(ip, mau);
  const di = a.sp > 0.05 && !a.nga, s = di ? Math.sin(a.buoc) * Math.min(0.6, 0.25 + a.sp * 0.3) : 0;
  for (const [k, z, g] of [[0, 0.09, s], [1, -0.09, -s]]) {
    NG_L.makeTranslation(0, 0.86, z).multiply(NG_R.makeRotationAxis(NG_Z, g)); chan.setMatrixAt(ip * 2 + k, NG_L.premultiply(NG_M));
    NG_L.makeTranslation(0, 1.4, z * 2.6).multiply(NG_R.makeRotationAxis(NG_Z, -g * 0.8)); tay.setMatrixAt(ip * 2 + k, NG_L.premultiply(NG_M)); tay.setColorAt(ip * 2 + k, mau);
  }
}
// Người thật (bản thật, thay khối hộp khi tải xong): Quaternius Modular Men/Women (CC0), nướng sẵn 8 khung bước + đứng + ngồi xe máy
// bằng apps/ngatu/scripts/nuong-nguoi.mjs → mohinh/nguoi.bin (~120 KB). Mỗi (mẫu, dáng) là một InstancedMesh; khung bước chọn theo a.buoc.
// Màu áo nhuộm theo từng người qua thuộc tính nhuom (1 = áo), phần còn lại giữ màu gốc của mẫu.
const NGT = { ok: false, ds: [], tai: null, buoc: 8 };
function taiNguoi() {
  if (NGT.tai) return NGT.tai;
  NGT.tai = fetch('mohinh/nguoi.bin?v=2').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((buf) => {
    const nj = new DataView(buf).getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, nj)));
    let o = (4 + nj + 3) & ~3; const lay = (T, n) => { const a = new T(buf, o, n); o = (o + a.byteLength + 3) & ~3; return a; };
    const vl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, envMapIntensity: 0.35 });
    vl.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float nhuom;\nvoid main() {').replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvColor.rgb = color.rgb * mix(vec3(1.0), instanceColor, nhuom);\n#endif'); };
    vl.customProgramCacheKey = () => 'nguoiThat';
    NGT.buoc = h.buoc;
    NGT.ds = h.mau.map((md) => {
      const idx = new THREE.BufferAttribute(lay(Uint16Array, md.ni), 1), mu = lay(Uint8Array, md.nv * 4);
      const col = new Float32Array(md.nv * 3), nh = new Float32Array(md.nv), c = new THREE.Color();
      for (let i = 0; i < md.nv; i++) { c.setRGB(mu[i * 4] / 255, mu[i * 4 + 1] / 255, mu[i * 4 + 2] / 255, THREE.SRGBColorSpace); col.set([c.r, c.g, c.b], i * 3); nh[i] = mu[i * 4 + 3] / 255; }
      const aCol = new THREE.BufferAttribute(col, 3), aNh = new THREE.BufferAttribute(nh, 1);
      const m = []; let dau = null;
      for (let d = 0; d < md.dang; d++) {
        const q = lay(Int16Array, md.nv * 3), g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(q, (x) => x / 10000), 3)); g.setAttribute('color', aCol); g.setAttribute('nhuom', aNh); g.setIndex(idx); g.computeVertexNormals();
        if (d === md.dang - 1) { // dáng ngồi: đo tâm + bề ngang đầu để đội mũ đúng chỗ, đúng cỡ
          const P = g.attributes.position; let top = -1e9; for (let i = 0; i < P.count; i++) top = Math.max(top, P.getY(i));
          let sx = 0, sz = 0, n = 0, z0 = 1e9, z1 = -1e9; for (let i = 0; i < P.count; i++) if (P.getY(i) > top - 0.2) { sx += P.getX(i); sz += P.getZ(i); n++; z0 = Math.min(z0, P.getZ(i)); z1 = Math.max(z1, P.getZ(i)); }
          const k = Math.min(1.25, Math.max(0.85, ((z1 - z0) / 2 + 0.018) / 0.12)); dau = { v: new THREE.Vector3(sx / n, top - 0.1, sz / n), s: new THREE.Vector3(k, k, k) };
        }
        const mm = new THREE.InstancedMesh(g, vl, d === md.dang - 1 ? MAX_XM : 400);
        mm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mm.count = 0; mm.frustumCulled = false; mm.castShadow = !DD; mm.visible = NG.on; mm.userData.n = 0; mm.setColorAt(0, c.set(1, 1, 1)); scene.add(mm); m.push(mm);
      }
      return { m, dau };
    });
    NGT.ok = true; datNguoi(NG.on);
  }).catch((e) => console.warn('người thật', e));
  return NGT.tai;
}
function datNguoi(on) {
  if (on && !NG.than) dungNguoi();
  if (on) taiNguoi();
  NG.on = on; mBo.visible = !on;
  const that = on && NGT.ok;
  if (NG.than) for (const m of [NG.than, NG.tay, NG.chan]) m.visible = on && !that;
  if (that) for (const m of [NG.than, NG.tay, NG.chan]) m.count = 0;
  mDau.visible = !that; mNguoi.visible = !that;
  for (const k of NGT.ds) for (const m of k.m) m.visible = that;
}
function datHinh(on) {
  THAT.on = on; datNguoi(on);
  if (on && !THAT.ct) THAT.ct = dungChiTiet();
  if (THAT.ct) THAT.ct.visible = on;
  if (on) { taiXm(); taiOto(); } datXm(on); datOto(on);
  if (on && !THAT.env) {
    const pm = new THREE.PMREMGenerator(renderer);
    THAT.env = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; pm.dispose();
    THAT.duong = vanNhuaThat();
    // bầu trời ảnh thật (Poly Haven, CC0, 1K ~1,4 MB): tải ngầm, xong thì thay cho môi trường phòng giả + làm nền trời
    new RGBELoader().setDataType(THREE.FloatType).loadAsync('mohinh/troi-1k.hdr?v=1').then((t) => {
      // cắt đốm mặt trời (giá trị hàng nghìn) — để nguyên thì mọi mặt nhám đều ám vàng; nắng thật đã có DirectionalLight lo
      const dl = t.image.data; for (let i = 0; i < dl.length; i++) if (dl[i] > 4) dl[i] = 4; t.needsUpdate = true;
      const pm2 = new THREE.PMREMGenerator(renderer); THAT.env = pm2.fromEquirectangular(t).texture; pm2.dispose();
      t.mapping = THREE.EquirectangularReflectionMapping; THAT.troi = t;
      if (THAT.on) { scene.environment = THAT.env; scene.background = t; scene.backgroundIntensity = 0.9; }
    }).catch((e) => console.warn('trời HDRI', e));
  }
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      if (o.material.isMeshLambertMaterial) { o.userData.vlCu = o.material; o.material = vlThat(o.material); }
    } else if (o.userData.vlCu) { o.material = o.userData.vlCu; o.material.needsUpdate = true; delete o.userData.vlCu; }
  });
  if (on && !THAT.vanHop) { const vh = THAT.vl.get(mHop.userData.vlCu || mHop.material); if (vh) { vanThe(vh); THAT.vanHop = true; } }
  const vd = THAT.vl.get(mat0.userData.vlCu || mat0.material);
  if (vd) { vd.map = on ? THAT.duong : null; vd.color = new THREE.Color(0.40, 0.40, 0.42); vd.roughness = 0.95; vd.envMapIntensity = 0.04; vd.needsUpdate = true; }
  scene.environment = on ? THAT.env : null;
  if (!THAT.nenCu) THAT.nenCu = scene.background; scene.background = on && THAT.troi ? THAT.troi : THAT.nenCu;
  renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = on ? 0.7 : 1;
  troi.intensity = on ? 0.5 : 1.1; sun.intensity = on ? 2.6 : 1.9;
  // bản thật: nắng gần trung tính + đất dội xám — nắng vàng 2,6 cộng đất dội nâu biến mặt nhựa gần thành kaki (22/11/2026)
  sun.color.set(on ? '#fff8ee' : '#fff1dc'); troi.groundColor.set(on ? '#6e6c68' : '#8a7a66');
  if (on && !THAT.composer && !DD) {
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: 1.2, distanceFallOff: 1, thickness: 1.5 });
    c.addPass(ao); c.addPass(new OutputPass());
    THAT.composer = c;
  }
  if (THAT.composer) THAT.composer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.needsUpdate = true;
  const b = $('hinh'); if (b) { b.classList.toggle('on', on); b.title = on ? 'Đang xem BẢN THẬT — bấm để về bản hiện tại' : 'Xem BẢN THẬT (vật liệu PBR, ánh sáng môi trường, che bóng góc, xe máy thật) để so với bản hiện tại. Mô hình: xe máy + xe buýt poly.pizza (CC BY, xe buýt của Poly by Google), ô tô Kenney (CC0), người Quaternius (CC0)'; }
  apMua();
  const u = new URL(location.href); if (on) u.searchParams.set('hinh', 'that'); else u.searchParams.delete('hinh'); history.replaceState(null, '', u);
}
$('hinh')?.addEventListener('click', () => datHinh(!THAT.on));

// ───────────────────────── trời mưa (anh 22/11/2026: "như sprawl ?kieu=nhat khi mưa") ─────────────────────────
// Lớp mưa dùng chung với sprawl (mua.js): mặt đường ướt soi bóng cảnh thật, vũng nước có gợn, hạt mưa quanh máy quay.
// Ở đây thêm: trời xám đục, nắng yếu, sương dày. Áp SAU datHinh vì datHinh đặt lại ánh sáng gốc mỗi lần đổi bản.
const MUA = { on: false, lop: null, daUot: new WeakSet(), nen: new THREE.Color('#7d8790') };
function uotMat() { // gắn lớp ướt cho mặt đường (cả vật liệu bản hiện tại lẫn bản thật)
  for (const m of [mat0.material, mat0.userData.vlCu]) if (m && !MUA.daUot.has(m)) { MUA.daUot.add(m); MUA.lop.uot(m); }
}
function apMua() {
  if (!MUA.on) return;
  troi.intensity *= 0.8; sun.intensity *= 0.3; renderer.toneMappingExposure *= 0.92;
  scene.background = MUA.nen; scene.fog.color.copy(MUA.nen); scene.fog.near = 60; scene.fog.far = 260;
  renderer.shadowMap.needsUpdate = true;
}
function datMua(on) {
  if (on && !MUA.lop) MUA.lop = taoMua({ renderer, scene, camera });
  MUA.on = on; if (MUA.lop) { uotMat(); MUA.lop.dat(on, 1); }
  scene.fog.color.set('#c8d9e6'); scene.fog.near = HL ? 700 : 150; scene.fog.far = HL ? 1700 : 430;
  datHinh(THAT.on); // đặt lại ánh sáng gốc của bản đang xem, rồi apMua phủ lên
  if (!THAT.on) { if (!on) scene.background = THAT.nenCu ?? scene.background; }
  $('mua')?.classList.toggle('on', on);
  const u = new URL(location.href); if (on) u.searchParams.set('mua', '1'); else u.searchParams.delete('mua'); history.replaceState(null, '', u);
}
$('mua')?.addEventListener('click', () => datMua(!MUA.on));
if (new URLSearchParams(location.search).has('mua')) datMua(true);
addEventListener('resize', () => THAT.composer?.setSize(innerWidth, innerHeight));
if (new URLSearchParams(location.search).get('hinh') === 'that') datHinh(true);

// ───────────────────────── chấm phương án ─────────────────────────
// Mỗi phương án chạy CÙNG một dòng xe: 3 hạt ngẫu nhiên cố định, mỗi hạt 40 s làm nóng + 120 s đo, bước 1/20 s.
// Math.random chỉ bị thay bằng bộ sinh có hạt trong lúc chạy bước chấm — vẽ cảnh vẫn dùng Math.random thật.
const HAT = [11, 23, 37], CHAM_NONG = 800, CHAM_DO = 2400, KHOA_CHAM = 'ngatu-cham';
const sinhHat = (h) => () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const CHI_SO = [ // [tên, đơn vị, khoá, 1 = càng cao càng tốt / -1 = càng thấp càng tốt, số lẻ]
  ['Xe qua ngã tư', 'xe/phút', 'qua', 1, 1], ['Chờ trung bình mỗi xe', 's', 'cho', -1, 1], ['Xe kẹt trong lòng (TB)', 'xe', 'ket', -1, 1],
  ['Lúc kẹt đông nhất', 'xe', 'ketMax', -1, 0], ['Vượt đèn đỏ', 'lượt/phút', 'vuot', -1, 1], ['Người đi bộ qua', 'người/phút', 'bo', 1, 1]];
const PA = (() => { try { const o = JSON.parse(localStorage.getItem(KHOA_CHAM) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } })();
const luuPA = () => { try { localStorage.setItem(KHOA_CHAM, JSON.stringify({ A: PA.A, B: PA.B })); } catch {} };
function moTaPA() {
  const tat = (h) => `${h.soLan} làn ${h.lan.map((c) => (c === 'tudo' ? 'tự do' : CONG_NANG[c].split(' ')[0])).join(' / ')}, vạch ${{ dut: 'đứt', lien: 'liền', khong: 'không kẻ' }[h.vach]}`;
  const giong = CAI.lanCfg.every((h) => JSON.stringify(h) === JSON.stringify(CAI.lanCfg[0]));
  return `${$('kp').selectedOptions[0].text}${CAI.denAI ? ' · đèn AI' : ''}${CAI.phaiXanh ? ' · phải luôn xanh' : ''} · ${giong ? tat(CAI.lanCfg[0]) : 'làn khác nhau theo hướng'} · ${CAI.matDo} xe máy`;
}
function hienDiem() {
  const cot = [['Vừa chấm', PA.hien], ['A', PA.A], ['B', PA.B]].filter((c) => c[1]);
  const o = $('chamKq');
  if (!cot.length) { o.innerHTML = ''; return; }
  const dong = CHI_SO.map(([ten, dv, k, huong, le]) => {
    const ds = cot.map((c) => c[1].kq[k]), tot = huong > 0 ? Math.max(...ds) : Math.min(...ds);
    return `<tr><th>${ten} <i>${dv}</i></th>${ds.map((v) => `<td${cot.length > 1 && v === tot && ds.some((x) => x !== tot) ? ' class="tot"' : ''}>${v.toFixed(le)}</td>`).join('')}</tr>`;
  }).join('');
  o.innerHTML = `<table><tr><th></th>${cot.map((c) => `<th>${c[0]}</th>`).join('')}</tr>${dong}</table>`
    + cot.map(([t, p]) => `<p class="goiy"><b>${t}:</b> ${p.ten}</p>`).join('')
    + `<div class="nut">${PA.hien ? '<button data-pa="luuA">Lưu làm A</button><button data-pa="luuB">Lưu làm B</button>' : ''}${PA.A ? '<button data-pa="apA">Áp lại A</button>' : ''}${PA.B ? '<button data-pa="apB">Áp lại B</button>' : ''}</div>`;
}
$('chamKq').addEventListener('click', (e) => {
  const v = e.target.dataset.pa; if (!v) return;
  const k = v.slice(-1);
  if (v.startsWith('luu')) { PA[k] = PA.hien; luuPA(); }
  else { Object.assign(CAI, structuredClone(PA[k].cfg)); hienTuyChon(); dungPha(); veLan(); luuTuyChon(); }
  hienDiem();
});
function chamPA() {
  if (DIEM_CHAY) return;
  const dungCu = CAI.dung, goc = Math.random, nut = $('chamChay'), kq = [], tong = HAT.length * (CHAM_NONG + CHAM_DO);
  const cfg = Object.fromEntries(Object.keys(MAC_DINH).map((k) => [k, structuredClone(CAI[k])])), ten = moTaPA();
  CAI.dung = true; DIEM_CHAY = true; dongChinh(); theoXe = null; nut.disabled = true;
  let h = 0, n = 0, xong = 0, rand = null;
  const lam = () => {
    Math.random = rand || goc;
    try {
      for (let k = 0; k < 150 && h < HAT.length; k++) {
        if (n === 0) { for (const a of DS) { a.het = true; boNet(a); } DS.length = 0; tg = 0; dungPha(); Math.random = rand = sinhHat(HAT[h]); }
        if (n === CHAM_NONG) { DIEM = { t: 0, ket: 0, ketMax: 0, qua: 0, cho: 0, bo: 0 }; CAI.vuot = 0; }
        demCu = buoc(1 / 20); n++; xong++;
        if (n === CHAM_NONG + CHAM_DO) { kq.push({ ...DIEM, vuot: CAI.vuot }); DIEM = null; h++; n = 0; rand = null; }
      }
    } finally { Math.random = goc; }
    if (h < HAT.length) { nut.textContent = `Đang chấm… ${Math.round((xong / tong) * 100)}%`; setTimeout(lam, 0); return; }
    const c = (k) => kq.reduce((t, x) => t + x[k], 0), phut = c('t') / 60;
    PA.hien = { ten, cfg, kq: { qua: c('qua') / phut, cho: c('qua') ? c('cho') / c('qua') : 0, ket: c('ket') / c('t'), ketMax: Math.max(...kq.map((x) => x.ketMax)), vuot: c('vuot') / phut, bo: c('bo') / phut } };
    CAI.dung = dungCu; DIEM_CHAY = false; CAI.vuot = 0; nut.disabled = false; nut.textContent = '▶ Chấm cài đặt hiện tại';
    hienDiem();
  };
  setTimeout(lam, 0);
}
$('chamChay').addEventListener('click', chamPA);
hienDiem();

// Cho xe chạy trước 45 giây mô phỏng để mở trang là thấy dòng xe đã đầy, không phải một đợt xe ùa vào cùng lúc.
function khoiDong() {
  const t0 = performance.now();
  for (let i = 0, n = HL ? 1500 : 900; i < n; i++) demCu = buoc(1 / 20); // hành lang dài → chạy trước lâu hơn cho xe rải đủ các nút
  CAI.vuot = 0;
  $('nap').hidden = true;
  console.log('ngatu: làm nóng', Math.round(performance.now() - t0), 'ms,', DS.length, 'đối tượng');
  datCam('tong');
  renderer.shadowMap.needsUpdate = true;
  let truoc = performance.now(), boQua = false;
  renderer.setAnimationLoop(() => {
    // mọi máy: trần 30 khung/giây (màn 60–120 Hz vẽ gấp 2–4 lần cho cùng mô phỏng → quạt kêu); ?fps=60 để bỏ trần
    const bay = performance.now();
    if (bay - truoc < 1000 / TRAN_FPS - 2) return;
    const dtThuc = Math.min(0.1, (bay - truoc) / 1000);
    truoc = bay;
    if (!CAI.dung) {
      let con = dtThuc * CAI.toc;
      while (con > 1e-4) { const d = Math.min(con, 1 / 30); demCu = buoc(d); con -= d; }
    }
    capNhatDen(); capNhatDenLan();
    capNhatNet();
    ve();
    if (cam === 'theo') capNhatCamTheo(dtThuc); else controls.update();
    hudT -= dtThuc; if (hudT <= 0) { hud(); hudT = 0.25; }
    KHUNG.setFromProjectionMatrix(MK.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); daCoKhung = true;
    // tự hạ chất lượng: bản thật trung bình < 45 khung/giây suốt ~3 giây thì tắt che bóng góc (GTAO), giữ phần còn lại
    if (THAT.on && THAT.composer && !THAT.ha) { THAT.fps = (THAT.fps ?? 60) * 0.97 + (1 / Math.max(dtThuc, 1e-3)) * 0.03; THAT.cham = THAT.fps < 45 ? (THAT.cham || 0) + dtThuc : 0; if (THAT.cham > 3) { THAT.ha = true; console.info('ngatu: máy chậm, tắt GTAO'); } }
    if (MUA.on) { uotMat(); MUA.lop.khung(dtThuc, 0.01, [mat0], null); }
    if (THAT.on && THAT.composer && !THAT.ha) THAT.composer.render(); else renderer.render(scene, camera);
  });
}
requestAnimationFrame(() => setTimeout(khoiDong, 30));
