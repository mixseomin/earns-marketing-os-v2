// Kiểu "Nhật 2200" (anh gửi ảnh reel Japan 2200, 22/11/2026): ban ngày nắng trong, tháp trắng / kính xoắn cong có tầng vườn,
// cao tốc trắng trên cột cao 40–70 m có toa bạc chạy, xe bay đĩa bạc phụt xanh; dưới đất giữ phố Tokyo thật của Red Spires.
// Bản độc lập với Red Spires: mượn phố của rs (nhà, người, xe đất, đường) nhưng tháp trắng tự đặt — hai hàng dọc cao tốc + rải theo hạt giống riêng; cao tốc đi theo đại lộ lớn thật.
// Một mesh tháp + một mesh cao tốc gộp sẵn (độ cao bám đất đổi trong datLai, không dựng lại hình) → vài lượt vẽ.
// tra-repo-ok: mã dán keo nội bộ, dựng trên dữ liệu quy hoạch + khung redspires.js đã có
import * as THREE from 'three';
import { TL, batTang, luoiTuyen, oTrong, datThap, banKinhThon, kiem, inKiem } from './khop.js';

const gieo = (id) => { let h = (id * 2654435761 + 1013904223) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
const TRANG = [0.94, 0.94, 0.92], XANH = [0.36, 0.55, 0.30];

// bộ gom hình: mỗi lưới (hàng × cột điểm) có đỉnh riêng → mép giữa hai mặt sắc, trong một mặt mượt
function taoGom() {
  const g = { pos: [], col: [], kinh: [], idx: [], so: [], dy: [] };
  // hang: mảng hàng, mỗi hàng mảng [x, y, z]; so = số gắn đỉnh (chỉ số tháp / điểm tuyến) để datLai cộng độ cao đất
  g.luoi = (hang, mau, kinh, so) => {
    const b = g.pos.length / 3, nc = hang[0].length;
    for (const [i, h] of hang.entries()) for (const [j, p] of h.entries()) {
      g.pos.push(p[0], p[1], p[2]); g.col.push(...mau); g.kinh.push(kinh); g.so.push(typeof so === 'function' ? so(i, j) : so); }
    for (let i = 0; i < hang.length - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = b + i * nc + j, c = a + nc; g.idx.push(a, c, a + 1, a + 1, c, c + 1); }
  };
  g.xong = () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setAttribute('aKinh', new THREE.Float32BufferAttribute(g.kinh, 1));
    geo.setIndex(g.idx); geo.computeVertexNormals();
    return { geo, goc: Float32Array.from(g.pos.filter((_, i) => i % 3 === 1)), so: Int32Array.from(g.so) };
  };
  return g;
}

