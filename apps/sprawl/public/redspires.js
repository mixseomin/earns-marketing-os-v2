// Red Spires dựng theo bản quy hoạch chung (public/du-lieu/quy-hoach.json, máy scripts/quy-hoach.mjs).
// Ảnh mẫu: ban ngày sương xanh xám · tháp nón đỏ chóp vòm (ban công, cửa tròn, ăng-ten, vệt bẩn) · đại lộ đi bộ lát đá sáng
// có chợ + người · phố thấp xanh xám, vườn mái · khối khổng lồ mờ xa · xe bay theo làn trên đại lộ lớn.
// Nhà PLATEAU giữ nguyên bố cục thật, khoác chất liệu xanh xám; nhà thật ≥ 90 m bị khoét bỏ trong shader để tháp đỏ đứng thay.
import * as THREE from 'three';
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

function vatThap(gen) {
  const v = new THREE.MeshStandardMaterial({ color: gen.mau, roughness: 0.74 + gen.r * 0.12, metalness: 0.05 });
  const u = { uVien: { value: new THREE.Color(gen.vien) }, uNhip: { value: new THREE.Vector4(gen.oRong, gen.tang, gen.bang, gen.tron) }, uKieu: { value: new THREE.Vector2(gen.soc, gen.than) } };
  v.customProgramCacheKey = () => 'thap-do'; v.userData.than = true;
  v.onBeforeCompile = (sh) => { // tấm ốp + cửa sổ + cửa tròn + vệt bẩn + sọc viền, theo toạ độ trong thân; nhịp riêng mỗi tháp qua uniform
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLo = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLo; uniform vec3 uVien; uniform vec4 uNhip; uniform vec2 uKieu;
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
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.27, 0.3), tron);`);
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
  return { ms, n, R, r, src, mau, phu, dem: 0,
    chot() { // gọi sau khi dựng xong màu / thuộc tính: chép bản gốc
      ms.forEach((m, k) => { if (mau[k]) mau[k].set(m.instanceColor.array); }); for (const p of phu) p.src = p.a.array.slice(); },
    dat(i, m4) { m4.toArray(src, i * 16); },
    loc(cam) { const R2 = this.R * this.R, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, dst = ms[0].instanceMatrix.array; let k = 0;
      for (let i = 0; i < this.dem; i++) { const o = i * 16, x = src[o + 12], y = src[o + 13], z = src[o + 14], d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 > R2) continue; _cau.center.set(x, y, z); _cau.radius = this.r + Math.sqrt(d2) * 0.15; if (!_fr.intersectsSphere(_cau)) continue;
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
function dungThap(R, H, gen, r, vKim) {
  const g = new THREE.Group(), hs = dungHoSo(R, H, gen.dang, r);
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
    const y = cuoi ? hs.than * (0.9 + r() * 0.04) : hs.than * (0.22 + 0.62 * (k + 0.3 + r() * 0.4) / nBC);
    const rv = hs.rTai(y), rong = cuoi ? 3 + r() * 2 : 1.8 + r() * 1.8, ro = rv + rong, mv = r() < 0.35 ? vV : vBC;
    const kieu = cuoi ? 'kinh' : chon(r, ['lan', 'lan', 'kinh', 'tuong']);
    dsBC.push(y);
    const gSan = new THREE.CylinderGeometry(ro, ro, 0.5, 72);
    const san = new THREE.Mesh(gSan, mv); san.position.y = y; g.add(san); va(gSan, 0, y, 0);
    if (kieu === 'lan') {
      for (const yy of [1.15, 0.6]) { const t = new THREE.Mesh(new THREE.TorusGeometry(ro - 0.1, yy > 1 ? 0.07 : 0.045, 4, 96), vKim); t.rotation.x = Math.PI / 2; t.position.y = y + 0.25 + yy; g.add(t); }
      const n = Math.round(Math.PI * 2 * ro / 1.6), cot = new THREE.InstancedMesh(G_COT, vKim, n);
      for (let i = 0; i < n; i++) datRa(cot, i, (i / n) * Math.PI * 2, ro - 0.1, y + 0.8, 1, 1.15, 1);
      g.add(cot); va(new THREE.CylinderGeometry(ro - 0.1, ro - 0.1, 1.2, 32, 1, true), 0, y + 0.85, 0);
    } else if (kieu === 'kinh') {
      const hk = 3.2, gV = new THREE.CylinderGeometry(ro - 0.2, ro - 0.2, hk, 72, 1, true);
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

export function taoRedSpires({ RAPIER, world, tinh, datTai, ql }) {
  const goc = new THREE.Group(); goc.visible = false; goc.name = 'red-spires';
  const thap = ql.thap;

  // ---------- chất liệu nhà PLATEAU: xanh xám, cửa tối, vườn mái; khoét nhà thật dưới tháp đỏ ----------
  const uKhoet = { uThap: { value: thap.map((t) => new THREE.Vector4(t.o[0], t.o[1], t.banKinh * 1.25, 0)) } };
  const vatPho = new THREE.MeshLambertMaterial({ color: '#7f93a3' });
  vatPho.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uKhoet);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform vec4 uThap[${thap.length}];
      float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      for (int i = 0; i < ${thap.length}; i++) { vec4 t = uThap[i]; float d = length(vWp.xz - t.xy);
        if (d < t.z * 1.3 || (d < t.z * 2.6 && vWp.y > t.w + 55.0)) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 nw = normalize(cross(dFdx(vWp), dFdy(vWp)));
      vec2 k = floor(vWp.xz / 22.0);
      float hk = bam(k), hm = bam(k + 7.7), hs = bam(k + 3.1);
      // mỗi khối một bảng màu: xanh xám · đá kem · đá phiến · xanh rêu xám · gạch nhạt
      vec3 m0 = vec3(0.50, 0.58, 0.64), m1 = vec3(0.74, 0.71, 0.64), m2 = vec3(0.40, 0.45, 0.50), m3 = vec3(0.50, 0.60, 0.57), m4 = vec3(0.68, 0.56, 0.50);
      vec3 mk = hm < 0.42 ? m0 : hm < 0.6 ? m2 : hm < 0.76 ? m1 : hm < 0.9 ? m3 : m4;
      diffuseColor.rgb = mk * (0.85 + 0.25 * hk);
      if (abs(nw.y) > 0.6) {                                                   // mái: vườn mái hoặc bê tông, có bồn nước / máy lạnh rải
        if (hk > 0.55) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.46, 0.28), 0.75 * step(0.3, bam(floor(vWp.xz / 3.0))));
        else diffuseColor.rgb *= 0.9 + 0.15 * step(0.85, bam(floor(vWp.xz / 2.0)));
      } else {
        bool trucX = abs(nw.x) > abs(nw.z);
        float u = (trucX ? vWp.z : vWp.x);
        vec2 g = vec2(u / 2.2, vWp.y / 3.4), f = fract(g);
        float cua;
        if (hs < 0.4) cua = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.78);          // ô cửa lưới
        else if (hs < 0.7) cua = step(0.35, f.y) * step(f.y, 0.8);                                            // dải kính ngang
        else { cua = step(0.15, fract(u / 1.1)) * step(0.2, f.y); diffuseColor.rgb *= 0.9 + 0.12 * step(0.85, fract(u / 1.1)); } // vây dọc
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.25, 0.3), cua * 0.6);
        diffuseColor.rgb *= 1.0 - 0.18 * step(fract(vWp.y / 3.4), 0.08) * step(0.5, hk);                     // gờ tầng
      }`);
  };

  // ---------- tháp đỏ: mỗi tháp một bộ gen ----------
  const vKim = new THREE.MeshStandardMaterial({ color: '#3a3532', roughness: 0.6, metalness: 0.5 });
  const dsThap = thap.map((t, i) => {
    const r = gieo(t.id + 17), R = t.banKinh, H = t.caoSpire;
    const dang = DANG[(i * 5 + ((r() * 2) | 0)) % DANG.length]; // xoay vòng đủ sáu dáng, tháp liền hạng không trùng dáng
    const tang = 3.3 + r() * 0.9;
    const gen = { dang, r: r(), mau: chon(r, MAU_DO), vien: chon(r, MAU_VIEN), oRong: 2.2 + r() * 1.1, tang, bang: tang * (6 + ((r() * 5) | 0)),
      tron: 0.78 + r() * 0.17, soc: (r() * 4) | 0, gan: r() < 0.4 ? 14 + ((r() * 14) | 0) : 0, dinh: r() < 0.45 ? 'kim' : 'ang' };
    const { g, hs } = dungThap(R, H, gen, r, vKim);
    let rVa = hs.rMax;
    if (dang === 'chum') { // 2-3 tháp vệ tinh dính chân, thấp hơn, cùng họ màu
      const n = 2 + (r() < 0.5 ? 1 : 0), g0 = r() * 6.28;
      for (let k = 0; k < n; k++) {
        const gv = { ...gen, dang: chon(r, ['dan', 'non', 'hanh']), gan: 0, dinh: 'kim', soc: (gen.soc + k + 1) % 4, phu: 1 }, a = g0 + k * 6.28 / n;
        const v = dungThap(R * (0.42 + r() * 0.15), H * (0.45 + r() * 0.25), gv, r, vKim);
        v.g.position.set(Math.cos(a) * R * 1.05, 0, Math.sin(a) * R * 1.05); g.add(v.g);
      }
      rVa = hs.rMax * 1.6;
    }
    gopThap(g);
    g.rotation.y = r() * 6.28;
    g.position.set(t.o[0], 0, t.o[1]);
    goc.add(g);
    return { t, g, R: rVa, than: hs.than, dang, va: null };
  });

  // ---------- đại lộ lát đá + chợ + người ----------
  const vLo = new THREE.MeshLambertMaterial({ color: '#e3ddd0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  vLo.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 f = abs(fract(vWp.xz / 3.0) - 0.5);
      diffuseColor.rgb *= 1.0 - 0.1 * step(0.46, max(f.x, f.y));`);           // mạch lát đá 3 m
  };
  const loMesh = new THREE.Mesh(new THREE.BufferGeometry(), vLo); goc.add(loMesh);
  const RONG = { lon: 30, vua: 18, dibo: 14 };

  // điểm rải dọc đại lộ (dày ở gần tâm), dùng cho người + quầy chợ
  const diem = [];
  for (const d of ql.daiLo) for (let i = 1; i < d.g.length; i++) {
    const [ax, az] = d.g[i - 1], [bx, bz] = d.g[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, w = RONG[d.lop];
    for (let s = 0; s < L; s += 6) {
      const x = ax + ux * s, z = az + uz * s, kc = Math.hypot(x, z);
      diem.push({ x, z, ux, uz, w, gan: Math.exp(-kc / 900) });
    }
  }
  let hat = 1234567; const ngau = () => ((hat = (hat * 16807) % 2147483647) / 2147483647);
  const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();

  // ---- người đi phố: dáng thấp đa giác (chân, thân, tay, đầu, tóc), 4 lớp instanced chung một ma trận ----
  // đi bộ chạy trong shader (khỏi cập nhật ma trận từng khung): mỗi người đi tới lui trên đoạn 24 m theo hướng đại lộ, chân tay đánh nhịp
  const uNguoi = { uT: { value: 0 } };
  const vNguoi = () => { const v = new THREE.MeshLambertMaterial(); v.customProgramCacheKey = () => 'nguoi-di';
    v.onBeforeCompile = (sh) => { sh.uniforms.uT = uNguoi.uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uT; attribute vec2 aDi; attribute float aPhan;
      // aDi.x = tốc độ m/s (0 = đứng), aDi.y = pha 0..1 · aPhan: 1/2 chân trái/phải, 3/4 tay trái/phải
      vec3 diNguoi(vec3 p, float laVt) {
        float v = aDi.x, dang = step(0.01, v);
        float goc = sin(uT * v * 5.2 + aDi.y * 40.0) * 0.5 * dang;
        float tru = aPhan > 2.5 ? 1.44 : 0.86, dau = (aPhan == 1.0 || aPhan == 4.0) ? 1.0 : -1.0;
        if (aPhan > 0.5) { float c = cos(goc * dau), s = sin(goc * dau); float y = p.y - tru * laVt; p = vec3(p.x, y * c - p.z * s + tru * laVt, y * s + p.z * c); }
        float L = 24.0, d = mod(uT * v + aDi.y * 2.0 * L, 2.0 * L), lui = step(L, d), di = d < L ? d : 2.0 * L - d;
        p.xz *= 1.0 - 2.0 * lui * dang;
        p.z += (di - L * 0.5) * dang * laVt;
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
  const doPho = [G_DEN, G_GHE, G_CAY, G_THUNG, G_XE].map((g) => { const m = new THREE.InstancedMesh(g, vMau, 3000); m.frustumCulled = false; m.count = 0; return m; });
  const datDo = doPho.map(() => []);

  // rải dọc đại lộ: hai mép có cột đèn + bồn cây xen kẽ, quầy chợ kèm người bán; giữa lối là người đi; ghế, thùng, xe đẩy lác đác
  for (const d of diem) {
    const huong = Math.atan2(d.ux, d.uz), mep = d.w / 2;
    if (ngau() < d.gan * 0.55 + 0.05) for (const ben of [-1, 1]) {
      const r = ngau(), lech = ben * (mep - 1.2), x = d.x - d.uz * lech, z = d.z + d.ux * lech;
      if (r < 0.22) datDo[0].push({ x, z, h: huong + (ben > 0 ? -Math.PI / 2 : Math.PI / 2) });
      else if (r < 0.42) datDo[2].push({ x, z, h: ngau() * 6.28 });
      else if (r < 0.5) datDo[1].push({ x: d.x - d.uz * ben * (mep - 2.4), z: d.z + d.ux * ben * (mep - 2.4), h: huong + (ben > 0 ? Math.PI / 2 : -Math.PI / 2) });
    }
    if (d.w >= 14 && datQuay.length < NQ && ngau() < d.gan * 1.1) {
      const ben = ngau() < 0.5 ? -1 : 1, lech = ben * (mep - 3.4), hq = huong + (ben > 0 ? Math.PI / 2 : -Math.PI / 2);
      const x = d.x - d.uz * lech, z = d.z + d.ux * lech; datQuay.push({ x, z, h: hq });
      quay[1].setColorAt(datQuay.length - 1, _c.set(MAU_MAI[(ngau() * MAU_MAI.length) | 0]));
      const lui = ben * (mep - 2.2); themNguoi(d.x - d.uz * lui, d.z + d.ux * lui, hq, 0);              // người bán sau quầy
      if (ngau() < 0.7) { const tr = ben * (mep - 5.6); themNguoi(d.x - d.uz * tr + (ngau() - 0.5), d.z + d.ux * tr + (ngau() - 0.5), hq + Math.PI, 0); } // khách đứng xem
    }
    if (ngau() < d.gan * 0.12) { const lech = (ngau() - 0.5) * d.w * 0.6; datDo[ngau() < 0.6 ? 3 : 4].push({ x: d.x - d.uz * lech, z: d.z + d.ux * lech, h: ngau() * 6.28 }); }
  }
  for (let thu = 0; datNguoi.length < NN && thu < NN * 40; thu++) {
    const d = diem[(ngau() * diem.length) | 0]; if (!d || ngau() > d.gan * 1.8) continue;
    const lech = (ngau() - 0.5) * d.w * 0.7, di = ngau() < 0.62;
    themNguoi(d.x - d.uz * lech + (ngau() - 0.5) * 3, d.z + d.ux * lech + (ngau() - 0.5) * 3, di ? Math.atan2(d.ux, d.uz) + (ngau() < 0.5 ? 0 : Math.PI) : ngau() * 6.28, di ? 0.9 + ngau() * 0.7 : 0);
  }
  for (const m of lopNguoi) { m.count = datNguoi.length; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  for (const m of quay) m.count = datQuay.length;
  for (const [i, m] of doPho.entries()) m.count = Math.min(3000, datDo[i].length);
  goc.add(...lopNguoi, ...quay, ...doPho);
  // tầm xa mỗi lớp (m): người 650 · quầy 900 · cột đèn / bồn cây 900 (cao, thấy từ xa) · ghế / thùng 450 · xe đẩy 600
  const boNguoi = taoBo(lopNguoi, NN, 650, 14), boQuay = taoBo(quay, NQ, 900, 4), boDo = doPho.map((m, k) => taoBo([m], 3000, [900, 450, 900, 450, 600][k], 5));
  const dsBo = [boNguoi, boQuay, ...boDo];
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

  // ---------- xe bay theo làn ----------
  const lan = ql.lanBay.map((l) => {
    const g = l.g.map(([x, z]) => new THREE.Vector3(x, 0, z)), dai = [0];
    for (let i = 1; i < g.length; i++) dai.push(dai[i - 1] + g[i].distanceTo(g[i - 1]));
    return { cao: l.cao, g, dai, L: dai[dai.length - 1] };
  }).filter((l) => l.L > 150);
  const xe = []; for (const [i, l] of lan.entries()) { const n = Math.max(1, Math.round(l.L / 500)); for (let k = 0; k < n; k++) xe.push({ l, s: (k / n) * l.L + i * 37, v: (24 + (i * 13 + k * 7) % 22) * (k % 2 ? -1 : 1), y: l.cao + (k % 2) * 8 }); }
  const xeMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1.3, 4.5, 3, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2f3a44', roughness: 0.35, metalness: 0.6 }), xe.length);
  xeMesh.frustumCulled = false; goc.add(xeMesh);
  const den = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), xe.length);
  den.frustumCulled = false; goc.add(den);
  let yXe = 40;

  function datLai(datMuot) { // gắn mọi thứ xuống mặt đất mới dựng (gọi sau mỗi lần dungDat)
    const muot = datMuot || datTai;
    for (const [i, d] of dsThap.entries()) {
      let y0 = Infinity; for (let a = 0; a < 8; a++) y0 = Math.min(y0, datTai(d.t.o[0] + Math.cos(a) * d.R, d.t.o[1] + Math.sin(a) * d.R));
      y0 = Math.min(y0, datTai(d.t.o[0], d.t.o[1])) - 1;
      d.g.position.y = y0; uKhoet.uThap.value[i].w = y0; d.y0 = y0;
    }
    yXe = datTai(0, 0);
    // dải đại lộ: mỗi đoạn một dải chữ nhật bám đất
    const vs = [], idx = [];
    for (const dl of ql.daiLo) { const w = RONG[dl.lop] / 2;
      for (let i = 1; i < dl.g.length; i++) {
        const [ax, az] = dl.g[i - 1], [bx, bz] = dl.g[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
        const nx = -(bz - az) / L * w, nz = (bx - ax) / L * w, b = vs.length / 3;
        const ex = (bx - ax) / L * w * 0.5, ez = (bz - az) / L * w * 0.5; // kéo dài nửa bề rộng cho mối nối kín
        for (const [x, z] of [[ax - ex + nx, az - ez + nz], [ax - ex - nx, az - ez - nz], [bx + ex + nx, bz + ez + nz], [bx + ex - nx, bz + ez - nz]]) vs.push(x, muot(x, z) + 0.6, z);
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3)); g.setIndex(idx); g.computeVertexNormals();
    loMesh.geometry.dispose(); loMesh.geometry = g;
    for (const [i, p] of datNguoi.entries()) { _p.set(p.x, muot(p.x, p.z) + 0.6, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); _s.setScalar(p.s); boNguoi.dat(i, _m.compose(_p, _q, _s)); }
    _s.setScalar(1);
    for (const [i, p] of datQuay.entries()) { _p.set(p.x, muot(p.x, p.z) + 0.6, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); boQuay.dat(i, _m.compose(_p, _q, _s)); }
    for (const [k, ds] of datDo.entries()) for (const [i, p] of ds.slice(0, 3000).entries()) { _p.set(p.x, muot(p.x, p.z) + 0.6, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); boDo[k].dat(i, _m.compose(_p, _q, _s)); }
    canLoc = true;
    if (goc.visible) { boVa(); dungVa(); }
  }
  // khung va: gộp mọi mesh userData.va của tháp (kể cả tháp vệ tinh, bầu bên) thành MỘT trimesh toạ độ thế giới → đứng trên ban công, mái đài kính, chóp vòm
  function dungVa() { const v = new THREE.Vector3();
    for (const d of dsThap) if (!d.va && d.y0 !== undefined) {
      d.g.updateMatrixWorld(true); const P = [], I = [];
      d.g.traverse((m) => { if (!m.userData.va) return; const geo = m.geometry, pos = geo.attributes.position, b = P.length / 3;
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); P.push(v.x, v.y, v.z); }
        if (geo.index) for (const k of geo.index.array) I.push(b + k); else for (let i = 0; i < pos.count; i++) I.push(b + i); });
      d.va = world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(P), new Uint32Array(I)), tinh);
    } }
  function boVa() { for (const d of dsThap) if (d.va) { world.removeCollider(d.va, false); d.va = null; } }
  function hien(bat) { goc.visible = bat; canLoc = true; if (bat) dungVa(); else boVa(); }

  const _a = new THREE.Vector3(), _camCu = new THREE.Matrix4(), _chieuCu = new THREE.Matrix4(); let canLoc = true, tLoc = 0;
  // lọc lại khi camera đổi (tối đa 10 lần/giây) hoặc đất vừa dựng lại; ep = bắt lọc ngay (chụp 4K đổi khung hình)
  function loc(cam, ep) { const now = performance.now(); cam.updateMatrixWorld();
    const doi = !cam.matrixWorld.equals(_camCu) || !cam.projectionMatrix.equals(_chieuCu);
    if (!ep && !canLoc && (!doi || now - tLoc < 100)) return;
    _camCu.copy(cam.matrixWorld); _chieuCu.copy(cam.projectionMatrix); tLoc = now; canLoc = false;
    _fr.setFromProjectionMatrix(_pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (const b of dsBo) b.loc(cam); }
  function khung(dt, cam) {
    if (!goc.visible) return;
    if (cam) loc(cam);
    uNguoi.uT.value += dt;
    for (const [i, c] of xe.entries()) {
      const l = c.l; c.s = ((c.s + c.v * dt) % l.L + l.L) % l.L;
      let k = 1; while (k < l.dai.length - 1 && l.dai[k] < c.s) k++;
      const a = l.g[k - 1], b = l.g[k], f = (c.s - l.dai[k - 1]) / Math.max(0.01, l.dai[k] - l.dai[k - 1]);
      _p.lerpVectors(a, b, f); _p.y = yXe + c.y; _a.subVectors(b, a); if (c.v < 0) _a.negate();
      _q.setFromEuler(_e.set(0, Math.atan2(_a.x, _a.z), 0)); _s.setScalar(1);
      xeMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      _a.set(0, 0, 3.4).applyQuaternion(_q).add(_p); den.setMatrixAt(i, _m.compose(_a, _q, _s));
    }
    xeMesh.instanceMatrix.needsUpdate = true; den.instanceMatrix.needsUpdate = true;
  }

  return { goc, vatPho, datLai, hien, khung, loc, ql, thap: dsThap, tk: { thap: dsThap.length, nguoi: datNguoi.length, quay: datQuay.length, doPho: datDo.map((d) => d.length).join('/'), xe: xe.length } };
}
