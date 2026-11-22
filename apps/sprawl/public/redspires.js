// Red Spires dựng theo bản quy hoạch chung (public/du-lieu/quy-hoach.json, máy scripts/quy-hoach.mjs).
// Ảnh mẫu: ban ngày sương xanh xám · tháp nón đỏ chóp vòm (ban công, cửa tròn, ăng-ten, vệt bẩn) · đại lộ đi bộ lát đá sáng
// có chợ + người · phố thấp xanh xám, vườn mái · khối khổng lồ mờ xa · xe bay theo làn trên đại lộ lớn.
// Nhà PLATEAU giữ nguyên bố cục thật, khoác chất liệu xanh xám; nhà thật ≥ 90 m bị khoét bỏ trong shader để tháp đỏ đứng thay.
import * as THREE from 'three';
import { taoSong } from './song.js';
import { TL, batTang } from './khop.js';
import { taoNguoiGan } from './nguoi-gan.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAU_NGUOI = ['#2b2f36', '#4a3b33', '#c9b8a0', '#6d7f8c', '#8a3b2e', '#d8d2c4', '#3e5566', '#9b8a6a'];
const MAU_MAI = ['#c9483a', '#e0a83c', '#3f7f8c', '#d9d2c2', '#7d9a5a'];

// Mỗi tháp một bộ gen (gieo theo id): dáng thân, kiểu chóp, màu đỏ, màu viền, gân dọc, nhịp cửa, ban công, đỉnh.
// Sáu dáng: đạn (phình 1/4 thân) · bậc (3-4 trống lùi dần) · củ hành (thân mảnh, bầu gần đỉnh) · nón (thon nhọn kiểu gothic)
//           · bình (eo giữa, loe vương miện) · chùm (thân chính + 2-3 tháp vệ tinh dính chân).
const DANG = ['dan', 'bac', 'hanh', 'non', 'binh', 'chum'];
const MAU_DO = ['#b9452f', '#a63a2a', '#c4553a', '#9e3b30', '#b54a3c', '#c9603f', '#8f3a2c', '#ad4b35', '#c2483f', '#9a4632'];
const MAU_VIEN = ['#d9cdb5', '#4a3a33', '#5d8a86', '#c79a4a', '#e8e0cf', '#6b4f3f', '#8fa7a3'];
const gieo = (id) => { let h = (id * 2654435761 + 1013904223) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; };
const chon = (r, a) => a[(r() * a.length) | 0];
const buocMuot = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// hồ sơ thân: trả các điểm [t 0..1 theo chiều cao thân, hệ số bán kính]; bậc cần điểm gãy nên trả điểm thẳng
function thanTheoDang(dang, r) {
  const p = [], N = 40;
  if (dang === 'bac') {
    const n = 3 + (r() < 0.5 ? 1 : 0); let rr = 1.18, t0 = 0;
    for (let k = 0; k < n; k++) {
      const t1 = k === n - 1 ? 1 : t0 + (0.42 - k * 0.07) * (0.9 + r() * 0.2), thon = 0.04 + r() * 0.06;
      p.push([t0, rr], [t0 + (t1 - t0) * 0.5, rr * (1 - thon * 0.5)], [t1 - 0.012, rr * (1 - thon)]);
      t0 = t1; rr = rr * (1 - thon) * (0.72 + r() * 0.08);
      if (k < n - 1) p.push([t0, rr]);
    }
    return p;
  }
  const a = 0.8 + r() * 0.4; // độ phình riêng mỗi tháp
  for (let i = 0; i <= N; i++) {
    const t = i / N; let f;
    if (dang === 'dan') f = 1.1 + 0.15 * a * Math.sin(Math.PI * Math.min(1, t * 1.6)) - 0.5 * Math.pow(t, 1.5);
    else if (dang === 'hanh') f = (0.78 - 0.22 * t) + 0.42 * a * Math.max(0, Math.sin(Math.PI * (t - 0.7) / 0.3)) * (t > 0.7 ? 1 : 0);
    else if (dang === 'non') f = 1.15 * (1 - 0.8 * Math.pow(t, 0.9 + 0.3 * a)) + 0.06 * Math.sin(t * 9);
    else if (dang === 'binh') f = 1.0 - 0.32 * a * Math.sin(Math.PI * Math.min(1, t / 0.8)) + 0.3 * buocMuot(0.72, 0.96, t);
    else f = 1.05 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.8)) - 0.45 * Math.pow(t, 1.4); // chùm: thân chính
    p.push([t, Math.max(0.12, f)]);
  }
  return p;
}
// chóp: vòm tròn · vòm nhọn (ogive) · mái bằng có chòi nhỏ
function dungHoSo(R, H, dang, r) {
  const chop = dang === 'non' ? 'nhon' : dang === 'hanh' ? 'nhon' : chon(r, ['vom', 'vom', 'nhon', 'choi']);
  const diem = thanTheoDang(dang, r), rCuoi = diem[diem.length - 1][1] * R;
  const ddChop = chop === 'nhon' ? rCuoi * (1.6 + r() * 0.8) : chop === 'choi' ? rCuoi * 0.35 : rCuoi * (0.7 + r() * 0.25);
  const than = H - ddChop, p = diem.map(([t, f]) => new THREE.Vector2(Math.max(0.5, f * R), t * than));
  for (let i = 1; i <= 14; i++) {
    const s = i / 14, a = s * Math.PI / 2;
    const rr = chop === 'nhon' ? rCuoi * Math.pow(1 - s, 1.25) * (1 + 0.25 * Math.sin(Math.PI * s)) : rCuoi * Math.cos(a);
    p.push(new THREE.Vector2(Math.max(0.01, rr), than + ddChop * (chop === 'nhon' ? s : Math.sin(a))));
  }
  const rTai = (y) => { if (y <= 0) return p[0].x; for (let i = 1; i < p.length; i++) if (p[i].y >= y) { const a = p[i - 1], b = p[i]; return a.x + (b.x - a.x) * (y - a.y) / Math.max(0.01, b.y - a.y); } return 0.5; };
  return { p, than, rC: rCuoi, chop, rTai, rMax: Math.max(...p.map((v) => v.x)) };
}
// gân dọc: nắn bán kính thân theo góc (chỉ phần thân, không đụng chóp)
function khiaGan(geo, than, n, bien) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (y > than) continue;
    const k = 1 + bien * (Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * n / 2)), 6) - 0.3); pos.setX(i, x * k); pos.setZ(i, z * k); }
  geo.computeVertexNormals(); return geo;
}

// cửa sổ sáng đèn: ô kính ngẫu nhiên bật đèn ấm, vài ô đổi trạng thái mỗi ~10 giây (dùng chung tháp đỏ + nhà PLATEAU)
const U_DEN = { uDen: { value: 0.85 }, uTg: { value: 0 } };
const uSang = { uSang: { value: 0 } }; // kiểu Nhật 2200: phố thấp sáng màu kem trắng thay xanh xám
const DEN_EMIT = '#include <emissivemap_fragment>\n      totalEmissiveRadiance += vec3(1.0, 0.74, 0.46) * den * uDen;';