export function taoNhat2200({ rs, ql, datTai, RAPIER, world, tinh }) {
  const goc = new THREE.Group(); goc.visible = false; goc.name = 'nhat-2200';

  // ---------- chất liệu: kính xanh trời có gờ sàn trắng mỗi tầng, phản trời theo góc nhìn; mặt trắng / vườn theo màu đỉnh ----------
  const vat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  vat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aKinh; varying float vKinh; varying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvKinh = aKinh; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vKinh; varying vec3 vWp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float gSan = 0.0;
        if (vKinh > 0.5) {
          gSan = step(0.83, fract(vWp.y / ${TL.tang.toFixed(2)}));                 // gờ sàn trắng ngay dưới mỗi mặt sàn (chân tháp nằm trên lưới tầng chung)
          float doc = step(0.93, fract((vWp.x + vWp.z) / 2.4)) * 0.35;              // song kính mảnh
          diffuseColor.rgb = mix(vec3(0.26, 0.42, 0.62) + doc * 0.18, vec3(0.86, 0.87, 0.86), gSan);   // kính: màu này nhuộm ảnh trời phản chiếu (kính là mặt gương, xem dưới)
        }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        if (vKinh > 0.5 && gSan < 0.5) { roughnessFactor = 0.07; metalnessFactor = 0.92; }   // ô kính soi bầu trời thật (scene.environment), gờ sàn vẫn là bê tông trắng nhám`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (vKinh > 0.5) totalEmissiveRadiance += (1.0 - gSan) * vec3(0.03, 0.05, 0.07);   // chút sáng trong nhà sau kính`);
  };

  vat.envMapIntensity = 1.5; // kính soi trời mạnh hơn môi trường chung của cảnh (môi trường chung để thấp cho đất, bê tông không bị nhuộm xanh)
  const soiTroi = (r, sc) => { if (vat.envMap !== sc.environment) { vat.envMap = sc.environment; vat.needsUpdate = true; } };

  // ---------- cao tốc trên cao: theo các đại lộ lớn thật dài nhất, bỏ tuyến song song trùng, uốn mượt, né tháp ----------
  const NUA = 1480, chon = [], luoiDa = new Map(), oKey = (x, z) => `${Math.floor(x / 45)},${Math.floor(z / 45)}`;
  const dai = (g) => g.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - g[i - 1][0], p[1] - g[i - 1][1]) : 0), 0);
  for (const dl of ql.daiLo.filter((d) => d.lop === 'lon').map((d) => ({ g: d.g, L: dai(d.g) })).sort((a, b) => b.L - a.L)) {
    if (chon.length >= 7 || dl.L < 500) break;
    // chia đều 20 m, cắt trong vùng đất
    let P = []; for (let i = 1; i < dl.g.length; i++) { const a = dl.g[i - 1], b = dl.g[i], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20));
      for (let j = i === 1 ? 0 : 1; j <= k; j++) P.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
    P = P.filter((p) => Math.abs(p[0]) < NUA && Math.abs(p[1]) < NUA); if (P.length < 30) continue;
    const trung = P.filter((p) => luoiDa.has(oKey(p[0], p[1]))).length; if (trung > P.length * 0.35) continue;
    const muot = (A, r) => A.map((p, i) => { if (i < r || i >= A.length - r) return p; let x = 0, z = 0; for (let k = -r; k <= r; k++) { x += A[i + k][0]; z += A[i + k][1]; } return [x / (2 * r + 1), z / (2 * r + 1)]; });
    for (let l = 0; l < 3; l++) P = muot(P, 3);
    for (const p of P) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) luoiDa.set(oKey(p[0] + a * 30, p[1] + b * 30), 1);
    const kc = [0]; for (let i = 1; i < P.length; i++) kc.push(kc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    chon.push({ P, kc, L: kc[kc.length - 1], y: new Float32Array(P.length), pha: chon.length * 1.7 });
  }
  // ---------- tháp trắng của riêng Nhật 2200 (không mượn tháp đỏ): hai hàng dọc cao tốc (reel Japan 2200) rồi rải thêm, né nhau + né mọi tuyến ----------
  // Luật khớp (khop.js): dấu chân THẬT của từng dáng (thân nghiêng + phình + sàn vườn) hở mép đường / tàu / cao tốc ≥ viaHe, hở tháp khác ≥ khe,
  // cao / rộng ≥ thon; chỗ vướng thì dời vào khối trống gần nhất rồi mới thu bán kính — không gộp, không chồng.
  const dsT = [], daDat = [], rTh = gieo(2200), DOC_TOI_DA = 48, RAI_TOI_DA = 30;
  const luoi = luoiTuyen({ daiLo: [...ql.daiLo, ...chon.map((c) => ({ g: c.P, lop: 'caoToc', hw: TL.caoToc.nua }))], pho: ql.pho, tau: ql.tau });
  // dáng một tháp: rút hết tham số ngẫu nhiên trước khi đặt, để đo được dấu chân thật lúc chọn chỗ
  const dang = (id, ti, caoSpire) => { const r = gieo(id * 7 + 3), loai = ['xoan', 'bac', 'cong'][(ti + ((r() * 3) | 0)) % 3], d = { r, loai, k0: loai === 'bac' ? 0.62 : 0.78 };
    d.Hc = caoSpire * (0.82 + r() * 0.1); d.n = loai === 'xoan' ? 2.6 + r() * 1.2 : 2 + r() * 0.5; d.xoan = loai === 'xoan' ? 0.9 + r() * 1.1 : loai === 'bac' ? r() * 0.3 : 0.2 + r() * 0.4;
    d.thon = 0.22 + r() * 0.3; d.phinh = loai === 'cong' ? 0.12 + r() * 0.12 : 0.04; d.nghieng = loai === 'cong' ? 0.25 + r() * 0.3 : 0; d.hNg = r() * 6.28; d.quay = r() * 6.28; d.cs = 1 + r() * 0.3;
    d.sau0 = loai === 'xoan' ? 2.2 + r() * 1.2 : loai === 'bac' ? 6 + r() * 4 : 3.5 + r() * 2.5; return d; };
  const hinh = (d, banKinh, x0, z0, Hc) => { const R = banKinh * d.k0, ngh = d.nghieng * R;
    const tam = (u) => { const l = ngh * Math.sin(u * Math.PI * 0.75); return [x0 + Math.cos(d.hNg) * l, z0 + Math.sin(d.hNg) * l]; };
    const banK = (a, u) => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)) * d.cs, rr = Math.pow(Math.pow(c, d.n) + Math.pow(s, d.n), -1 / d.n);
      return R * rr * (1 - d.thon * Math.pow(u, 1.4)) * (1 + d.phinh * Math.sin(u * Math.PI)); };
    const diem = (a, u, them) => { const [cx, cz] = tam(u), b = banK(a, u) + (them || 0), g = a + d.quay + d.xoan * u; return [cx + Math.cos(g) * b, u * Hc, cz + Math.sin(g) * b]; };
    return { R, tam, diem }; };
  // bán kính dấu chân thật (thân + sàn vườn từ tầng 3, mọi độ cao tới uMax) tính từ tâm chân
  const vetCua = (d, banKinh, uMax = 1) => { const { diem } = hinh(d, banKinh, 0, 0, 100); let m = 0;
    for (let u = 0; u <= uMax + 1e-9; u += 0.05) for (let a = 0; a < 6.283; a += 0.1) { const p = diem(a, u, u * d.Hc >= 3 * TL.tang ? d.sau0 : 0); m = Math.max(m, Math.hypot(p[0], p[2])); } return m; };
  const datMot = (id, x, z, banKinh, caoSpire, tamMax) => {
    const d = dang(id, dsT.length, caoSpire), vet = vetCua(d, banKinh) / banKinh;
    const p = datThap(luoi, daDat, x, z, banKinhThon(banKinh, d.Hc, vet), vet, tamMax); if (!p || Math.abs(p.x) > NUA - 60 || Math.abs(p.z) > NUA - 60) return false;
    const ext = vetCua(d, p.banKinh); if (!oTrong(luoi, daDat, p.x, p.z, ext)) return false; // thu bán kính làm sàn vườn (cố định mét) lồi ra tương đối → đo lại bằng dấu chân thật
    d.Hc = batTang(Math.max(d.Hc, 2 * TL.thon * ext + TL.tang)); // tháp mảnh: không đủ cao so với dấu chân thì vươn thêm, đỉnh thân nằm trên lưới tầng
    daDat.push({ x: p.x, z: p.z, r: ext });
    dsT.push({ t: { id, o: [p.x, p.z], banKinh: p.banKinh, caoSpire, ext, day: vetCua(d, p.banKinh, 0.06) }, d }); return true; };
  for (const c of chon) for (let i = 18, ben = 1; i < c.P.length - 18 && dsT.length < DOC_TOI_DA; i += 7, ben = -ben) {
    if (c.kc[i] < 300 || c.kc[i] > c.L - 300 || rTh() < 0.25) continue;
    const [ax, az] = c.P[i - 2], [bx, bz] = c.P[i + 2], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
    const R = 20 + rTh() * 16, lui = TL.caoToc.nua + R + TL.viaHe + rTh() * 22, x = c.P[i][0] + nx * lui * ben, z = c.P[i][1] + nz * lui * ben;
    datMot(5000 + dsT.length, x, z, R / 0.78, 170 + rTh() * 230, 40); // hàng dọc cao tốc: chỉ dời trong 40 m để giữ hàng
  }
  const soDoc = dsT.length;
  for (let thu = 0, rai = 0; thu < 600 && rai < RAI_TOI_DA; thu++) { // rải: dày ở giữa, càng gần tâm càng cao
    const a = rTh() * 6.28, kc = 1250 * Math.pow(rTh(), 0.7), x = Math.cos(a) * kc, z = Math.sin(a) * kc, R = 18 + rTh() * 20;
    if (datMot(6000 + dsT.length, x, z, R / 0.78, (150 + rTh() * 200) * (1.25 - kc / 2500), 30)) rai++;
  }
  const khoetN = dsT.map((q) => new THREE.Vector4(q.t.o[0], q.t.o[1], q.t.day + TL.viaHe, 0)); // nhà PLATEAU dưới chân tháp trắng khoét theo dấu chân đất + vỉa hè (rs.khoet)

  // ---------- tháp trắng: thân siêu elip xoắn / thon / cong, sàn vườn trắng (vòng đủ, xoắn ốc, nửa vòng), vòm đỉnh, kim ----------
  const gT = taoGom(), cay = [];
  for (const [ti, q] of dsT.entries()) {
    const { t, d } = q, { r, loai, Hc, xoan, quay } = d, x0 = t.o[0], z0 = t.o[1], { R, tam, diem } = hinh(d, t.banKinh, x0, z0, Hc);
    const S = 30, N = 36;
    const than = []; for (let i = 0; i <= N; i++) { const u = i / N, h = []; for (let j = 0; j <= S; j++) h.push(diem(j / S * 6.2832, u)); than.push(h); }
    gT.luoi(than, TRANG, 1, ti);
    // vòm đỉnh kính + kim trắng
    const dinh = loai === 'bac' ? 0.35 : 0.9 + r() * 0.8, vom = []; for (let i = 0; i <= 6; i++) { const k = i / 6, h = [];
      for (let j = 0; j <= S; j++) { const p = diem(j / S * 6.2832, 1), [cx, cz] = tam(1), f = Math.cos(k * Math.PI / 2);
        h.push([cx + (p[0] - cx) * f, Hc + Math.sin(k * Math.PI / 2) * R * dinh, cz + (p[2] - cz) * f]); } vom.push(h); }
    gT.luoi(vom, TRANG, 1, ti); t.cao = Hc + R * dinh; t.caoKim = t.cao; // tính từ chân tháp
    if (r() < 0.8) { const [cx, cz] = tam(1), y = Hc + R * dinh * 0.9, hk = 25 + r() * 55, kim = [];
      for (let i = 0; i <= 1; i++) { const h = [], rk = i ? 0.15 : 1.6; for (let j = 0; j <= 8; j++) h.push([cx + Math.cos(j / 8 * 6.2832) * rk, y + i * hk, cz + Math.sin(j / 8 * 6.2832) * rk]); kim.push(h); }
      gT.luoi(kim, TRANG, 0, ti); t.caoKim = y + hk; }
    // sàn vườn: xoan = vòng đủ mỗi 2 tầng, mép lượn sóng; bac = cung xoắn ốc sâu mỗi 3 tầng; cong = nửa vòng so le mỗi 3 tầng
    const buoc = TL.tang * (loai === 'xoan' ? 2 : 3), sau0 = d.sau0; // sàn vườn đúng mặt sàn: mỗi 2 / 3 tầng, từ tầng 3
    const nhip = (loai === 'xoan' ? 1 : 2) + ((r() * 2) | 0), lech = r() * 6.28;
    for (let y = 3 * TL.tang, lv = 0; y < Hc - 6; y += buoc, lv++) {
      const u = y / Hc, a0 = loai === 'bac' ? lech + lv * 0.62 : loai === 'cong' ? lech + (lv % 2) * Math.PI : 0;
      const nhip2 = loai === 'xoan' ? 6.2832 : loai === 'bac' ? 3.6 : 3.1, M = loai === 'xoan' ? 30 : 16;
      const sau = (k) => { const a = k / M; const vien = loai === 'xoan' ? 1 : Math.sin(Math.PI * a) ** 0.6; return sau0 * vien * (0.75 + 0.25 * Math.sin(a * 9 + lv)); };
      const vong = (them, dy) => { const h = []; for (let k = 0; k <= M; k++) { const a = a0 + k / M * nhip2, p = diem(a - quay - xoan * u, u, them(k)); p[1] = y + dy; h.push(p); } return h; };
      const trong = vong(() => -0.6, 0), ngoai = vong(sau, 0), ngoaiD = vong(sau, -0.6), trongD = vong(() => -0.6, -0.6), lanCan = vong(sau, TL.lanCan);
      gT.luoi([trong, ngoai], TRANG, 0, ti); gT.luoi([trongD, ngoaiD], TRANG, 0, ti); gT.luoi([ngoaiD, lanCan], TRANG, 0, ti);
      if (lv % nhip === 0 && sau0 > 1.5) { // bồn cây sát lan can + cây
        const b1 = vong((k) => sau(k) - Math.min(2.2, sau0 * 0.45), 0.5), b2 = vong((k) => sau(k) - 0.25, 0.5);
        gT.luoi([b1, b2], XANH, 0, ti);
        if (cay.length < 14000) for (let k = 1; k < M; k += loai === 'xoan' ? 2 : 1) { const p = b1[k], q = b2[k];
          cay.push({ ti, x: (p[0] + q[0]) / 2, y: y + 0.5, z: (p[2] + q[2]) / 2, s: (loai === 'bac' ? 1.6 : 1) * (0.8 + r() * 0.8) }); }
      }
    }
  }
  const T = gT.xong(), thapMesh = new THREE.Mesh(T.geo, vat); thapMesh.frustumCulled = false; goc.add(thapMesh); thapMesh.onBeforeRender = soiTroi;
  const gCay = new THREE.IcosahedronGeometry(1, 0).scale(1.3, 1.6, 1.3).translate(0, 1.4, 0);
  const cayMesh = new THREE.InstancedMesh(gCay, new THREE.MeshLambertMaterial({ color: '#4f7f3c' }), Math.max(1, cay.length)); cayMesh.count = cay.length;
  cayMesh.frustumCulled = false; goc.add(cayMesh);

  // mặt cắt (ngang, đứng): lan can hai bên, lòng đường, bụng cong thót
  // lòng đường chia dải: vạch mép trắng · làn xám · vạch tim trắng · làn xám · vạch mép (MAU_MC theo từng đoạn)
  const MC = [[-7.2, 0], [-7.2, 1.3], [-6.8, 1.3], [-6.8, 0.15], [-6.4, 0.15], [-0.15, 0.15], [0.15, 0.15], [6.4, 0.15], [6.8, 0.15], [6.8, 1.3], [7.2, 1.3], [7.2, 0], [4.2, -2.6], [-4.2, -2.6], [-7.2, 0]];
  const LAN = [0.46, 0.48, 0.50], MAU_MC = { 4: LAN, 6: LAN };
  const gC = taoGom(); let soDiem = 0; const goTuyen = [];
  for (const c of chon) {
    const ph = (i) => { const a = c.P[Math.max(0, i - 1)], b = c.P[Math.min(c.P.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / L, -(b[0] - a[0]) / L]; };
    for (let e = 0; e < MC.length - 1; e++) {
      const mau = MAU_MC[e] || TRANG, hang = [];
      for (const k of [0, 1]) { const [lx, ly] = MC[e + k], h = []; for (let i = 0; i < c.P.length; i++) { const [nx, nz] = ph(i); h.push([c.P[i][0] + nx * lx, ly, c.P[i][1] + nz * lx]); } hang.push(h); }
      gC.luoi(hang, mau, 0, (_, j) => soDiem + j);
    }
    goTuyen.push(soDiem); soDiem += c.P.length;
  }
  const C = gC.xong(), caoMesh = new THREE.Mesh(C.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  caoMesh.frustumCulled = false; goc.add(caoMesh);
  const cot = []; for (const c of chon) for (let s = 30; s < c.L - 30; s += 62) cot.push({ c, s });
  const cotMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.5, 2.3, 1, 12).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#e9eae7', roughness: 0.7 }), Math.max(1, cot.length));
  cotMesh.frustumCulled = false; goc.add(cotMesh);
  // toa bạc chạy trên cao tốc, hai chiều
  const toa = [], rT = gieo(77);
  for (const c of chon) { const n = Math.round(c.L / 45); for (let k = 0; k < n; k++) { const chieu = k % 2 ? -1 : 1; toa.push({ c, s: rT() * c.L, v: (26 + rT() * 16) * chieu, ben: chieu * (2.6 + (k % 4 < 2 ? 0 : 2.4)) }); } }
  const toaMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1.25, 4.4, 4, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d7dce0', roughness: 0.22, metalness: 0.7 }), Math.max(1, toa.length));
  toaMesh.frustumCulled = false; goc.add(toaMesh);
  const layTuyen = (c, s, out) => { s = Math.max(0, Math.min(c.L - 0.01, s)); let lo = 0, hi = c.kc.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.kc[m] <= s) lo = m; else hi = m; }
    const f = (s - c.kc[lo]) / Math.max(0.01, c.kc[hi] - c.kc[lo]), a = c.P[lo], b = c.P[hi], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    out.x = a[0] + (b[0] - a[0]) * f; out.z = a[1] + (b[1] - a[1]) * f; out.y = c.y[lo] + (c.y[hi] - c.y[lo]) * f; out.dx = (b[0] - a[0]) / L; out.dz = (b[1] - a[1]) / L; return out; };

  // ---------- xe bay đĩa bạc: thân dẹt kim loại, kính đỉnh, đĩa sáng xanh dưới bụng + quầng phụt xanh ----------
  const dia = [], rD = gieo(131);
  for (const l of ql.lanBay) { const L = dai(l.g); if (L < 150) continue; const n = Math.min(4, Math.max(1, Math.round(L / 160)));
    for (let k = 0; k < n; k++) dia.push({ g: l.g, kc: l.g.map((_, i) => dai(l.g.slice(0, i + 1))), L, s: rD() * L, v: (22 + rD() * 20) * (k % 2 ? -1 : 1), y: 55 + rD() * 140, ben: (rD() - 0.5) * 2 * (TL.duong.lon - 9), // làn bay trong lòng đại lộ: tháp đứng ngoài mép đường + vỉa hè
      lac: rD() * 6.28 }); }
  const gDia = new THREE.SphereGeometry(1, 20, 10).scale(3.4, 0.75, 3.4);
  const diaMesh = new THREE.InstancedMesh(gDia, new THREE.MeshStandardMaterial({ color: '#dfe4e8', roughness: 0.18, metalness: 0.85 }), dia.length);
  const kinhMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 6, 0, 6.2832, 0, Math.PI / 2).scale(1.5, 0.9, 1.5).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: '#2d4a60', roughness: 0.1, metalness: 0.6 }), dia.length);
  const denMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(2.3, 24).rotateX(Math.PI / 2).translate(0, -0.62, 0), new THREE.MeshBasicMaterial({ color: '#7fe3ff', side: THREE.DoubleSide }), dia.length);
  const gQuang = new THREE.ConeGeometry(2.6, 9, 20, 1, true).translate(0, -5.1, 0);
  const quangMesh = new THREE.InstancedMesh(gQuang, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying float vY; void main() { vY = uv.y; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vY; void main() { gl_FragColor = vec4(mix(vec3(0.35, 0.78, 1.0), vec3(0.85, 0.97, 1.0), vY), pow(vY, 2.5) * 0.75); }` }), dia.length);
  for (const m of [diaMesh, kinhMesh, denMesh, quangMesh]) { m.frustumCulled = false; goc.add(m); }
  let yNen = 0;
  const layDia = (c, out) => { let lo = 0, hi = c.kc.length - 1; const s = c.s; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.kc[m] <= s) lo = m; else hi = m; }
    const a = c.g[lo], b = c.g[hi], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = (s - c.kc[lo]) / L; out.dx = (b[0] - a[0]) / L; out.dz = (b[1] - a[1]) / L;
    out.x = a[0] + (b[0] - a[0]) * f + out.dz * c.ben; out.z = a[1] + (b[1] - a[1]) * f - out.dx * c.ben; return out; };

  // ---------- bám đất + luật khớp: chân tháp trên lưới tầng chung, cao tốc dốc ≤ doc + giao nhau khác cao độ, cột không đâm mặt dưới, đĩa bay trên cao tốc ----------
  // khoảng cách mặt bằng từ (x, z) tới tuyến c + độ cao mặt tuyến ở điểm gần nhất
  const ganNhat = (c, x, z) => { let m = Infinity, y = 0; for (let i = 1; i < c.P.length; i++) { const [ax, az] = c.P[i - 1], [bx, bz] = c.P[i], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz,
    t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0, d = Math.hypot(x - ax - t * dx, z - az - t * dz); if (d < m) { m = d; y = c.y[i - 1] + (c.y[i] - c.y[i - 1]) * t; } } return { d: m, y }; };
  // bao dốc: kéo mảng y về trong giới hạn dốc k theo cả hai chiều — tran = trần (hạ đỉnh nhọn), san = sàn (nâng hố)
  const baoDoc = (y, kc, k, tran) => { const n = y.length, f = tran ? Math.min : Math.max, s = tran ? 1 : -1;
    for (let i = 1; i < n; i++) y[i] = f(y[i], y[i - 1] + s * k * (kc[i] - kc[i - 1]));
    for (let i = n - 2; i >= 0; i--) y[i] = f(y[i], y[i + 1] + s * k * (kc[i + 1] - kc[i])); return y; };
  const khop = { tong: 0, luat: {}, vd: {} };
  function datLai(muot) {
    const yT = dsT.map((q, i) => { const { o: [x, z], day } = q.t; let y = datTai(x, z);   // chân tháp: điểm đất thấp nhất quanh dấu chân, hạ về lưới tầng chung (như tháp đỏ)
      for (let a = 0; a < 8; a++) y = Math.min(y, datTai(x + Math.cos(a) * day, z + Math.sin(a) * day)); const y0 = Math.floor((y - 1) / TL.tang) * TL.tang; khoetN[i].w = y0; return y0; });
    if (goc.visible) rs.khoet(khoetN);
    const pT = T.geo.attributes.position; for (let i = 0; i < T.so.length; i++) pT.setY(i, T.goc[i] + yT[T.so[i]]);
    pT.needsUpdate = true; T.geo.computeBoundingSphere();
    for (const [i, c] of cay.entries()) { _p.set(c.x, c.y + yT[c.ti], c.z); _s.setScalar(c.s); cayMesh.setMatrixAt(i, _m.compose(_p, _q.identity(), _s)); }
    cayMesh.instanceMatrix.needsUpdate = true; _s.setScalar(1);
    // cao tốc: mục tiêu cao + sóng, hai đầu đáp xuống đường; trần dốc → đường lên xuống thoải; sàn = trên đất + vượt qua tuyến đã đặt (tuyến trước giữ nguyên, tuyến sau bay qua)
    const K = TL.caoToc.doc * 0.9, CT = TL.caoToc;
    for (const [ia, c] of chon.entries()) { const n = c.P.length, d = Float32Array.from(c.P, (p) => muot(p[0], p[1])), m = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0, k = 0; for (let j = Math.max(0, i - 8); j <= Math.min(n - 1, i + 8); j++) { s += d[j]; k++; } m[i] = s / k; }
      const DAU = 0.45; // hai đầu đáp đúng mặt đường (lòng cao tốc = c.y + 0,15 = mặt đường muot + 0,6) → xe chạy từ phố lên dốc được
      const muc = baoDoc(Float32Array.from(m, (g, i) => (i === 0 || i === n - 1 ? d[i] + DAU : g + CT.cao + CT.song * Math.sin(c.kc[i] / 300 + c.pha))), c.kc, K, true);
      const san = Float32Array.from(d, (g, i) => g + Math.min(4, DAU + K * Math.min(c.kc[i], c.L - c.kc[i]))); // sàn cũng thoải về hai đầu, không thì đầu dốc dựng đứng
      for (let ib = 0; ib < ia; ib++) for (let i = 0; i < n; i++) { const g = ganNhat(chon[ib], c.P[i][0], c.P[i][1]); if (g.d < 2 * CT.nua + 4) san[i] = Math.max(san[i], g.y + CT.tinh + 1); }
      baoDoc(san, c.kc, K, false); for (let i = 0; i < n; i++) c.y[i] = Math.max(muc[i], san[i]); }
    const pC = C.geo.attributes.position; let b = 0; const yTuyen = new Float32Array(soDiem); for (const c of chon) { yTuyen.set(c.y, b); b += c.y.length; }
    for (let i = 0; i < C.so.length; i++) pC.setY(i, C.goc[i] + yTuyen[C.so[i]]);
    pC.needsUpdate = true; C.geo.computeBoundingSphere();
    // cột: bỏ chỗ quá thấp, và chỗ sẽ đâm qua mặt một tuyến khác nằm dưới (nút giao chồng)
    const o = {}; let cotBo = 0; for (const [i, k] of cot.entries()) { layTuyen(k.c, k.s, o); const day = muot(o.x, o.z), cao = Math.max(0.1, o.y - CT.day - day);
      const dam = chon.some((c2) => { if (c2 === k.c) return false; const g = ganNhat(c2, o.x, o.z); return g.d < CT.nua + 2.4 && g.y < o.y; });
      _p.set(o.x, day, o.z); _s.set(1, cao, 1); cotMesh.setMatrixAt(i, _m.compose(_p, _q.identity(), _s)); if (cao < 6 || dam) { cotMesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); cotBo += dam; } }
    cotMesh.instanceMatrix.needsUpdate = true; _s.set(1, 1, 1);
    yNen = datTai(0, 0);
    // đĩa bay: cả làn bay ở một độ cao — nâng lên cho qua mọi mặt cao tốc / đỉnh tháp nằm dưới làn (cách bayTren)
    const thapTren = dsT.map((q, i) => ({ x: q.t.o[0], z: q.t.o[1], r: q.t.ext, y0: yT[i], cao: q.t.caoKim }));
    const bay = [], ob = {};
    for (const c of dia) { let can = yNen + c.y; const s0 = c.s, mau = [];
      for (let s = 0; s <= c.L; s += 20) { c.s = s; layDia(c, ob); mau.push([ob.x, ob.z]);
        for (const c2 of chon) { const g = ganNhat(c2, ob.x, ob.z); if (g.d < CT.nua + 6 + 3.4) can = Math.max(can, g.y + TL.bayTren + 1); }
        for (const t of thapTren) if (Math.hypot(t.x - ob.x, t.z - ob.z) < t.r + 6 + 3.4) can = Math.max(can, t.y0 + t.cao + TL.bayTren + 1); }
      c.s = s0; c.yBay = can - yNen; for (const [x, z] of mau) bay.push({ x, z, y: can }); }
    const k = kiem(luoi, { thap: thapTren.map((t, i) => ({ ...t, cao: dsT[i].d.Hc, rong: 2 * t.r })), caoToc: chon.map((c) => ({ P: c.P, y: c.y })), bay, thapTren });
    Object.assign(khop, k, { cotBo, bayNang: dia.filter((c) => c.yBay > c.y + 0.5).length });
    console.info(inKiem('nhật 2200', k), `· cột bỏ vì đâm mặt dưới ${cotBo} · làn bay nâng ${khop.bayNang}/${dia.length}`);
    vaCot = cot.map((k) => { cotMesh.getMatrixAt(cot.indexOf(k), _m); _p.setFromMatrixPosition(_m); const cao = _m.elements[5]; return cao > 0 ? { x: _p.x, y: _p.y, z: _p.z, cao } : null; });
    if (goc.visible) dungVa();
  }

  // ---------- khung va chạm (2f nhịp A): mặt cao tốc + lan can + bụng, tháp trắng, cột — ĐÚNG các đỉnh đang vẽ, chỉ khi kiểu Nhật 2200 đang bật ----------
  let va = [], vaCot = [];
  const triTu = (geo) => world.createCollider(RAPIER.ColliderDesc.trimesh(Float32Array.from(geo.attributes.position.array), Uint32Array.from(geo.index.array)), tinh);
  function boVa() { for (const c of va) world.removeCollider(c, false); va = []; }
  function dungVa() { boVa(); if (!world) return;
    try { va.push(triTu(C.geo), triTu(T.geo));
      for (const c of vaCot) if (c) va.push(world.createCollider(RAPIER.ColliderDesc.cylinder(c.cao / 2, 2).setTranslation(c.x, c.y + c.cao / 2, c.z), tinh));
    } catch (e) { console.warn('[nhật 2200] dựng khung va lỗi', e); } }

  // ---------- ẩn / hiện: tháp đỏ (hình, khung va, cầu, xe bay) do rs.hien(phố, tháp) tắt; ở đây chỉ đổi bộ khoét ----------
  function hien(bat) { goc.visible = bat; rs.khoet(bat ? khoetN : null); if (bat) dungVa(); else boVa(); }

  const o = {};
  function khung(dt) {
    if (!goc.visible) return;
    for (const [i, t] of toa.entries()) { t.s += t.v * dt; if (t.s > t.c.L) t.s -= t.c.L; else if (t.s < 0) t.s += t.c.L;
      layTuyen(t.c, t.s, o); const dx = t.v < 0 ? -o.dx : o.dx, dz = t.v < 0 ? -o.dz : o.dz, ben = Math.abs(t.ben);
      _p.set(o.x + dz * ben, o.y + 1.5, o.z - dx * ben); _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(dx, dz)); toaMesh.setMatrixAt(i, _m.compose(_p, _q, _s)); }
    toaMesh.instanceMatrix.needsUpdate = true;
    for (const [i, c] of dia.entries()) { c.s += c.v * dt; if (c.s > c.L) { c.s = c.L; c.v = -Math.abs(c.v); } else if (c.s < 0) { c.s = 0; c.v = Math.abs(c.v); }
      c.lac += dt; layDia(c, o); const h = Math.atan2(c.v < 0 ? -o.dx : o.dx, c.v < 0 ? -o.dz : o.dz);
      _p.set(o.x, yNen + (c.yBay ?? c.y) + Math.sin(c.lac * 1.3) * 1.5, o.z); _q.setFromEuler(_e.set(0.1, h, Math.sin(c.lac * 0.7) * 0.06, 'YXZ'));
      _m.compose(_p, _q, _s); diaMesh.setMatrixAt(i, _m); kinhMesh.setMatrixAt(i, _m); denMesh.setMatrixAt(i, _m); quangMesh.setMatrixAt(i, _m); }
    for (const m of [diaMesh, kinhMesh, denMesh, quangMesh]) m.instanceMatrix.needsUpdate = true;
  }

  return { goc, datLai, hien, khung, cao: chon, thap: dsT.map((q) => q.t), tk: { thap2200: dsT.length, thapDoc: soDoc, cay: cay.length, caoToc: chon.length, toa: toa.length, dia: dia.length, dinhThap: T.so.length, khop, va: () => va.length } };
}