function vatThap(gen) {
  const v = new THREE.MeshStandardMaterial({ color: gen.mau, roughness: 0.74 + gen.r * 0.12, metalness: 0.05 });
  const u = { uVien: { value: new THREE.Color(gen.vien) }, uNhip: { value: new THREE.Vector4(gen.oRong, gen.tang, gen.bang, gen.tron) }, uKieu: { value: new THREE.Vector2(gen.soc, gen.than) } };
  v.customProgramCacheKey = () => 'thap-do'; v.userData.than = true;
  v.onBeforeCompile = (sh) => { // tấm ốp + cửa sổ + cửa tròn + vệt bẩn + sọc viền, theo toạ độ trong thân; nhịp riêng mỗi tháp qua uniform
    Object.assign(sh.uniforms, u, U_DEN);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLo = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLo; uniform vec3 uVien; uniform vec4 uNhip; uniform vec2 uKieu; uniform float uDen, uTg;
      float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float rr = length(vLo.xz), cung = atan(vLo.z, vLo.x) * max(rr, 1.0), goc = atan(vLo.z, vLo.x);
      float tang = floor(vLo.y / uNhip.y), fy = fract(vLo.y / uNhip.y);
      vec2 o = vec2(floor(cung / uNhip.x), tang), f = vec2(fract(cung / uNhip.x), fy);
      float h = bam(o);
      float cua = step(0.3, f.x) * step(f.x, 0.7) * step(0.32, f.y) * step(f.y, 0.78) * step(0.18, h) * step(vLo.y, uKieu.y);
      float bang = step(fract(vLo.y / uNhip.z), 0.06);
      vec2 ot = vec2(floor(cung / 7.0), floor(vLo.y / 14.4)), ft = vec2(fract(cung / 7.0), fract(vLo.y / 14.4)) - 0.5;
      float tron = step(length(ft * vec2(1.0, 2.0)), 0.3) * step(uNhip.w, bam(ot + 5.3));
      float ban = bam(vec2(floor(cung / 1.3), 3.0));
      float vet = smoothstep(0.55, 1.0, ban) * (0.35 + 0.65 * fract(vLo.y * 0.013 + ban * 7.0));
      float tam = 0.86 + 0.14 * bam(vec2(floor(cung / 9.0), floor(vLo.y / 10.8)) + 2.0);
      // sọc viền: 1 = sọc dọc, 2 = đai ngang, 3 = vảy ô trám ở chóp
      float soc = 0.0;
      if (uKieu.x > 0.5 && uKieu.x < 1.5) soc = step(0.94, fract(goc * 6.0 / 6.2832 + 0.5));
      else if (uKieu.x > 1.5 && uKieu.x < 2.5) soc = step(fract(vLo.y / (uNhip.z * 2.0)), 0.035);
      if (vLo.y > uKieu.y) { vec2 v2 = vec2(goc * 18.0 / 6.2832, vLo.y / 2.4); soc = max(soc, step(0.5, uKieu.x) * step(0.82, abs(fract(v2.x + floor(v2.y) * 0.5) - 0.5) * 2.0)); }
      // ---- chi tiết nhìn gần (ảnh mẫu): mạch ghép tấm ốp, khung cửa, vệt gỉ chảy dưới cửa, sơn bong, lá chớp thông gió.
      // Mờ dần theo cỡ điểm ảnh (fwidth) → xa không nhiễu răng cưa, lại gần hiện đủ.
      float px = fwidth(vLo.y) + fwidth(cung), gan = 1.0 - smoothstep(0.06, 0.45, px), aa = max(px, 0.002);
      float trongThan = step(vLo.y, uKieu.y);
      float cx = cung / 2.4 + mod(tang, 2.0) * 0.5;
      float eX = (0.5 - abs(fract(cx) - 0.5)) * 2.4, eY = (0.5 - abs(fy - 0.5)) * uNhip.y;
      float mep = max(1.0 - smoothstep(0.035, 0.035 + aa, eX), 1.0 - smoothstep(0.05, 0.05 + aa, eY)) * gan * trongThan;
      float sang = (1.0 - smoothstep(0.09, 0.09 + aa, abs(eY - 0.16))) * gan * trongThan * step(fy, 0.5); // gờ sáng trên mạch ngang (ánh nắng bắt cạnh)
      float coCua = step(0.18, h) * trongThan;
      float khungCua = step(0.26, f.x) * step(f.x, 0.74) * step(0.28, f.y) * step(f.y, 0.82) * coCua - cua;
      float chay = step(0.43, f.x) * step(f.x, 0.57) * step(f.y, 0.32) * coCua * step(0.45, bam(o + 1.7)) * (f.y / 0.32) * gan;
      float laChop = (1.0 - coCua) * trongThan * step(0.3, f.x) * step(f.x, 0.7) * step(0.35, f.y) * step(f.y, 0.75) * step(0.5, fract(f.y * 14.0)) * step(0.6, bam(o + 9.1));
      vec2 nb = vec2(cung, vLo.y) / 3.2; vec2 i0 = floor(nb), t0 = fract(nb); t0 = t0 * t0 * (3.0 - 2.0 * t0);
      float nh = mix(mix(bam(i0), bam(i0 + vec2(1, 0)), t0.x), mix(bam(i0 + vec2(0, 1)), bam(i0 + vec2(1, 1)), t0.x), t0.y);
      // sơn bong: mảng lớn, thưa, tắt dần khi xa (trước đây chấm trắng 1,7 m rắc khắp thân, nhìn từ xa thành nhiễu)
      float xa = 1.0 - smoothstep(0.25, 1.1, px);
      float bong = smoothstep(0.82, 0.87, nh) * step(0.68, bam(floor(vec2(cung, vLo.y) / 16.0) + 4.4)) * xa;
      diffuseColor.rgb *= tam * (1.0 - 0.32 * vet) * (1.0 - 0.35 * bang);
      diffuseColor.rgb = mix(diffuseColor.rgb, uVien * (1.0 - 0.25 * vet), soc * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.74, 0.68), bong * 0.8);
      diffuseColor.rgb *= (1.0 - 0.45 * mep) * (1.0 + 0.18 * sang) * (1.0 - 0.4 * chay) * (1.0 - 0.35 * laChop);
      diffuseColor.rgb = mix(diffuseColor.rgb, uVien * 0.8, max(khungCua, 0.0) * 0.55 * gan);
      vec3 kinh = mix(vec3(0.11, 0.14, 0.17), vec3(0.36, 0.44, 0.5), smoothstep(0.32, 0.78, f.y) * 0.7 + 0.3 * bam(o + 2.2));
      diffuseColor.rgb = mix(diffuseColor.rgb, kinh, cua * mix(0.4, 0.9, xa)); // xa: lưới cửa nhạt bớt cho khỏi răng cưa
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.27, 0.3), tron);
      float den = cua * step(0.8, bam(o + 4.4 + floor(uTg * 0.1 + h * 9.0))) * (0.55 + 0.45 * bam(o + 8.8)) * (0.35 + 0.65 * xa);`)
      .replace('#include <emissivemap_fragment>', DEN_EMIT);
  };
  return v;
}

// chất liệu dùng chung mọi tháp (kính đài quan sát, cửa tròn tối, hộp ốp tường tô màu theo từng hộp)
const V_KINH = new THREE.MeshStandardMaterial({ color: '#3d4b54', roughness: 0.12, metalness: 0.7, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
const V_TRON = new THREE.MeshStandardMaterial({ color: '#1d2429', roughness: 0.2, metalness: 0.6 });
const V_HOP = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.08 });
const G_HOP = new THREE.BoxGeometry(1, 1, 1), G_COT = new THREE.CylinderGeometry(0.05, 0.05, 1, 4), G_VANH = new THREE.TorusGeometry(1, 0.13, 6, 28), G_KINH_TRON = new THREE.CircleGeometry(1, 28);
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _v4 = new THREE.Vector3(), _s4 = new THREE.Vector3(), _e4 = new THREE.Euler(), _c4 = new THREE.Color();
// đặt instance quay mặt ra ngoài theo góc a (trục z cục bộ = hướng bán kính)
function datRa(im, i, a, rr, y, sx, sy, sz) { _q4.setFromEuler(_e4.set(0, Math.PI / 2 - a, 0)); im.setMatrixAt(i, _m4.compose(_v4.set(Math.cos(a) * rr, y, Math.sin(a) * rr), _q4, _s4.set(sx, sy, sz))); }

// mảnh phụ của tháp (ban công, viền, kim loại, hộp ốp, cửa tròn) gộp về MỘT mesh tô màu theo đỉnh — trước đây mỗi tháp ~35 mesh rời
// (2.162 lượt vẽ toàn cảnh, đo M4 22/11/2026: 17 khung/s). Thân vT giữ riêng vì mang nhịp cửa riêng qua uniform; kính gộp thành một mesh trong suốt.
const V_PHU = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.2, side: THREE.DoubleSide });
function gopThap(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), phu = [], kinh = [], bo = [], mw = new THREE.Matrix4(), mi = new THREE.Matrix4(), c = new THREE.Color();
  const lay = (geo, m, mau) => { let x = geo.clone().applyMatrix4(m); if (x.index) x = x.toNonIndexed();
    for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k);
    if (mau) { const a = new Float32Array(x.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = mau.r; a[i + 1] = mau.g; a[i + 2] = mau.b; } x.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    return x; };
  g.traverse((m) => {
    if (!m.isMesh || m.userData.va || !m.visible || m.material.userData.than) return;
    const laKinh = m.material === V_KINH, ds = laKinh ? kinh : phu; mw.multiplyMatrices(inv, m.matrixWorld);
    if (m.isInstancedMesh) for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mi); c.copy(m.material.color); if (m.instanceColor) { const t = new THREE.Color(); m.getColorAt(i, t); c.multiply(t); } ds.push(lay(m.geometry, mi.premultiply(mw), laKinh ? null : c)); }
    else ds.push(lay(m.geometry, mw, laKinh ? null : m.material.color));
    bo.push(m);
  });
  for (const m of bo) { m.parent.remove(m); if (m.isInstancedMesh) m.dispose(); }
  if (phu.length) g.add(new THREE.Mesh(mergeGeometries(phu), V_PHU));
  if (kinh.length) g.add(new THREE.Mesh(mergeGeometries(kinh), V_KINH));
}

// lọc instance theo tầm nhìn + tầm xa: giữ bản gốc (ma trận, màu, thuộc tính đi bộ), mỗi nhịp chép những cái nằm trong khung nhìn
// và trong bán kính R lên đầu mảng rồi đặt count. Trước đây 16.000 người + 1.100 quầy vẽ hết kể cả ở xa 2 km: 7,7 triệu tam giác mỗi khung.
// ms = các lớp dùng chung một instanceMatrix; r = bán kính cầu bao một cái (người đi tới lui ±12 m nên r lớn)
const _fr = new THREE.Frustum(), _pv = new THREE.Matrix4(), _cau = new THREE.Sphere();
function taoBo(ms, n, R, r) {
  const src = new Float32Array(n * 16), mau = ms.map((m) => m.instanceColor ? new Float32Array(m.instanceColor.array.length) : null);
  const phu = []; for (const m of ms) for (const a of Object.values(m.geometry.attributes)) if (a.isInstancedBufferAttribute && !phu.some((p) => p.a === a)) phu.push({ a, src: null });
  return { ms, n, R, r, src, mau, phu, dem: 0, Rmin: 0, an: null, // an[i] = 1: bỏ (người gần đang do nguoi-gan.js vẽ) // Rmin: bỏ cái GẦN hơn mức này (lớp xa của một cặp gần / xa)
    chot() { // gọi sau khi dựng xong màu / thuộc tính: chép bản gốc
      ms.forEach((m, k) => { if (mau[k]) mau[k].set(m.instanceColor.array); }); for (const p of phu) p.src = p.a.array.slice(); },
    dat(i, m4) { m4.toArray(src, i * 16); },
    loc(cam) { const R2 = this.R * this.R, Rm2 = this.Rmin * this.Rmin, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, dst = ms[0].instanceMatrix.array; let k = 0;
      for (let i = 0; i < this.dem; i++) { const o = i * 16, x = src[o + 12], y = src[o + 13], z = src[o + 14], d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 > R2 || d2 < Rm2 || (this.an && this.an[i])) continue; _cau.center.set(x, y, z); _cau.radius = this.r + Math.sqrt(d2) * 0.15; if (!_fr.intersectsSphere(_cau)) continue;
        if (k !== i) { const ok = k * 16; for (let j = 0; j < 16; j++) dst[ok + j] = src[o + j];
          for (const [q, a] of mau.entries()) if (a) { const d = ms[q].instanceColor.array; d[k * 3] = a[i * 3]; d[k * 3 + 1] = a[i * 3 + 1]; d[k * 3 + 2] = a[i * 3 + 2]; }
          for (const p of phu) { const s = p.a.itemSize; for (let j = 0; j < s; j++) p.a.array[k * s + j] = p.src[i * s + j]; } }
        else { for (let j = 0; j < 16; j++) dst[o + j] = src[o + j]; }
        k++; }
      const cap = (a) => { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, k * a.itemSize)); a.needsUpdate = true; };
      cap(ms[0].instanceMatrix); ms.forEach((m) => { m.count = k; if (m.instanceColor) cap(m.instanceColor); }); for (const p of phu) cap(p.a);
      return k; } };
}

// một tháp đỏ hoàn chỉnh (thân + ban công + đỉnh + chi tiết nhìn gần), gốc toạ độ ở chân.
// Mesh mang userData.va = khung va chạm (ẩn, ít đỉnh) — dungVa gộp thành một trimesh mỗi tháp để đứng / leo được.
// vMax: bán kính ngoài cùng được phép (thân + ban công) — dấu chân luật khớp; thân phình quá thì thu cả hồ sơ lại cho vừa.
const BC_MAX = 5; // ban công rộng nhất (đài kính trên cùng 3–5 m)
function dungThap(R, H, gen, r, vKim, vMax = R * TL.vetDo) {
  const g = new THREE.Group(), hs = dungHoSo(R, H, gen.dang, r);
  { const k = Math.min(1, (vMax - BC_MAX) / hs.rMax); if (k < 1) { for (const v of hs.p) v.x *= k; hs.rC *= k; hs.rMax *= k; } }
  gen.than = hs.than;
  const va = (geo, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo); m.visible = false; m.userData.va = true; m.position.set(x, y, z); g.add(m); return m; };
  const vT = vatThap(gen), vBC = new THREE.MeshStandardMaterial({ color: new THREE.Color(gen.mau).multiplyScalar(0.72), roughness: 0.85, side: THREE.DoubleSide });
  const vV = new THREE.MeshStandardMaterial({ color: gen.vien, roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide });
  let geo = new THREE.LatheGeometry(hs.p, 96);
  if (gen.gan) geo = khiaGan(geo, hs.than, gen.gan, 0.035);
  g.add(new THREE.Mesh(geo, vT));
  const kVa = 1 / Math.cos(Math.PI / 28) * 0.5 + 0.5; // khung va thô 28 cạnh, nới ra cho mặt va sát mặt nhìn
  va(new THREE.LatheGeometry(hs.p, 28).scale(kVa, 1, kVa));

  // ban công vòng: lan can (sàn + cột + tay vịn) · đài kính quan sát (vách kính, đố, mái, lan can trên mái) · tường chắn
  const nBC = 2 + ((r() * 4) | 0), dsBC = [];
  for (let k = 0; k < nBC; k++) {
    const cuoi = k === nBC - 1 && r() < 0.65;
    const y = Math.min(batTang(hs.than * 0.94) - TL.tang, batTang(cuoi ? hs.than * (0.9 + r() * 0.04) : hs.than * (0.22 + 0.62 * (k + 0.3 + r() * 0.4) / nBC))); // sàn ban công = sàn tầng thật
    const rv = hs.rTai(y), rong = cuoi ? 3 + r() * 2 : 1.8 + r() * 1.8, ro = rv + rong, mv = r() < 0.35 ? vV : vBC;
    const kieu = cuoi ? 'kinh' : chon(r, ['lan', 'lan', 'kinh', 'tuong']);
    dsBC.push(y);
    const gSan = new THREE.CylinderGeometry(ro, ro, 0.5, 72);
    const san = new THREE.Mesh(gSan, mv); san.position.y = y; g.add(san); va(gSan, 0, y, 0);
    if (kieu === 'lan') {
      for (const yy of [TL.lanCan, 0.6]) { const t = new THREE.Mesh(new THREE.TorusGeometry(ro - 0.1, yy > 1 ? 0.07 : 0.045, 4, 96), vKim); t.rotation.x = Math.PI / 2; t.position.y = y + 0.25 + yy; g.add(t); }
      const n = Math.round(Math.PI * 2 * ro / 1.6), cot = new THREE.InstancedMesh(G_COT, vKim, n);
      for (let i = 0; i < n; i++) datRa(cot, i, (i / n) * Math.PI * 2, ro - 0.1, y + 0.8, 1, TL.lanCan, 1);
      g.add(cot); va(new THREE.CylinderGeometry(ro - 0.1, ro - 0.1, 1.2, 32, 1, true), 0, y + 0.85, 0);
    } else if (kieu === 'kinh') {
      const hk = TL.tang - 0.4, gV = new THREE.CylinderGeometry(ro - 0.2, ro - 0.2, hk, 72, 1, true);
      const vach = new THREE.Mesh(gV, V_KINH); vach.position.y = y + 0.25 + hk / 2; g.add(vach); va(gV, 0, y + 0.25 + hk / 2, 0);
      const n = Math.round(Math.PI * 2 * ro / 2.4), dua = new THREE.InstancedMesh(G_HOP, vV, n);
      for (let i = 0; i < n; i++) datRa(dua, i, (i / n) * Math.PI * 2, ro - 0.2, y + 0.25 + hk / 2, 0.18, hk, 0.18);
      g.add(dua);
      const gM = new THREE.CylinderGeometry(ro + 0.3, ro + 0.3, 0.4, 72), mai = new THREE.Mesh(gM, vV); mai.position.y = y + 0.45 + hk; g.add(mai); va(gM, 0, y + 0.45 + hk, 0);
      const tv = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.1, 0.07, 4, 96), vKim); tv.rotation.x = Math.PI / 2; tv.position.y = y + 1.75 + hk; g.add(tv);
      const nc = Math.round(Math.PI * 2 * ro / 1.8), cot = new THREE.InstancedMesh(G_COT, vKim, nc);
      for (let i = 0; i < nc; i++) datRa(cot, i, (i / nc) * Math.PI * 2, ro + 0.1, y + 1.2 + hk, 1, 1.1, 1);
      g.add(cot); va(new THREE.CylinderGeometry(ro + 0.1, ro + 0.1, 1.2, 32, 1, true), 0, y + 1.25 + hk, 0);
    } else {
      const hc = 1.2 + r(), gT = new THREE.CylinderGeometry(ro, ro, hc, 72, 1, true);
      const tuong = new THREE.Mesh(gT, mv); tuong.position.y = y + 0.25 + hc / 2; g.add(tuong); va(gT, 0, y + 0.25 + hc / 2, 0);
    }
  }
  // cổ chóp: đai viền dày
  const yc = hs.than, rc = hs.rC;
  const gDai = new THREE.CylinderGeometry(rc + 1.2, rc + 1.6, 3.2, 72), dai = new THREE.Mesh(gDai, vV); dai.position.y = yc - 1; g.add(dai); va(gDai, 0, yc - 1, 0);

  // hộp ốp tường: máy lạnh, cửa sập, ống đứng — rải theo thân, tô đỏ đậm nhạt / xám / màu viền
  const nHop = Math.round(hs.than * (0.5 + r() * 0.4)), hop = new THREE.InstancedMesh(G_HOP, V_HOP, nHop), mauDo = new THREE.Color(gen.mau);
  for (let i = 0; i < nHop; i++) {
    const y = 5 + r() * (hs.than * 0.94 - 5), a = r() * Math.PI * 2, rr = hs.rTai(y), loai = r();
    const [sx, sy, sz] = loai < 0.5 ? [1.3 + r() * 0.6, 0.8 + r() * 0.3, 0.7 + r() * 0.3] : loai < 0.8 ? [1.8 + r(), 2.4 + r() * 0.6, 0.35] : [0.35, 5 + r() * 14, 0.35];
    datRa(hop, i, a, rr + sz / 2 - 0.05, y, sx, sy, sz);
    const c = r(); hop.setColorAt(i, c < 0.55 ? _c4.copy(mauDo).multiplyScalar(0.55 + r() * 0.35) : c < 0.8 ? _c4.set('#6d6a66').multiplyScalar(0.8 + r() * 0.4) : _c4.set(gen.vien));
  }
  g.add(hop);
  // cửa tròn lớn: vành viền + kính tối
  const nTron = 3 + ((r() * 8) | 0), vanh = new THREE.InstancedMesh(G_VANH, vV, nTron), kt = new THREE.InstancedMesh(G_KINH_TRON, V_TRON, nTron);
  for (let i = 0; i < nTron; i++) {
    const y = hs.than * (0.12 + r() * 0.8), a = r() * Math.PI * 2, rr = hs.rTai(y), rp = 1.4 + r() * 1.2;
    datRa(vanh, i, a, rr + 0.18, y, rp, rp, rp); datRa(kt, i, a, rr + 0.1, y, rp, rp, 1);
  }
  g.add(vanh, kt);
  // bầu bên: 0-2 khoang tròn bám thân, có chân đỡ hình nón + đai cổ, tự mang cửa sổ như thân chính
  const nBau = gen.phu ? 0 : (r() * 3) | 0;
  for (let i = 0; i < nBau; i++) {
    const rb = R * (0.18 + r() * 0.1), hb = rb * (2.4 + r() * 0.6), y = hs.than * (0.35 + r() * 0.4), a = r() * Math.PI * 2, d = hs.rTai(y) + rb * 0.7;
    const hp = dungHoSo(rb, hb, 'dan', r), gb = { ...gen, than: hp.than, soc: 0 };
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const bau = new THREE.Mesh(new THREE.LatheGeometry(hp.p, 48), vatThap(gb)); bau.position.set(bx, y, bz); g.add(bau);
    va(new THREE.LatheGeometry(hp.p, 16).scale(1.02, 1, 1.02), bx, y, bz);
    const gN = new THREE.ConeGeometry(rb * 0.95, rb * 1.8, 24).rotateX(Math.PI), non = new THREE.Mesh(gN, vV); non.position.set(bx, y - rb * 0.9, bz); g.add(non); va(gN, bx, y - rb * 0.9, bz);
    const co = new THREE.Mesh(new THREE.TorusGeometry(hp.rC + 0.25, 0.3, 6, 32), vV); co.rotation.x = Math.PI / 2; co.position.set(bx, y + hp.than, bz); g.add(co);
  }
  // cần trục: 1-2 tay vươn gần đỉnh (dầm, thanh chống chéo, cáp, kiện hàng)
  const nCan = 1 + (r() < 0.4 ? 1 : 0);
  for (let i = 0; i < nCan; i++) {
    const y = hs.than * (0.84 + r() * 0.12), a = r() * Math.PI * 2, rr = hs.rTai(y), L = 8 + r() * 10, cg = new THREE.Group();
    cg.position.y = y; cg.rotation.y = -a;
    const dam = new THREE.Mesh(new THREE.BoxGeometry(L, 0.6, 0.6), vKim); dam.position.x = rr + L / 2 - 0.3; cg.add(dam);
    const dx = L * 0.7, dy = L * 0.35, chong = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy), 0.35, 0.35), vKim);
    chong.position.set(rr + dx / 2, -dy / 2, 0); chong.rotation.z = Math.atan2(dy, dx); cg.add(chong);
    const hc = 5 + r() * 15, cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, hc, 4), vKim); cap.position.set(rr + L - 0.8, -hc / 2, 0); cg.add(cap);
    const kien = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), vV); kien.position.set(rr + L - 0.8, -hc - 0.7, 0); cg.add(kien);
    g.add(cg);
  }
  // đỉnh: ăng-ten chùm · kim cao + vòng hào quang · chòi nhỏ có mái vòm
  const dinh = gen.dinh, yTop = H;
  if (hs.chop === 'choi') {
    const rr = rc * 0.32, gC = new THREE.CylinderGeometry(rr, rr * 1.1, rr * 1.6, 24), ch = new THREE.Mesh(gC, vV); ch.position.y = yTop + rr * 0.8 - 0.5; g.add(ch); va(gC, 0, yTop + rr * 0.8 - 0.5, 0);
    const gV = new THREE.SphereGeometry(rr * 1.05, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), vm = new THREE.Mesh(gV, vT); vm.position.y = yTop + rr * 1.6 - 0.5; g.add(vm); va(gV, 0, yTop + rr * 1.6 - 0.5, 0);
  }
  const yDinh = hs.chop === 'choi' ? yTop + rc * 0.32 * 2.6 : yTop;
  if (dinh === 'kim' || hs.chop === 'nhon') {
    const cao = H * (0.12 + r() * 0.1), kim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.1, cao, 8), vKim); kim.position.y = yDinh + cao / 2 - 1; g.add(kim);
    if (r() < 0.6) { const hq = new THREE.Mesh(new THREE.TorusGeometry(2.5 + r() * 3, 0.35, 6, 32), vV); hq.rotation.x = Math.PI / 2; hq.position.y = yDinh + cao * 0.4; g.add(hq); }
  } else {
    const nAng = 1 + ((r() * 4) | 0);
    for (let a = 0; a < nAng; a++) {
      const cao = H * (0.06 + r() * 0.08), lech = a ? rc * 0.35 : 0, ga = a * 2.1 + r();
      const kim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, cao, 6), vKim);
      kim.position.set(Math.cos(ga) * lech, yDinh - (a ? rc * 0.2 : 0) + cao / 2 - 1, Math.sin(ga) * lech); g.add(kim);
    }
  }
  return { g, hs };
}

export function taoRedSpires({ RAPIER, world, tinh, datTai, ql, bao }) {
  const goc = new THREE.Group(); goc.visible = false; goc.name = 'red-spires';
  const thap = ql.thap;

  // ---------- chất liệu nhà PLATEAU: xanh xám, cửa tối, vườn mái; khoét nhà thật dưới tháp đỏ ----------
  // bộ khoét đổi được: Red Spires khoét dưới tháp đỏ, Nhật 2200 nạp bộ tháp trắng của nó (rs.khoet); z = bán kính, w = chân tháp
  const MAX_KHOET = 128, khoetDo = thap.map((t) => new THREE.Vector4(t.o[0], t.o[1], t.banKinh * TL.vetDo, 0)); // khoét phố thấp đúng dấu chân luật khớp
  const uKhoet = { uThap: { value: Array.from({ length: MAX_KHOET }, () => new THREE.Vector4()) }, uSoKhoet: { value: 0 } };
  let khoetRieng = null;
  function napKhoet() { const src = khoetRieng || khoetDo, n = Math.min(MAX_KHOET, src.length);
    for (let i = 0; i < n; i++) uKhoet.uThap.value[i].copy(src[i]); uKhoet.uSoKhoet.value = n;
    if (src.length > MAX_KHOET) console.warn(`[sprawl] khoét ${src.length} tháp, quá trần ${MAX_KHOET}: tháp thừa đứng lẫn nhà PLATEAU`); }
  napKhoet();
  const vatPho = new THREE.MeshLambertMaterial({ color: '#7f93a3', side: THREE.DoubleSide }); // hai mặt: tường PLATEAU lật pháp tuyến không thành tường tàng hình (vẫn va chạm)
  vatPho.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uKhoet, U_DEN, uSang);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform vec4 uThap[${MAX_KHOET}]; uniform int uSoKhoet; uniform float uDen, uTg, uSang;
      float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      for (int i = 0; i < ${MAX_KHOET}; i++) { if (i >= uSoKhoet) break; vec4 t = uThap[i]; float d = length(vWp.xz - t.xy);
        if (d < t.z * 1.3 || (d < t.z * 2.6 && vWp.y > t.w + 55.0)) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 nw = normalize(cross(dFdx(vWp), dFdy(vWp)));
      vec2 k = floor(vWp.xz / 22.0);
      float hk = bam(k), hm = bam(k + 7.7), hs = bam(k + 3.1);
      // mỗi khối một bảng màu: xanh xám · đá kem · đá phiến · xanh rêu xám · gạch nhạt
      vec3 m0 = vec3(0.50, 0.58, 0.64), m1 = vec3(0.74, 0.71, 0.64), m2 = vec3(0.40, 0.45, 0.50), m3 = vec3(0.50, 0.60, 0.57), m4 = vec3(0.68, 0.56, 0.50);
      vec3 mk = hm < 0.42 ? m0 : hm < 0.6 ? m2 : hm < 0.76 ? m1 : hm < 0.9 ? m3 : m4;
      diffuseColor.rgb = mk * (0.85 + 0.25 * hk);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.85, 0.82) * (0.86 + 0.16 * hk), uSang);
      float den = 0.0;
      if (abs(nw.y) > 0.6) {                                                   // mái: vườn mái hoặc bê tông, có bồn nước / máy lạnh rải
        if (hk > 0.55) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.46, 0.28), 0.75 * step(0.3, bam(floor(vWp.xz / 3.0))));
        else diffuseColor.rgb *= 0.9 + 0.15 * step(0.85, bam(floor(vWp.xz / 2.0)));
      } else {
        bool trucX = abs(nw.x) > abs(nw.z);
        float u = (trucX ? vWp.z : vWp.x);
        vec2 g = vec2(u / 2.2, vWp.y / ${TL.tang.toFixed(2)}), f = fract(g);
        float cua;
        if (hs < 0.4) cua = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.78);          // ô cửa lưới
        else if (hs < 0.7) cua = step(0.35, f.y) * step(f.y, 0.8);                                            // dải kính ngang
        else { cua = step(0.15, fract(u / 1.1)) * step(0.2, f.y); diffuseColor.rgb *= 0.9 + 0.12 * step(0.85, fract(u / 1.1)); } // vây dọc
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.25, 0.3), cua * 0.6);
        vec2 oc = floor(g) + k * 31.0; den = cua * step(0.84, bam(oc + floor(uTg * 0.08 + bam(oc) * 9.0))) * (0.5 + 0.5 * bam(oc + 2.0)) * 0.8;
        diffuseColor.rgb *= 1.0 - 0.18 * step(fract(vWp.y / ${TL.tang.toFixed(2)}), 0.08) * step(0.5, hk);                     // gờ tầng
      }`)
      .replace('#include <emissivemap_fragment>', DEN_EMIT);
  };

  // ---------- tháp đỏ: mỗi tháp một bộ gen ----------
  const vKim = new THREE.MeshStandardMaterial({ color: '#3a3532', roughness: 0.6, metalness: 0.5 });
  const dsThap = thap.map((t, i) => {
    const r = gieo(t.id + 17), R = t.banKinh, H = t.caoSpire;
    const dang = DANG[(i * 5 + ((r() * 2) | 0)) % DANG.length]; // xoay vòng đủ sáu dáng, tháp liền hạng không trùng dáng
    const tang = TL.tang; // một chiều cao tầng cho mọi tháp — cầu nối, ban công, sàn vườn mới khớp nhau
    const gen = { dang, r: r(), mau: chon(r, MAU_DO), vien: chon(r, MAU_VIEN), oRong: 2.2 + r() * 1.1, tang, bang: tang * (6 + ((r() * 5) | 0)),
      tron: 0.78 + r() * 0.17, soc: (r() * 4) | 0, gan: r() < 0.4 ? 14 + ((r() * 14) | 0) : 0, dinh: r() < 0.45 ? 'kim' : 'ang' };
    const { g, hs } = dungThap(R, H, gen, r, vKim);
    let rVa = hs.rMax;
    if (dang === 'chum') { // 2-3 tháp vệ tinh dính chân, thấp hơn, cùng họ màu
      const n = 2 + (r() < 0.5 ? 1 : 0), g0 = r() * 6.28;
      for (let k = 0; k < n; k++) {
        const gv = { ...gen, dang: chon(r, ['dan', 'non', 'hanh']), gan: 0, dinh: 'kim', soc: (gen.soc + k + 1) % 4, phu: 1 }, a = g0 + k * 6.28 / n;
        const dV = R * 0.8, v = dungThap(R * (0.36 + r() * 0.08), batTang(H * (0.45 + r() * 0.25)), gv, r, vKim, R * TL.vetDo - dV); // vệ tinh nằm gọn trong dấu chân
        v.g.position.set(Math.cos(a) * dV, 0, Math.sin(a) * dV); g.add(v.g);
      }
      rVa = R * TL.vetDo;
    }
    gopThap(g);
    g.rotation.y = r() * 6.28;
    g.position.set(t.o[0], 0, t.o[1]);
    goc.add(g);
    return { t, g, R: rVa, than: hs.than, rTai: hs.rTai, dang, va: null };
  });

  // ---------- đường phân cấp: đại lộ (lòng nhựa 2 làn mỗi chiều, vỉa hè rộng 8 m có chợ) · đường xe (1 làn mỗi chiều, vỉa hè) · lối đi bộ lát đá · phố nhỏ · đường tàu ----------
  // LONG = nửa bề rộng LÒNG ĐƯỜNG nhựa: một nguồn cho hình vẽ (shader), chỗ đứng của người / sạp, và làn xe chạy (song.js) → không còn cảnh xe chạy giữa chợ.
  // mỗi đỉnh mang aR = (s lệch ngang m, v dọc đường m, dA / dB = khoảng cách tới mép đường cắt ở nút trước / sau).
  // dA, dB tuyến tính trong mỗi đoạn chạy giữa hai nút → shader vẽ giao lộ sạch, ngựa vằn, vạch dừng đúng chỗ.
  const D = TL.duong, LOP = { lon: { hw: D.lon, u: -14 }, dibo: { hw: D.dibo, u: -12 }, vua: { hw: D.vua, u: -10 }, tau: { hw: 2.4, u: -8 }, pho: { hw: D.pho, u: -6 } }; // u: độ lệch sâu, cách nhau 2 nấc (lượt phủ vua = -11)
  const RONG = { lon: 2 * D.lon, vua: 2 * D.vua, dibo: 2 * D.dibo }, LONG = { lon: 7, vua: 5.6 };
  // khuôn ngang MỖI tuyến xe (k): raP / raM = mép lòng nhựa phía s dương / âm, hwP / hwM = mép ngoài dải, lan = số làn, mot = một chiều (xe đi theo thứ tự g),
  // giua = phía có dải phân cách (+1 / -1 / 0). OSM vẽ đường đôi thành hai tuyến một chiều (doi = khoảng cách tới nửa kia, có dấu) → mỗi nửa chỉ có vỉa hè phía ngoài,
  // phía trong là dải phân cách kéo tới nửa khoảng hở; không thì hai dải hai chiều chồng nhau thành vỉa hè chạy giữa đường (sprawl.on.tc 23/11/2026).
  const LAN_RONG = 3.1, VIA_HE = { lon: D.lon - LONG.lon, vua: D.vua - LONG.vua };
  const khuon = (d) => { if (!LONG[d.lop]) return null; const via = VIA_HE[d.lop];
    if (d.mot) { const n = d.lan || (d.lop === 'lon' ? 2 : 1), a = Math.min(9, (n * LAN_RONG + 0.8) / 2), k = { raP: a, raM: a, hwP: a + via, hwM: a + via, lan: n, mot: 1, giua: 0 };
      if (d.doi) { const h = Math.abs(d.doi) / 2, ri = Math.min(a, h), hi = Math.min(h, a + 6); if (d.doi > 0) { k.raP = ri; k.hwP = hi; k.giua = 1; } else { k.raM = ri; k.hwM = hi; k.giua = -1; } }
      return k; }
    const a = d.lan ? Math.min(12, Math.max(3, (d.lan * LAN_RONG + 0.8) / 2)) : LONG[d.lop];
    return { raP: a, raM: a, hwP: a + via, hwM: a + via, lan: d.lan || (d.lop === 'lon' ? 4 : 2), mot: 0, giua: 0 }; };
  for (const d of ql.daiLo) d.k = khuon(d);
  const tuyen = [...ql.daiLo.map((d) => ({ lop: d.lop, g: d.g, k: d.k, hw: d.k ? Math.max(d.k.hwP, d.k.hwM) : LOP[d.lop].hw })), ...ql.pho.map((g) => ({ lop: 'pho', g, hw: D.pho })), ...ql.tau.map((g) => ({ lop: 'tau', g, hw: LOP.tau.hw }))];
  const khoa = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1), nut = new Map(); // bậc mỗi điểm: giữa tuyến 2, đầu tuyến 1
  for (const t of tuyen) { if (t.lop === 'tau') continue; const hw = t.hw, xe = t.lop !== 'pho';
    t.g.forEach((p, i) => { const k = khoa(p); let n = nut.get(k); if (!n) nut.set(k, n = { xe: 0, tat: 0, hw: 0, hwXe: 0, hwlon: 0, hwvua: 0 });
      const b = i === 0 || i === t.g.length - 1 ? 1 : 2; n.tat += b; n[t.lop] = (n[t.lop] || 0) + b; n.hw = Math.max(n.hw, hw); if (xe) { n.xe += b; n.hwXe = Math.max(n.hwXe, hw); if (n['hw' + t.lop] !== undefined) n['hw' + t.lop] = Math.max(n['hw' + t.lop], hw); } }); }
  // đường xe chỉ cắt bởi đường lớn (phố nhỏ chui dưới vỉa hè liền); phố nhỏ cắt bởi mọi đường; đại lộ cắt bởi đại lộ khác (rộng 15) hoặc đường xe (rộng 9)
  const nuaNut = (lop, p) => { const n = nut.get(khoa(p)); if (!n) return 0; if (lop === 'vua') return n.xe >= 3 ? n.hwXe : 0;
    if (lop === 'lon') return n.xe >= 3 ? ((n.lon || 0) >= 3 ? n.hwlon : n.vua ? n.hwvua : 0) : 0; if (lop === 'pho') return n.tat >= 3 ? n.hw : 0; return 0; };
  const loDuong = {};
  for (const k of Object.keys(LOP)) loDuong[k] = { xz: [], r: [], k: [], l: [], idx: [] };
  for (const t of tuyen) {
    const hw = t.hw, kh = t.k || { raP: 0, raM: 0, hwP: hw, hwM: hw, lan: 0, mot: 0, giua: 0 }, B = loDuong[t.lop], g = [t.g[0]];
    for (let i = 1; i < t.g.length; i++) { const q = g[g.length - 1], l = Math.hypot(t.g[i][0] - q[0], t.g[i][1] - q[1]); if (l <= 0.5) continue;
      const n = Math.ceil(l / 8); for (let c = 1; c < n; c++) g.push([q[0] + (t.g[i][0] - q[0]) * c / n, q[1] + (t.g[i][1] - q[1]) * c / n]); // chia đoạn ≤ 8 m: đỉnh dải đường bám đất (ô đất 16 m), không để mặt đất cong trồi xuyên lòng đường giữa hai nút OSM xa nhau → hết nháy
      g.push(t.g[i]); }
    if (g.length < 2) continue;
    const v = [0]; for (let i = 1; i < g.length; i++) v.push(v[i - 1] + Math.hypot(g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]));
    const cat = [0]; for (let i = 1; i < g.length - 1; i++) if (nuaNut(t.lop, g[i])) cat.push(i); cat.push(g.length - 1);
    for (let c = 1; c < cat.length; c++) { const a = cat[c - 1], b = cat[c], hA = nuaNut(t.lop, g[a]), hB = nuaNut(t.lop, g[b]);
      const goc0 = B.xz.length / 2;
      for (let i = a; i <= b; i++) {
        const d0 = i > a ? [g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]] : null, d1 = i < b ? [g[i + 1][0] - g[i][0], g[i + 1][1] - g[i][1]] : null;
        const n0 = d0 && Math.hypot(...d0), n1 = d1 && Math.hypot(...d1);
        let tx = (d0 ? d0[0] / n0 : 0) + (d1 ? d1[0] / n1 : 0), tz = (d0 ? d0[1] / n0 : 0) + (d1 ? d1[1] / n1 : 0); const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const ds = d1 ? [d1[0] / n1, d1[1] / n1] : [d0[0] / n0, d0[1] / n0], m = 1 / Math.max(0.4, tx * ds[0] + tz * ds[1]); // nối vát góc (miter)
        let [x, z] = g[i], vv = v[i];
        const dau = (i === 0 && !hA) ? -1 : (i === g.length - 1 && !hB) ? 1 : 0; // đầu tuyến hở: kéo dài cho kín mối nối
        if (dau) { x += tx * hw * 0.4 * dau; z += tz * hw * 0.4 * dau; vv += hw * 0.4 * dau; }
        const dA = hA ? vv - v[a] - hA : 1e4, dB = hB ? v[b] - vv - hB : 1e4;
        for (const sd of [1, -1]) { const h = sd > 0 ? kh.hwP : kh.hwM; B.xz.push(x - tz * h * m * sd, z + tx * h * m * sd); B.r.push(h * sd, vv, dA, dB); B.k.push(kh.raP, kh.raM, kh.hwP, kh.hwM); B.l.push(kh.lan, kh.giua, kh.mot, 0); }
      }
      for (let i = 0; i < b - a; i++) { const l0 = goc0 + i * 2, r0 = l0 + 1, l1 = l0 + 2, r1 = l0 + 3; B.idx.push(l0, l1, r0, r0, l1, r1); }
    }
  }
  const DAU = `float s = vR.x, as = abs(s), v = vR.y, dj = min(vR.z, vR.w);
      float ra = s >= 0.0 ? vK.x : vK.y, hs = s >= 0.0 ? vK.z : vK.w, nl = vL.x, mot = vL.z, giua = step(0.5, s * vL.y); // khuôn ngang của tuyến (xem khuon)
      float e = max(fwidth(s), 0.003) * 0.8, ro = 1.0 - smoothstep(0.07, 0.3, e);   // ro: vạch / mạch mờ dần ở xa, khỏi nhiễu răng cưa
      float fw = length(fwidth(vWp.xz)); // bề ngang một điểm ảnh trên mặt đường (m): chấm nhiễu nhỏ hơn ~2 điểm ảnh thì mờ về trung bình, không thì mỗi khung camera nhích là mỗi điểm ảnh bốc một chấm ngẫu nhiên khác = mặt đường lấp lánh (anh 23/11/2026)
      float n1 = mix(bam(floor(vWp.xz * 1.7)), 0.5, smoothstep(0.12, 0.35, fw)), n2 = mix(bam(floor(vWp.xz / 7.0) + 3.1), 0.5, smoothstep(1.5, 4.0, fw));
      vec3 NHUA = vec3(0.045, 0.05, 0.057) * (0.86 + 0.18 * n1 + 0.16 * n2), TRANG = vec3(0.82, 0.82, 0.78), VIA = vec3(0.36, 0.34, 0.3);`;
  // vạch làn: hai chiều thì m làn mỗi chiều chia đều [0,3 .. ra − 0,3] hai bên tim; một chiều thì nl làn chia đều cả lòng [−raM .. raP]
  const VACH_LAN = `float vLan = 0.0;
      if (mot > 0.5) { float W = vK.x + vK.y, w = (W - 0.8) / max(nl, 1.0), q = (s + vK.y - 0.4) / w, kq = floor(q + 0.5);
        vLan = dai(abs(q - kq) * w, -1.0, 0.07, e) * step(0.5, kq) * step(kq, nl - 0.5); }
      else { float m = max(1.0, floor(nl / 2.0)), w = (ra - 0.6) / m, q = (as - 0.3) / w, kq = floor(q + 0.5);
        vLan = dai(abs(q - kq) * w, -1.0, 0.07, e) * step(0.5, kq) * step(kq, m - 0.5); }
      vLan *= step(fract(v / 10.0), 0.5) * step(7.5, dj);
      float dung = dai(dj, 6.0, 6.4, e) * mix(step(0.0, -s * sign(vR.z - vR.w)), step(vR.w, vR.z), mot); // vạch dừng: hai chiều = nửa bên trái (Nhật); một chiều = cả lòng, chỉ ở đầu xe tới`;
  // dải phân cách giữa hai nửa đường đôi (phía giua): bó vỉa sát lòng đường + thảm cỏ / bụi thấp, thay cho vỉa hè
  const DAI_GIUA = `vec3 dg = vec3(0.24, 0.31, 0.17) * (0.78 + 0.3 * n1 + 0.12 * n2);
      dg = mix(dg, vec3(0.56, 0.55, 0.5), dai(as, ra, ra + 0.4, e)); he = mix(he, dg, giua);`;
  const VE = {
    lon: `float giao = 1.0 - step(0.0, dj);                     // giao: đang trong lòng đường cắt
      vec2 f = abs(fract(vWp.xz / 3.0) - 0.5);
      vec3 he = vec3(0.74, 0.69, 0.6) * (0.93 + 0.09 * n2) * (1.0 - 0.13 * smoothstep(0.455, 0.475, max(f.x, f.y)) * ro);
      he = mix(he, vec3(0.42, 0.39, 0.34), dai(as, ra + 1.6, ra + 1.9, e) * ro);  // lằn đá trang trí dọc vỉa hè
      he = mix(he, vec3(0.2, 0.19, 0.17), dai(as, hs - 0.65, hs + 1.0, e));       // bó vỉa mép ngoài
      ${DAI_GIUA}
      float leDuong = smoothstep(ra - e, ra + e, as) * (1.0 - giao);
      vec3 c = mix(NHUA, he, leDuong);
      c = mix(c, VIA, dai(as, ra, ra + 0.3, e) * (1.0 - giao));        // bó vỉa dọc
      c = mix(c, VIA, dai(dj, 0.0, 0.3, e) * smoothstep(ra - e, ra + e, as)); // bó vỉa vòng góc giao lộ
      float trong = 1.0 - smoothstep(ra - 0.35 - e, ra - 0.35 + e, as), vach = 0.0;
      ${VACH_LAN}
      vach += dai(as, 0.1, 0.22, e) * step(7.5, dj) * (1.0 - mot);                             // tim đường hai chiều: vạch đôi liền
      vach += vLan;                                                                             // vạch chia làn
      vach += dai(as, ra - 0.6, ra - 0.45, e) * step(0.0, dj);                                 // mép liền
      vach += dai(dj, 1.2, 5.2, e) * smoothstep(0.5 - e, 0.5 + e, fract(s / 1.0)) * trong;     // ngựa vằn
      vach += dung * trong;                                                                     // vạch dừng
      c = mix(c, TRANG, clamp(vach, 0.0, 1.0) * ro * (1.0 - smoothstep(ra - e, ra + e, as)));`,
    dibo: `vec2 q = vWp.xz / 1.5, f = abs(fract(q) - 0.5);
      vec3 c = vec3(0.66, 0.62, 0.55) * (0.9 + 0.14 * bam(floor(q))) * (1.0 - 0.15 * smoothstep(0.45, 0.48, max(f.x, f.y)) * ro);
      c = mix(c, vec3(0.24, 0.22, 0.2), dai(as, 6.4, 8.0, e));`,
    vua: `float giao = 1.0 - step(0.0, dj);                     // giao: đang trong lòng đường cắt
      vec2 q = vWp.xz / 0.9, f = abs(fract(q) - 0.5);
      vec3 he = vec3(0.56, 0.53, 0.46) * (0.9 + 0.12 * mix(bam(floor(q)), 0.5, smoothstep(0.2, 0.5, fw))) * (1.0 - 0.12 * smoothstep(0.44, 0.48, max(f.x, f.y)) * ro);
      ${DAI_GIUA}
      float leDuong = smoothstep(ra - e, ra + e, as) * (1.0 - giao);
      vec3 c = mix(NHUA, he, leDuong);
      c = mix(c, VIA, dai(as, ra, ra + 0.3, e) * (1.0 - giao));        // bó vỉa dọc
      c = mix(c, VIA, dai(dj, 0.0, 0.3, e) * smoothstep(ra - e, ra + e, as)); // bó vỉa vòng góc giao lộ
      float trong = 1.0 - smoothstep(ra - 0.35 - e, ra - 0.35 + e, as), vach = 0.0;
      ${VACH_LAN}
      vach += dai(as, -1.0, 0.08, e) * step(fract(v / 10.0), 0.5) * step(7.5, dj) * (1.0 - mot); // tim đường hai chiều: vạch đứt
      vach += vLan;                                                                           // vạch chia làn
      vach += dai(as, ra - 0.6, ra - 0.45, e) * step(0.0, dj);                               // mép liền
      vach += dai(dj, 1.2, 5.2, e) * smoothstep(0.5 - e, 0.5 + e, fract(s / 1.0)) * trong;   // ngựa vằn
      vach += dung * trong;                                                                   // vạch dừng
      c = mix(c, TRANG, clamp(vach, 0.0, 1.0) * ro * (1.0 - smoothstep(ra - e, ra + e, as)));`,
    pho: `vec3 c = NHUA * 1.35;
      c = mix(c, vec3(0.27, 0.26, 0.23), smoothstep(3.0 - e, 3.0 + e, as) * step(0.0, dj));            // rãnh bê tông mép
      c = mix(c, TRANG, dai(as, 2.75, 2.9, e) * step(0.6, dj) * ro);                                     // vạch trắng mép phố`,
    tau: `vec3 c = vec3(0.15, 0.12, 0.1) * (0.75 + 0.45 * n1);
      // MỖI tuyến OSM là MỘT đường ray (bãi ga vẽ từng đường riêng) → ray nằm giữa tuyến; trước đây vẽ hai đường ray lệch ±2 m khỏi tuyến = bãi ga lệch, chồng đôi (anh 23/11/2026)
      c = mix(c, vec3(0.07, 0.045, 0.03), dai(as, -1.0, 1.0, e) * step(fract(v / 0.62), 0.4) * ro);  // tà vẹt 2 m (khổ hẹp 1.067 m)
      c = mix(c, vec3(0.05, 0.045, 0.04), dai(abs(as - 0.53), -1.0, 0.09, e) * ro);                  // bóng chân ray 3D
      c = mix(c, vec3(0.3, 0.29, 0.27), dai(as, 1.8, 2.5, e));                                       // vai nền`,
  };
  // phu = lượt phủ lòng đường: cùng hình, bỏ vỉa hè, nằm trên mọi vỉa hè cùng lớp → đường đôi / dải chồng nhau không còn vỉa hè dải này đè lòng đường dải kia (răng cưa)
  const vatDuong = (k, phu) => { const m = new THREE.MeshLambertMaterial({ depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: phu ? LOP.lon.u - 2 - (k === 'lon' ? 1 : 0) : LOP[k].u }); m.userData.thuTu = -m.polygonOffsetUnits; // dải đường KHÔNG ghi chiều sâu, vẽ sau mọi vật đặc theo thứ tự lớp cố định (lớp trên vẽ sau): dải chồng nhau (bãi ray ga, nút giao, đường song song) không còn giành điểm ảnh → hết nháy; đất/nhà/xe đã ghi chiều sâu nên vẫn che đường đúng // phu: lượt vẽ riêng phần lòng nhựa, nằm trên MỌI vỉa hè (kể cả vỉa hè của đại lộ chạy song song đè sang) → lòng đường không bị vỉa hè tuyến bên cạnh che
    m.customProgramCacheKey = () => 'duong-' + k + (phu ? '-phu' : '');
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aR, aK, aL; varying vec4 vR, vK, vL; varying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvR = aR; vK = aK; vL = aL; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec4 vR, vK, vL; varying vec3 vWp;
      float bam(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float dai(float x, float a, float b, float e) { return smoothstep(a - e, a + e, x) - smoothstep(b - e, b + e, x); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
      ${DAU}
      ${VE[k]}
      ${phu ? 'if (leDuong > 0.5) discard;' : ''}
      diffuseColor.rgb = c;`); };
    return m; };
  const duongMesh = {};
  for (const k of Object.keys(LOP)) { const B = loDuong[k], g = new THREE.BufferGeometry(), n = B.xz.length / 2;
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('aR', new THREE.Float32BufferAttribute(B.r, 4)); g.setAttribute('aK', new THREE.Float32BufferAttribute(B.k, 4)); g.setAttribute('aL', new THREE.Float32BufferAttribute(B.l, 4)); g.setIndex(B.idx);
    duongMesh[k] = new THREE.Mesh(g, vatDuong(k)); duongMesh[k].frustumCulled = false; duongMesh[k].renderOrder = duongMesh[k].material.userData.thuTu; goc.add(duongMesh[k]);
    if (LONG[k]) { const m2 = new THREE.Mesh(g, vatDuong(k, true)); m2.frustumCulled = false; m2.renderOrder = m2.material.userData.thuTu; goc.add(m2); } }

  // ---------- ray thép 3D: hai thanh ray khổ 1.067 m (JR) nổi 16 cm trên nền đá, đúng tâm mỗi tuyến OSM → nhìn ra đường ray thật, không chỉ vạch sơn ----------
  // mỗi điểm tuyến (chia ≤ 8 m như dải đường) sinh 6 đỉnh mỗi thanh: hông trong, mặt trên, hông ngoài; độ cao gắn trong datLai theo cùng mặt đất của dải
  const RAY = { xz: [], dy: [], n: [], idx: [] }, KHO = 0.5335, RR = 0.036, RC = 0.16;
  for (const g0 of ql.tau) { const g = [g0[0]];
    for (let i = 1; i < g0.length; i++) { const q = g[g.length - 1], l = Math.hypot(g0[i][0] - q[0], g0[i][1] - q[1]); if (l <= 0.5) continue;
      const n = Math.ceil(l / 8); for (let c = 1; c < n; c++) g.push([q[0] + (g0[i][0] - q[0]) * c / n, q[1] + (g0[i][1] - q[1]) * c / n]); g.push(g0[i]); }
    if (g.length < 2) continue;
    for (const ben of [-1, 1]) { const b = RAY.xz.length / 2;
      g.forEach((p, i) => { const a = g[Math.max(0, i - 1)], c = g[Math.min(g.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l; // pháp tuyến ngang
        const cx = p[0] + nx * KHO * ben, cz = p[1] + nz * KHO * ben;
        for (const [o, y, vx, vy, vz] of [[-RR, 0, -nx, 0, -nz], [-RR, RC, -nx, 0, -nz], [-RR, RC, 0, 1, 0], [RR, RC, 0, 1, 0], [RR, RC, nx, 0, nz], [RR, 0, nx, 0, nz]]) { RAY.xz.push(cx + nx * o, cz + nz * o); RAY.dy.push(y); RAY.n.push(vx, vy, vz); } });
      for (let i = 0; i + 1 < g.length; i++) for (let f = 0; f < 3; f++) { const a = b + i * 6 + f * 2, c = b + (i + 1) * 6 + f * 2; RAY.idx.push(a, c, a + 1, a + 1, c, c + 1); } } }
  const rayMesh = (() => { const gm = new THREE.BufferGeometry(), n = RAY.xz.length / 2;
    gm.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); gm.setAttribute('normal', new THREE.Float32BufferAttribute(RAY.n, 3)); gm.setIndex(RAY.idx);
    const m = new THREE.Mesh(gm, new THREE.MeshStandardMaterial({ color: '#8d9298', metalness: 0.55, roughness: 0.38, side: THREE.DoubleSide })); m.frustumCulled = false; goc.add(m); return m; })();

  // ---------- vườn: vẽ đa giác công viên OSM vào mặt nạ 1024² (3 m / điểm ảnh), đất Red Spires đọc mặt nạ để tô cỏ ----------
  const NUA_V = 1536, cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  { const c2 = cv.getContext('2d'); c2.fillStyle = '#000'; c2.fillRect(0, 0, 1024, 1024); c2.fillStyle = '#fff';
    for (const vn of ql.vuon) { if (vn.g.length < 3) continue; c2.beginPath(); vn.g.forEach(([x, z], i) => c2[i ? 'lineTo' : 'moveTo']((x + NUA_V) / 3, (z + NUA_V) / 3)); c2.closePath(); c2.fill(); } }
  const texVuon = new THREE.CanvasTexture(cv); texVuon.colorSpace = THREE.NoColorSpace; texVuon.flipY = false;
  const uDat = { uVuon: { value: texVuon }, uDo: { value: 0 } };
  function khoacDat(mat) { // gắn vào vật liệu đất chung: chỉ đổi màu khi đang ở kiểu Red Spires
    Object.assign(mat, { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }); // đất lùi sau mọi lớp đường ở chỗ gần trùng mặt phẳng
    mat.customProgramCacheKey = () => 'dat-rs';
    mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, uDat);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWd;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWd = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWd; uniform sampler2D uVuon; uniform float uDo;\nfloat bamD(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
        .replace('#include <color_fragment>', `#include <color_fragment>
      if (uDo > 0.5) {
        float m = smoothstep(0.35, 0.65, texture2D(uVuon, vWd.xz / ${NUA_V * 2}.0 + 0.5).r);
        float fwD = length(fwidth(vWd.xz)); // cùng lý do như mặt đường: chấm nhỏ hơn 2 điểm ảnh thì mờ về trung bình, hết lấp lánh
        float n = mix(bamD(floor(vWd.xz * 0.6)), 0.5, smoothstep(0.35, 1.0, fwD)) * 0.5 + mix(bamD(floor(vWd.xz / 6.0) + 1.7), 0.5, smoothstep(3.0, 8.0, fwD)) * 0.5;
        vec3 co = vec3(0.13, 0.24, 0.07) * (0.75 + 0.5 * n);
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.92 + 0.12 * n), co, m);
      }`); };
    mat.needsUpdate = true; }

  // ---------- chợ + người dọc đại lộ ----------

  // điểm rải dọc đại lộ (dày ở gần tâm), dùng cho người + quầy chợ
  const diem = [];
  for (const d of ql.daiLo) for (let i = 1; i < d.g.length; i++) {
    const [ax, az] = d.g[i - 1], [bx, bz] = d.g[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, w = RONG[d.lop];
    for (let s = 0; s < L; s += 6) {
      const x = ax + ux * s, z = az + uz * s, kc = Math.hypot(x, z);
      diem.push({ x, z, ux, uz, w, lop: d.lop, k: d.k, gan: Math.exp(-kc / 900) });
    }
  }
  let hat = 1234567; const ngau = () => ((hat = (hat * 16807) % 2147483647) / 2147483647);
  const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();

  // ---- người đi phố: dáng thấp đa giác (chân, thân, tay, đầu, tóc), 4 lớp instanced chung một ma trận ----
  // đi bộ chạy trong shader (khỏi cập nhật ma trận từng khung): mỗi người đi tới lui trên đoạn 24 m theo hướng đại lộ, chân tay đánh nhịp
  const uNguoi = { uT: { value: 0 } };
  const vNguoi = (tu) => { const v = new THREE.MeshLambertMaterial(); v.customProgramCacheKey = () => tu ? 'nguoi-tu' : 'nguoi-di'; // tu: người gần đi bằng CPU (nguoi-gan.js), aDi = (tốc độ, pha bước)
    v.onBeforeCompile = (sh) => { sh.uniforms.uT = uNguoi.uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uT; attribute vec2 aDi; attribute float aPhan;
      // aDi.x = tốc độ m/s (0 = đứng), aDi.y = pha 0..1 · aPhan: 1/2 chân trái/phải, 3/4 tay trái/phải
      vec3 diNguoi(vec3 p, float laVt) {
        float v = aDi.x, dang = step(0.01, v);
        float goc = ${tu ? 'sin(aDi.y) * 0.5 * dang' : 'sin(uT * v * 5.2 + aDi.y * 40.0) * 0.5 * dang'};
        float tru = aPhan > 2.5 ? 1.44 : 0.86, dau = (aPhan == 1.0 || aPhan == 4.0) ? 1.0 : -1.0;
        if (aPhan > 0.5) { float c = cos(goc * dau), s = sin(goc * dau); float y = p.y - tru * laVt; p = vec3(p.x, y * c - p.z * s + tru * laVt, y * s + p.z * c); }
        ${tu ? '' : `float L = 24.0, d = mod(uT * v + aDi.y * 2.0 * L, 2.0 * L), lui = step(L, d), di = d < L ? d : 2.0 * L - d;
        p.xz *= 1.0 - 2.0 * lui * dang;
        p.z += (di - L * 0.5) * dang * laVt;`}
        return p; }`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = diNguoi(objectNormal, 0.0);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = diNguoi(transformed, 1.0);');
    }; return v; };
  const hopP = (w, h, d, x, y, z, phan) => { const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(); g.setAttribute('aPhan', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(phan), 1)); return g; };
  const cauP = (r, sx, sy, sz, x, y, z, nua) => { const g = new THREE.SphereGeometry(r, 9, 6, 0, Math.PI * 2, 0, nua ? Math.PI * 0.55 : Math.PI).scale(sx, sy, sz).translate(x, y, z).toNonIndexed(); g.setAttribute('aPhan', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(0), 1)); return g; };
  const gop = (ds) => { const n = ds.reduce((a, g) => a + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
    for (const k of Object.keys(ds[0].attributes)) { const sz = ds[0].attributes[k].itemSize, a = new Float32Array(n * sz); let o = 0; for (const g of ds) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(a, sz)); }
    return out; };
  const G_QUAN = gop([hopP(0.17, 0.82, 0.2, -0.1, 0.45, 0, 1), hopP(0.17, 0.82, 0.2, 0.1, 0.45, 0, 2), hopP(0.18, 0.08, 0.28, -0.1, 0.04, 0.04, 1), hopP(0.18, 0.08, 0.28, 0.1, 0.04, 0.04, 2), hopP(0.38, 0.14, 0.22, 0, 0.84, 0, 0)]);
  const G_AO = gop([hopP(0.42, 0.58, 0.24, 0, 1.16, 0, 0), hopP(0.36, 0.1, 0.22, 0, 1.47, 0, 0), hopP(0.11, 0.6, 0.13, -0.27, 1.15, 0, 3), hopP(0.11, 0.6, 0.13, 0.27, 1.15, 0, 4)]);
  const G_DA = gop([cauP(0.115, 1, 1.12, 1, 0, 1.66, 0), hopP(0.1, 0.08, 0.1, 0, 1.52, 0, 0), hopP(0.08, 0.1, 0.09, -0.27, 0.8, 0.0, 3), hopP(0.08, 0.1, 0.09, 0.27, 0.8, 0.0, 4)]);
  const G_TOC = gop([cauP(0.125, 1.02, 1.05, 1.06, 0, 1.69, -0.012, true), hopP(0.26, 0.3, 0.12, 0, 1.2, -0.17, 0)]); // tóc + ba lô / túi sau lưng
  const MAU_DA = ['#e8c4a2', '#d9a982', '#c48d66', '#a8714d', '#f0d2b6', '#8a5a3c'];
  const MAU_TOC = ['#1d1a18', '#2e2420', '#4a3426', '#6b4a30', '#8c8a86', '#1d1a18', '#b5562f'];
  const MAU_QUAN = ['#26292e', '#3a3f47', '#4b4036', '#2f3d52', '#6b6457', '#1f2226', '#7a6a55'];
  const NN = 16000;
  const lopNguoi = [G_QUAN, G_AO, G_DA, G_TOC].map((g) => new THREE.InstancedMesh(g, vNguoi(), NN));
  const aDi = new THREE.InstancedBufferAttribute(new Float32Array(NN * 2), 2);
  for (const m of lopNguoi) { m.geometry.setAttribute('aDi', aDi); m.instanceMatrix = lopNguoi[0].instanceMatrix; m.frustumCulled = false; }
  const datNguoi = [];
  const themNguoi = (x, z, h, v) => { const n = datNguoi.length; if (n >= NN) return;
    datNguoi.push({ x, z, h, s: 0.92 + ngau() * 0.16 }); aDi.setXY(n, v, ngau());
    lopNguoi[0].setColorAt(n, _c.set(MAU_QUAN[(ngau() * MAU_QUAN.length) | 0]));
    lopNguoi[1].setColorAt(n, _c.set(MAU_NGUOI[(ngau() * MAU_NGUOI.length) | 0]));
    lopNguoi[2].setColorAt(n, _c.set(MAU_DA[(ngau() * MAU_DA.length) | 0]));
    lopNguoi[3].setColorAt(n, _c.set(MAU_TOC[(ngau() * MAU_TOC.length) | 0])); };

  // ---- quầy chợ: khung gỗ + quầy, mái bạt nghiêng sọc, hàng hoá (thùng trái cây, bao, đèn lồng) ----
  const mauG = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
  const hop = (w, h, d, x, y, z, hex) => mauG(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
  const tru = (r1, r2, h, x, y, z, hex, n = 6) => mauG(new THREE.CylinderGeometry(r1, r2, h, n).translate(x, y, z), hex);
  const cau = (r, x, y, z, hex, w = 7, h = 5) => mauG(new THREE.SphereGeometry(r, w, h).translate(x, y, z), hex);
  const G_KHUNG = gop([hop(3, 0.95, 1.1, 0, 0.475, 0.55, '#7a5a3e'), hop(3.06, 0.07, 1.2, 0, 0.98, 0.55, '#9b7a55'), hop(3, 0.12, 1.1, 0, 0.06, 0.55, '#3a2e26'),
    ...[[-1.45, 1.1], [1.45, 1.1], [-1.45, -1.0], [1.45, -1.0]].map(([x, z]) => tru(0.05, 0.05, z > 0 ? 2.5 : 2.85, x, z > 0 ? 1.25 : 1.42, z, '#4a3b30')),
    hop(1.2, 0.5, 0.06, 0.6, 2.25, 1.2, '#efe6cf'), hop(0.06, 0.6, 0.06, 0.6, 2.55, 1.2, '#4a3b30')]); // bảng hiệu treo trước mái
  const maiG = new THREE.BoxGeometry(3.4, 0.05, 2.7, 6, 1, 1).rotateX(-0.22).translate(0, 2.7, 0.08);
  { const p = maiG.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = Math.floor((p.getX(i) + 1.7) / 3.4 * 6 + 0.001) % 2 ? 1 : 0.82; c.set([k, k, k], i * 3); } maiG.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const G_MAI = maiG.toNonIndexed(); G_MAI.deleteAttribute('uv');
  const HANG = ['#e07a2e', '#c2312a', '#e8c23a', '#6d9a3a', '#8a4b8f', '#d9d2c2', '#3f7f8c', '#b5562f'];
  const G_HANG = (bo) => gop([...[-1.05, -0.35, 0.35, 1.05].flatMap((x, k) => [hop(0.6, 0.22, 0.5, x, 1.12, 0.62, '#8a6a46'), ...[0, 1, 2].map((j) => cau(0.1, x - 0.16 + j * 0.16, 1.27, 0.55 + (j % 2) * 0.12, HANG[(bo + k * 3 + j) % HANG.length], 5, 3))]),
    hop(0.5, 0.55, 0.45, -1.0, 0.27, -0.55, '#b89a6a'), hop(0.45, 0.4, 0.45, -0.45, 0.2, -0.6, '#9b7a55'), tru(0.22, 0.26, 0.55, 1.0, 0.27, -0.55, '#d8cdb0', 8),
    cau(0.16, -0.9, 2.05, 1.05, bo % 2 ? '#d93b2b' : '#e8b04a'), cau(0.16, 0.9, 2.05, 1.05, bo % 2 ? '#d93b2b' : '#e8b04a')]);
  const vMau = new THREE.MeshLambertMaterial({ vertexColors: true });
  const NQ = 1100;
  const quay = [new THREE.InstancedMesh(G_KHUNG, vMau, NQ), new THREE.InstancedMesh(G_MAI, vMau, NQ), new THREE.InstancedMesh(G_HANG(0), vMau, NQ), new THREE.InstancedMesh(G_HANG(3), vMau, NQ)];
  for (const m of quay) { m.instanceMatrix = quay[0].instanceMatrix; m.frustumCulled = false; }
  const datQuay = [];

  // ---- đồ phố: cột đèn, ghế dài, bồn cây có cây, thùng hàng, xe đẩy ----
  const G_DEN = gop([tru(0.07, 0.11, 6, 0, 3, 0, '#2f3338'), hop(0.08, 0.08, 1.4, 0, 5.9, 0.65, '#2f3338'), hop(0.38, 0.22, 0.5, 0, 5.75, 1.3, '#3a3f45'), hop(0.3, 0.06, 0.42, 0, 5.62, 1.3, '#fff2c8'), tru(0.22, 0.26, 0.3, 0, 0.15, 0, '#2f3338')]);
  const G_GHE = gop([hop(1.8, 0.07, 0.45, 0, 0.45, 0, '#8a6a46'), hop(1.8, 0.4, 0.06, 0, 0.72, -0.22, '#8a6a46'), ...[-0.75, 0.75].map((x) => hop(0.07, 0.45, 0.42, x, 0.22, 0, '#2f3338'))]);
  const G_CAY = gop([hop(1.6, 0.6, 1.6, 0, 0.3, 0, '#9a948a'), hop(1.45, 0.06, 1.45, 0, 0.58, 0, '#4a3a2c'), tru(0.09, 0.14, 2.6, 0, 1.8, 0, '#5a4636'),
    cau(1.15, 0, 3.6, 0, '#5d7f45'), cau(0.85, 0.5, 3.2, 0.3, '#6d8f4f'), cau(0.8, -0.45, 3.4, -0.35, '#54733e'), cau(0.7, 0.1, 4.3, -0.1, '#6a8a4c')]);
  const G_THUNG = gop([hop(0.8, 0.6, 0.6, 0, 0.3, 0, '#9b7a55'), hop(0.7, 0.5, 0.55, 0.15, 0.85, 0.05, '#b89a6a'), hop(0.6, 0.45, 0.5, 0.9, 0.22, 0.1, '#7a5a3e'), tru(0.3, 0.3, 0.9, -0.9, 0.45, 0.1, '#5d6d78', 10)]);
  const G_XE = gop([hop(1.5, 0.5, 0.9, 0, 0.75, 0, '#c9483a'), hop(1.5, 0.06, 0.9, 0, 1.02, 0, '#d9d2c2'), ...[-0.55, 0.55].map((x) => mauG(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10).rotateX(Math.PI / 2).translate(x, 0.32, 0.5), '#2a2a2a')),
    hop(0.06, 0.06, 0.9, 0.9, 1.05, 0, '#3a3a3a'), tru(0.03, 0.03, 1.7, -0.7, 1.85, -0.4, '#3a3a3a'), mauG(new THREE.ConeGeometry(1.2, 0.5, 10).translate(-0.7, 2.75, -0.4), '#e0a83c')]);
  const G_CAYV = gop([tru(0.14, 0.22, 3.2, 0, 1.6, 0, '#4a3a2c'), cau(1.9, 0, 4.6, 0, '#4f7a3c', 8, 6), cau(1.4, 0.9, 4.0, 0.5, '#5f8a46', 7, 5), cau(1.3, -0.8, 4.3, -0.6, '#46703a', 7, 5), cau(1.1, 0.2, 5.8, -0.2, '#5a8443', 7, 5)]);
  const doPho = [G_DEN, G_GHE, G_CAY, G_THUNG, G_XE, G_CAYV].map((g) => { const m = new THREE.InstancedMesh(g, vMau, 3000); m.frustumCulled = false; m.count = 0; return m; });
  const datDo = doPho.map(() => []);
  // ---- cây GẦN (trong TAM_CAY m): lưới nướng sẵn từ ez-tree (scripts/nuong-cay.mjs → du-lieu/cay.json): cành thật + tán lá bằng tấm ảnh lá. Xa hơn vẫn là cây khối cầu ở trên (ít tam giác).
  // Không nạp được tệp cây thì cây khối cầu vẽ ở mọi tầm như trước (Rmin của lớp xa chỉ bật khi lưới gần đã vào).
  const TAM_CAY = 200, anhLa = new THREE.TextureLoader();
  // tấm lá vẽ hai mặt nhưng KHÔNG lật pháp tuyến ở mặt sau: pháp tuyến đã nướng hướng ra khỏi tâm tán, lật là nửa số tấm đen kịt
  const vLa = () => { const m = new THREE.MeshLambertMaterial({ vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);'); }; return m; };
  const cayGan = [[2, 'pho'], [5, 'vuon']].map(([k, ten]) => { const nh = new THREE.InstancedMesh(new THREE.BufferGeometry(), vMau, 3000), la = new THREE.InstancedMesh(new THREE.BufferGeometry(), vLa(), 3000);
    la.instanceMatrix = nh.instanceMatrix; for (const m of [nh, la]) { m.frustumCulled = false; m.count = 0; m.visible = false; } return { k, ten, nh, la, bo: null }; });
  fetch(new URL('./du-lieu/cay.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(({ cay }) => {
    for (const c of cayGan) { const d = cay[c.ten], nang = c.k === 2 ? 0.58 : 0, f = (a, n) => new THREE.Float32BufferAttribute(a, n); // cây phố mọc từ mặt đất trong bồn
      const gn = new THREE.BufferGeometry(); gn.setAttribute('position', f(d.nhanh.p, 3)); gn.setAttribute('normal', f(d.nhanh.n, 3)); gn.setIndex(d.nhanh.i); gn.translate(0, nang, 0);
      const canh = mauG(gn, c.k === 2 ? '#5a4636' : '#4a3a2c');
      c.nh.geometry = c.k === 2 ? gop([hop(1.6, 0.6, 1.6, 0, 0.3, 0, '#9a948a'), hop(1.45, 0.06, 1.45, 0, 0.58, 0, '#4a3a2c'), canh]) : canh;
      const gl = new THREE.BufferGeometry(), mau = new Float32Array(d.tan.c.length * 3); const sac = c.k === 2 ? [0.92, 1, 0.86] : [0.76, 0.88, 0.7]; d.tan.c.forEach((v, i) => { mau[i * 3] = v * sac[0]; mau[i * 3 + 1] = v * sac[1]; mau[i * 3 + 2] = v * sac[2]; }); // ảnh lá sồi gốc ngả vàng chói → hạ sắc cho hợp cây phố
      gl.setAttribute('position', f(d.tan.p, 3)); gl.setAttribute('normal', f(d.tan.n, 3)); gl.setAttribute('uv', f(d.tan.uv, 2)); gl.setAttribute('color', f(mau, 3)); gl.setIndex(d.tan.i); gl.translate(0, nang, 0);
      c.la.geometry = gl; const anh = anhLa.load(new URL(`./du-lieu/la-${d.la}.webp`, import.meta.url).href); anh.colorSpace = THREE.SRGBColorSpace; c.la.material.map = anh; c.la.material.needsUpdate = true;
      c.nh.visible = c.la.visible = true; boDo[c.k].Rmin = TAM_CAY; }
    canLoc = true;
  }).catch((e) => console.warn('[sprawl] không nạp được cây nướng (du-lieu/cay.json) — giữ cây khối cầu ở mọi tầm:', e));
  { // cây trong vườn: rải theo mặt nạ vườn, ~1 cây / 90 m²
    const px = cv.getContext('2d').getImageData(0, 0, 1024, 1024).data;
    for (let j = 0; j < 1024; j++) for (let i = 0; i < 1024; i++) if (px[(j * 1024 + i) * 4] > 200 && ngau() < 0.1) {
      const x = i * 3 - NUA_V + ngau() * 3, z = j * 3 - NUA_V + ngau() * 3; datDo[5].push({ x, z, h: ngau() * 6.28, s: 0.75 + ngau() * 0.7 }); }
    for (let i = datDo[5].length - 1; i > 0; i--) { const k = (ngau() * (i + 1)) | 0; [datDo[5][i], datDo[5][k]] = [datDo[5][k], datDo[5][i]]; } // trộn để cắt 3000 không lệch một góc
  }

  // trongLong: điểm có nằm trong lòng đường nhựa của một đường xe nào không (kể cả đường CẮT NGANG ở nút giao) — người, sạp, đồ phố không được đặt ở đó
  // Đo theo khuôn ngang TỪNG tuyến (d.k), từng phía: phía dải phân cách tính hết tới mép dải (không đặt sạp / người giữa hai nửa đường đôi).
  const O_L = 40, oL = new Map(), kL = (i, j) => i * 100003 + j;
  for (const d of ql.daiLo) { const k = d.k; if (!k) continue; const lP = k.giua > 0 ? k.hwP : k.raP, lM = k.giua < 0 ? k.hwM : k.raM, r = Math.max(lP, lM);
    for (let i = 1; i < d.g.length; i++) { const [ax, az] = d.g[i - 1], [bx, bz] = d.g[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue; const sg = { ax, az, ux: (bx - ax) / L, uz: (bz - az) / L, L, lP, lM };
      for (let a = Math.floor((Math.min(ax, bx) - r) / O_L); a <= Math.floor((Math.max(ax, bx) + r) / O_L); a++) for (let b = Math.floor((Math.min(az, bz) - r) / O_L); b <= Math.floor((Math.max(az, bz) + r) / O_L); b++) { const kk = kL(a, b); let l = oL.get(kk); if (!l) oL.set(kk, l = []); l.push(sg); } } }
  const trongLong = (x, z, du = 0.6) => { for (const sg of oL.get(kL(Math.floor(x / O_L), Math.floor(z / O_L))) || []) {
    const rx = x - sg.ax, rz = z - sg.az, t = Math.min(sg.L, Math.max(0, rx * sg.ux + rz * sg.uz)), ex = rx - sg.ux * t, ez = rz - sg.uz * t, lg = (ez * sg.ux - ex * sg.uz >= 0 ? sg.lP : sg.lM) + du;
    if (ex * ex + ez * ez < lg * lg) return true; } return false; };
  // mép từng phía của một điểm rải: ben = +1 phía s dương. Đường có xe: mep = mép ngoài vỉa hè, ra = mép lòng nhựa, giua = phía dải phân cách (không rải gì)
  const mepB = (d, ben) => (d.k ? (ben > 0 ? d.k.hwP : d.k.hwM) : d.w / 2), raB = (d, ben) => (d.k ? (ben > 0 ? d.k.raP : d.k.raM) : 0), giuaB = (d, ben) => !!d.k && d.k.giua === ben;
  // rải dọc đại lộ: hai mép có cột đèn + bồn cây xen kẽ, quầy chợ kèm người bán; giữa lối là người đi; ghế, thùng, xe đẩy lác đác
  for (const d of diem) {
    const huong = Math.atan2(d.ux, d.uz);
    if (ngau() < d.gan * 0.55 + 0.05) for (const ben of [-1, 1]) { if (giuaB(d, ben)) continue; const mep = mepB(d, ben);
      const r = ngau(), lech = ben * (mep - 1.2), x = d.x - d.uz * lech, z = d.z + d.ux * lech; if (trongLong(x, z, 1.5)) continue;
      if (r < 0.22) datDo[0].push({ x, z, h: huong + (ben > 0 ? -Math.PI / 2 : Math.PI / 2) });
      else if (r < 0.42) datDo[2].push({ x, z, h: ngau() * 6.28 });
      else if (r < 0.5) datDo[1].push({ x: d.x - d.uz * ben * (mep - 2.4), z: d.z + d.ux * ben * (mep - 2.4), h: huong + (ben > 0 ? Math.PI / 2 : -Math.PI / 2) });
    }
    if (d.lop !== 'vua' && datQuay.length < NQ && ngau() < d.gan * 1.1) {
      const ben = ngau() < 0.5 ? -1 : 1, mep = mepB(d, ben); if (giuaB(d, ben) || mep - raB(d, ben) < 5) continue; const lech = ben * (mep - 3.4), hq = huong + (ben > 0 ? Math.PI / 2 : -Math.PI / 2);
      const x = d.x - d.uz * lech, z = d.z + d.ux * lech; if (trongLong(x, z, 3.5)) continue; datQuay.push({ x, z, h: hq });
      quay[1].setColorAt(datQuay.length - 1, _c.set(MAU_MAI[(ngau() * MAU_MAI.length) | 0]));
      const lui = ben * (mep - 2.2); themNguoi(d.x - d.uz * lui, d.z + d.ux * lui, hq, 0);              // người bán sau quầy
      if (ngau() < 0.7) { const tr = ben * (mep - 5.6); themNguoi(d.x - d.uz * tr + (ngau() - 0.5), d.z + d.ux * tr + (ngau() - 0.5), hq + Math.PI, 0); } // khách đứng xem
    }
    if (d.lop !== 'vua' && ngau() < d.gan * 0.12) { const bn = ngau() < 0.5 ? -1 : 1; if (giuaB(d, bn)) continue; const lech = d.lop === 'lon' ? bn * (raB(d, bn) + 1.2 + ngau() * Math.max(0.5, mepB(d, bn) - raB(d, bn) - 3)) : (ngau() - 0.5) * d.w * 0.6, x = d.x - d.uz * lech, z = d.z + d.ux * lech;
      if (!trongLong(x, z, 1.5)) datDo[ngau() < 0.6 ? 3 : 4].push({ x, z, h: ngau() * 6.28 }); }
  }
  for (let thu = 0; datNguoi.length < NN && thu < NN * 40; thu++) {
    const d = diem[(ngau() * diem.length) | 0]; if (!d || ngau() > d.gan * 1.8) continue;
    const bn = ngau() < 0.5 ? -1 : 1; if (giuaB(d, bn)) continue; const lg = raB(d, bn), lech = d.k ? bn * (lg + 0.7 + ngau() * Math.max(0.2, mepB(d, bn) - lg - 1.3)) : (ngau() - 0.5) * d.w * 0.7, nhoe = d.k ? 0.4 : 3; // đường có xe: người chỉ trên vỉa hè
    const x = d.x - d.uz * lech + (ngau() - 0.5) * nhoe, z = d.z + d.ux * lech + (ngau() - 0.5) * nhoe; if (trongLong(x, z)) continue;
    let di = ngau() < 0.62; // người đi tới lui ±12 m dọc đường: quãng đó cắt ngang một lòng đường thì đứng yên tại chỗ (băng qua đường thật = bước 2 của ô phố mẫu)
    if (di) for (const k of [-12, -6, 6, 12]) if (trongLong(x + d.ux * k, z + d.uz * k)) { di = false; break; }
    themNguoi(x, z, di ? Math.atan2(d.ux, d.uz) + (ngau() < 0.5 ? 0 : Math.PI) : ngau() * 6.28, di ? 0.9 + ngau() * 0.7 : 0);
  }
  for (const m of lopNguoi) { m.count = datNguoi.length; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  for (const m of quay) m.count = datQuay.length;
  for (const [i, m] of doPho.entries()) m.count = Math.min(3000, datDo[i].length);
  goc.add(...lopNguoi, ...quay, ...doPho, ...cayGan.flatMap((c) => [c.nh, c.la]));
  // tầm xa mỗi lớp (m): người 650 · quầy 900 · cột đèn / bồn cây 900 (cao, thấy từ xa) · ghế / thùng 450 · xe đẩy 600
  const boNguoi = taoBo(lopNguoi, NN, 650, 14), boQuay = taoBo(quay, NQ, 900, 4), boDo = doPho.map((m, k) => taoBo([m], 3000, [900, 450, 900, 450, 600, 1100][k], 5));
  for (const c of cayGan) { c.bo = taoBo([c.nh, c.la], 3000, TAM_CAY, 6); c.bo.dem = Math.min(3000, datDo[c.k].length); }
  const dsBo = [boNguoi, boQuay, ...boDo, ...cayGan.map((c) => c.bo)];
  boNguoi.dem = datNguoi.length; boQuay.dem = datQuay.length; boDo.forEach((b, k) => { b.dem = Math.min(3000, datDo[k].length); });
  for (const b of dsBo) b.chot();

  // ---------- khối khổng lồ mờ xa (không chịu sương, tự pha màu sương) ----------
  const vXa = new THREE.MeshBasicMaterial({ color: '#97a8b6', fog: false });
  const vXa2 = new THREE.MeshBasicMaterial({ color: '#8b9dac', fog: false });
  for (const [i, k] of ql.khoiXa.entries()) {
    const g = new THREE.Group();
    let y = 0, r = k.rong;
    for (let tang = 0; tang < 3; tang++) {
      const h = k.cao * [0.55, 0.3, 0.15][tang], m = new THREE.Mesh(new THREE.BoxGeometry(r, h, r * (0.7 + 0.3 * (i % 2))), tang % 2 ? vXa2 : vXa);
      m.position.y = y + h / 2; g.add(m); y += h; r *= 0.68;
    }
    const kim = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4, k.cao * 0.25, 6), vXa2); kim.position.y = y + k.cao * 0.125; g.add(kim);
    g.position.set(k.o[0], 30, k.o[1]); g.rotation.y = i * 0.7;
    goc.add(g);
  }

  // ---------- phố sống: sương thành lớp, xe bay, xe đường, tàu, cầu + vườn treo (song.js) ----------
  const song = taoSong({ goc, ql, dsThap, nuaNut, LONG });
  // người gần camera né xe + né nhau (recast crowd) — bước 2 ô phố mẫu
  const nguoiGan = taoNguoiGan({ tuyen, LOP, LONG, nuaNut, nguoi: datNguoi, bo: boNguoi, geos: [G_QUAN, G_AO, G_DA, G_TOC], vatLieu: vNguoi(true), song, goc, bao,
    vatTinh: [[datQuay, 1.6], [datDo[0].slice(0, 3000), 0.3], [datDo[1].slice(0, 3000), 0.9], [datDo[2].slice(0, 3000), 0.9], [datDo[3].slice(0, 3000), 1.0], [datDo[4].slice(0, 3000), 1.0], [datDo[5].slice(0, 3000), 0.4], [datNguoi.filter((_, i) => aDi.getX(i) < 0.01), 0.35]] });

  function datLai(datMuot) { // gắn mọi thứ xuống mặt đất mới dựng (gọi sau mỗi lần dungDat)
    const muot = datMuot || datTai;
    for (const [i, d] of dsThap.entries()) {
      let y0 = Infinity; for (let a = 0; a < 8; a++) y0 = Math.min(y0, datTai(d.t.o[0] + Math.cos(a) * d.R, d.t.o[1] + Math.sin(a) * d.R));
      y0 = Math.floor((Math.min(y0, datTai(d.t.o[0], d.t.o[1])) - 1) / TL.tang) * TL.tang; // chân tháp trên lưới tầng chung toàn thành phố → sàn mọi tháp cùng độ cao, cầu nối nằm ngang
      d.g.position.y = y0; khoetDo[i].w = y0; d.y0 = y0;
    }
    song.datLai(muot, datTai(0, 0)); nguoiGan.datMuot(muot);
    for (const k of Object.keys(LOP)) { const B = loDuong[k], pos = duongMesh[k].geometry.attributes.position; // dải đường bám đất
      for (let i = 0; i < B.xz.length / 2; i++) { const x = B.xz[i * 2], z = B.xz[i * 2 + 1]; pos.setXYZ(i, x, muot(x, z) + 0.6, z); }
      pos.needsUpdate = true; duongMesh[k].geometry.computeBoundingSphere(); }
    { const pos = rayMesh.geometry.attributes.position; for (let i = 0; i < RAY.dy.length; i++) { const x = RAY.xz[i * 2], z = RAY.xz[i * 2 + 1]; pos.setXYZ(i, x, muot(x, z) + 0.6 + RAY.dy[i], z); } pos.needsUpdate = true; } // ray đứng trên nền đá của dải tàu
    for (const [i, p] of datNguoi.entries()) { _p.set(p.x, muot(p.x, p.z) + 0.6, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); _s.setScalar(p.s); boNguoi.dat(i, _m.compose(_p, _q, _s)); }
    _s.setScalar(1);
    for (const [i, p] of datQuay.entries()) { _p.set(p.x, muot(p.x, p.z) + 0.6, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); boQuay.dat(i, _m.compose(_p, _q, _s)); }
    for (const [k, ds] of datDo.entries()) for (const [i, p] of ds.slice(0, 3000).entries()) { _p.set(p.x, muot(p.x, p.z) + 0.6, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); _s.setScalar(p.s || 1); boDo[k].dat(i, _m.compose(_p, _q, _s)); }
    for (const c of cayGan) c.bo.src.set(boDo[c.k].src); // cây gần đứng đúng chỗ cây xa
    _s.setScalar(1);
    napKhoet(); canLoc = true;
    if (goc.visible && thapDo) { boVa(); dungVa(); }
    muotCu = muot; muotVa = muot; if (goc.visible) dungVaDuong(); if (vaTam) dungVaGan(...vaTam);
  }
  // khung va mặt đường: ĐÚNG các đỉnh của dải đường đang vẽ (cao hơn đất nền 0,6 m) → người và xe đứng trên mặt đường nhìn thấy, không lún xuống đất nền bên dưới.
  // Mỗi mép dải thêm một vạt dốc ra ngoài 2,5 m cắm xuống dưới đất nền: từ đất nền bước / lái lên mặt đường được (vạt nằm dưới mặt đường cắt ngang nên không cộm ở nút giao).
  let vaDuong = null, muotCu = null;
  function boVaDuong() { if (vaDuong) { world.removeCollider(vaDuong, false); vaDuong = null; } }
  function dungVaDuong() { boVaDuong(); if (!muotCu) return; const P = [], I = [];
    for (const k of Object.keys(LOP)) { if (k === 'tau') continue; const B = loDuong[k], pos = duongMesh[k].geometry.attributes.position.array, n = B.xz.length / 2, b = P.length / 3;
      for (let i = 0; i < n * 3; i++) P.push(pos[i]);
      for (let i = 0; i < n; i++) { const j = i ^ 1, dx = B.xz[i * 2] - B.xz[j * 2], dz = B.xz[i * 2 + 1] - B.xz[j * 2 + 1], l = Math.hypot(dx, dz) || 1, x = B.xz[i * 2] + dx / l * 2.5, z = B.xz[i * 2 + 1] + dz / l * 2.5; P.push(x, muotCu(x, z) - 0.4, z); } // đỉnh vạt dốc của đỉnh i nằm ở b + n + i
      for (let q = 0; q < B.idx.length; q += 6) { const l0 = B.idx[q], l1 = B.idx[q + 1], r0 = B.idx[q + 2], r1 = B.idx[q + 5];
        I.push(b + l0, b + l1, b + r0, b + r0, b + l1, b + r1, b + l0, b + n + l0, b + l1, b + l1, b + n + l0, b + n + l1, b + r0, b + r1, b + n + r0, b + r1, b + n + r1, b + n + r0); } }
    if (I.length) vaDuong = world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(P), new Uint32Array(I)), tinh);
  }
  // khung va: gộp mọi mesh userData.va của tháp (kể cả tháp vệ tinh, bầu bên) thành MỘT trimesh toạ độ thế giới → đứng trên ban công, mái đài kính, chóp vòm
  function dungVa() { const v = new THREE.Vector3();
    for (const d of dsThap) if (!d.va && d.y0 !== undefined) {
      d.g.updateMatrixWorld(true); const P = [], I = [];
      d.g.traverse((m) => { if (!m.userData.va) return; const geo = m.geometry, pos = geo.attributes.position, b = P.length / 3;
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); P.push(v.x, v.y, v.z); }
        if (geo.index) for (const k of geo.index.array) I.push(b + k); else for (let i = 0; i < pos.count; i++) I.push(b + i); });
      d.va = world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(P), new Uint32Array(I)), tinh);
    }
    // cầu nối giữa các tháp: sàn 9 × 1,4 m + hai vách kính hai bên (ống kính 7,5 m rộng, cao 3,2 m) → đi bộ trên cầu, không rơi qua sàn, không xuyên vách
    boVaCau();
    for (const c of song.cau) { const v = c.va; if (!v) continue; const xoay = (dx, dy) => world.createCollider(RAPIER.ColliderDesc.cuboid(...dx).setTranslation(v.x + dy[0], v.y + dy[1], v.z + dy[2]).setRotation(v.q), tinh);
      vaCau.push(xoay([4.5, 0.7, v.L / 2], [0, 0, 0]));
      for (const ben of [-1, 1]) vaCau.push(xoay([0.08, 1.6, v.L / 2], [v.dz * ben * 3.75, 2.3, -v.dx * ben * 3.75])); } }
  let vaCau = [];
  function boVaCau() { for (const c of vaCau) world.removeCollider(c, false); vaCau = []; }
  function boVa() { for (const d of dsThap) if (d.va) { world.removeCollider(d.va, false); d.va = null; } boVaCau(); }
  // hien(phố, tháp đỏ): Nhật 2200 mượn phố (nhà, người, xe đất, đường) nhưng không mượn tháp đỏ — tắt cả hình lẫn khung va + cầu/xe bay/sương của tháp đỏ
  let thapDo = false;
  function hien(bat, coThap = bat) { goc.visible = bat; thapDo = bat && coThap; uDat.uDo.value = bat ? 1 : 0; canLoc = true;
    for (const d of dsThap) d.g.visible = thapDo; for (const m of song.anKhi2200) m.visible = thapDo;
    if (thapDo) dungVa(); else boVa();
    if (bat) dungVaDuong(); else boVaDuong(); }
  function khoet(ds) { khoetRieng = ds; napKhoet(); }

  const _a = new THREE.Vector3(), _camCu = new THREE.Matrix4(), _chieuCu = new THREE.Matrix4(); let canLoc = true, tLoc = 0;
  // lọc lại khi camera đổi (tối đa 10 lần/giây) hoặc đất vừa dựng lại; ep = bắt lọc ngay (chụp 4K đổi khung hình)
  function loc(cam, ep) { const now = performance.now(); cam.updateMatrixWorld();
    const doi = !cam.matrixWorld.equals(_camCu) || !cam.projectionMatrix.equals(_chieuCu);
    if (!ep && !canLoc && (!doi || now - tLoc < 100)) return;
    _camCu.copy(cam.matrixWorld); _chieuCu.copy(cam.projectionMatrix); tLoc = now; canLoc = false;
    _fr.setFromProjectionMatrix(_pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (const b of dsBo) b.loc(cam); }
  // ---- va chạm đồ phố GẦN (2f nhịp A): sạp, cột đèn, ghế, bồn cây, thùng hàng, xe đẩy, thân cây vườn trong VA_R m quanh máy quay thành khối tĩnh Rapier.
  // Cả thành phố ~20.000 món nên chỉ dựng vùng quanh người chơi, dựng lại khi dời quá VA_DOI m (cùng cách nguoi-gan.js). Hình khối khớp lưới G_* ở trên (đơn vị cục bộ, nhân tỉ lệ s).
  const VA_R = 130, VA_DOI = 50;
  const KHOI = [ // k = chỉ số doPho; mỗi khối: ['h', nửa x, nửa y, nửa z, tâm x, y, z] hộp | ['t', nửa cao, bán kính, tâm x, y, z] trụ
    [['t', 3, 0.12, 0, 3, 0]], // đèn
    [['h', 0.9, 0.46, 0.25, 0, 0.46, -0.02]], // ghế
    [['h', 0.8, 0.3, 0.8, 0, 0.3, 0], ['t', 1.3, 0.14, 0, 1.9, 0]], // bồn cây phố + thân
    [['h', 1.25, 0.55, 0.4, 0, 0.55, 0.05]], // thùng hàng
    [['h', 0.8, 0.55, 0.5, 0, 0.55, 0]], // xe đẩy hàng
    [['t', 1.6, 0.2, 0, 1.6, 0]], // thân cây vườn
  ];
  const KHOI_QUAY = [['h', 1.55, 0.5, 0.6, 0, 0.5, 0.55]]; // quầy sạp (mái cao, đi dưới mái được)
  let vaGan = [], vaTam = null, muotVa = null; const _qv = new THREE.Quaternion(), TRUC_Y = new THREE.Vector3(0, 1, 0);
  function boVaGan() { for (const c of vaGan) world.removeCollider(c, false); vaGan = []; vaTam = null; }
  function dungVaGan(x0, z0) { boVaGan(); vaTam = [x0, z0]; const muot = muotVa || datTai;
    const dat = (p, khoi) => { if ((p.x - x0) ** 2 + (p.z - z0) ** 2 > VA_R * VA_R) return; const s = p.s || 1, y = muot(p.x, p.z) + 0.6, c = Math.cos(p.h), sn = Math.sin(p.h);
      _qv.setFromAxisAngle(TRUC_Y, p.h);
      for (const k of khoi) { const [lx, ly, lz] = k[0] === 'h' ? k.slice(4) : k.slice(3), wx = p.x + (lx * c + lz * sn) * s, wz = p.z + (-lx * sn + lz * c) * s;
        const d = k[0] === 'h' ? RAPIER.ColliderDesc.cuboid(k[1] * s, k[2] * s, k[3] * s) : RAPIER.ColliderDesc.cylinder(k[1] * s, k[2] * s);
        vaGan.push(world.createCollider(d.setTranslation(wx, y + ly * s, wz).setRotation(_qv), tinh)); } };
    for (const p of datQuay) dat(p, KHOI_QUAY);
    for (const [k, ds] of datDo.entries()) for (const p of ds.slice(0, 3000)) dat(p, KHOI[k]); }
  function khung(dt, cam) {
    if (!goc.visible) { if (vaTam) boVaGan(); return; }
    if (cam && (!vaTam || Math.hypot(cam.position.x - vaTam[0], cam.position.z - vaTam[1]) > VA_DOI)) dungVaGan(cam.position.x, cam.position.z);
    if (cam) loc(cam);
    uNguoi.uT.value += dt;
    U_DEN.uTg.value += dt; song.khung(dt);
    if (cam && nguoiGan.khung(dt, cam)) canLoc = true;
  }

  return { goc, vatPho, khoacDat, duong: goc.children.filter((o) => o.isMesh && o.material.customProgramCacheKey?.().startsWith('duong-')), datLai, hien, khoet, khung, loc, ql, song, nguoiGan, sang: (v) => { uSang.uSang.value = v; }, thap: dsThap, tk: { thap: dsThap.length, nguoi: datNguoi.length, quay: datQuay.length, doPho: datDo.map((d) => d.length).join('/'), get vaGan() { return vaGan.length; }, get vaCau() { return vaCau.length; }, ...song.tk } };
}
