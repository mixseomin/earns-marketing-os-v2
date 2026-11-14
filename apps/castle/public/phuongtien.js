// Ngựa + xe ngựa dựng bằng mã (không tệp mô hình). Chỉ hình + dáng đi; vật lý / điều khiển nằm trong main.js.
// Trục: +z là phía trước con vật, gốc toạ độ ở mặt đất dưới giữa thân.
// Nhẹ GPU: mỗi đoạn cứng (thân, cổ, đầu, đuôi, đùi, ống chân) gộp thành MỘT lưới tô màu theo đỉnh → ngựa 12 lệnh vẽ, xe 3;
// chỉ thân / cổ / thùng xe đổ bóng.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const VL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _c = new THREE.Color();
// gộp các mảnh [hình, màu, x, y, z, xoayX, xoayY, xoayZ] thành một hình có màu đỉnh
function gop(manh) {
  return mergeGeometries(manh.map(([g, mau, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => {
    g = (g.index ? g.toNonIndexed() : g.clone());
    g.applyMatrix4(_m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    _c.set(mau); const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  }));
}
const luoi = (g, bong = false) => { const m = new THREE.Mesh(g, VL); m.castShadow = bong; return m; };
const nhom = (cha, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); cha.add(g); return g; };

const HINH = new Map(); // hình gộp dùng chung theo màu lông
function hinhNgua(mau) {
  if (HINH.has(mau)) return HINH.get(mau);
  const BOM = 0x1c1410, DA = 0x3a2214;
  const h = {
    than: gop([[new THREE.CapsuleGeometry(0.4, 1.15, 6, 14), mau, 0, 0, 0, Math.PI / 2], [new THREE.BoxGeometry(0.62, 0.12, 0.62), DA, 0, 0.42, 0.05], [new THREE.BoxGeometry(0.03, 0.4, 0.05), DA, 0.32, 0.2, 0.05], [new THREE.BoxGeometry(0.03, 0.4, 0.05), DA, -0.32, 0.2, 0.05]]),
    co: gop([[new THREE.CylinderGeometry(0.15, 0.28, 0.95, 10), mau, 0, 0.45, 0], [new THREE.BoxGeometry(0.07, 0.85, 0.2), BOM, 0, 0.47, -0.15]]),
    dau: gop([[new THREE.CylinderGeometry(0.1, 0.15, 0.62, 8), mau, 0, 0.28, 0.02], [new THREE.SphereGeometry(0.11, 8, 6), mau, 0, 0.58, 0.04], [new THREE.ConeGeometry(0.045, 0.16, 6), mau, 0.07, -0.02, -0.13, -1.3], [new THREE.ConeGeometry(0.045, 0.16, 6), mau, -0.07, -0.02, -0.13, -1.3],
      [new THREE.SphereGeometry(0.03, 6, 4), BOM, 0.125, 0.12, 0.08], [new THREE.SphereGeometry(0.03, 6, 4), BOM, -0.125, 0.12, 0.08]]),
    duoi: gop([[new THREE.CylinderGeometry(0.07, 0.03, 0.85, 6), BOM, 0, -0.42, 0]]),
    dui: gop([[new THREE.CylinderGeometry(0.14, 0.08, 0.55, 8), mau, 0, -0.27, 0]]),
    ong: gop([[new THREE.CylinderGeometry(0.055, 0.05, 0.5, 6), mau, 0, -0.25, 0], [new THREE.BoxGeometry(0.11, 0.07, 0.14), BOM, 0, -0.52, 0.02]]),
  };
  HINH.set(mau, h); return h;
}

export function dungNgua(scene, mau = 0x6b4226) {
  const h = hinhNgua(mau);
  const goc = new THREE.Group(); scene.add(goc);
  const than = nhom(goc, 0, 1.38, 0); than.add(luoi(h.than, true));     // thân nhún theo dáng đi
  const co = nhom(than, 0, 0.22, 0.72); co.rotation.x = 0.65; co.add(luoi(h.co, true)); // cổ ngả tới trước (x dương = nghiêng về +z)
  const dau = nhom(co, 0, 0.9, 0); dau.rotation.x = 1.7; dau.add(luoi(h.dau));          // đầu chúc xuống trước
  const duoi = nhom(than, 0, 0.12, -0.95); duoi.rotation.x = 0.5; duoi.add(luoi(h.duoi));
  const chan = [];
  for (const [x, z] of [[0.21, 0.6], [-0.21, 0.6], [0.21, -0.62], [-0.21, -0.62]]) {
    const dui = nhom(than, x, -0.28, z); dui.add(luoi(h.dui));
    const goi = nhom(dui, 0, -0.54, 0); goi.add(luoi(h.ong));
    chan.push({ dui, goi, truoc: z > 0 });
  }
  let pha = Math.random(), tt = Math.random() * 10;
  return {
    goc, than,
    // toc: m/s; anCo: đứng gặm cỏ khi rảnh
    capNhat(dt, toc, anCo = false) {
      if (!goc.visible) return;
      tt += dt; pha = (pha + dt * (toc > 0.1 ? 0.55 + toc * 0.16 : 0)) % 1;
      // dáng: đi bộ 4 nhịp · chạy nước kiệu chéo · phi nước đại
      const L = toc < 3 ? [0, 0.5, 0.75, 0.25] : toc < 8 ? [0, 0.5, 0.5, 0] : [0.1, 0, 0.6, 0.5];
      const A = Math.min(1, toc / 2) * (toc < 8 ? 0.45 : 0.75);
      chan.forEach((c, i) => {
        const g = (pha + L[i]) * Math.PI * 2;
        c.dui.rotation.x = Math.sin(g) * A * (c.truoc ? 1 : 0.9);
        c.goi.rotation.x = (c.truoc ? 1 : -1) * Math.max(0, Math.cos(g)) * A * 1.6; // gối trước gập ra sau, khoeo sau gập tới trước
      });
      than.position.y = 1.38 + (toc > 0.1 ? Math.abs(Math.sin(pha * Math.PI * 2)) * Math.min(0.12, toc * 0.012) : 0);
      than.rotation.x = toc > 8 ? Math.sin(pha * Math.PI * 2) * 0.06 : 0;
      const cui = anCo && toc < 0.1 ? THREE.MathUtils.smoothstep(Math.sin(tt * 0.3), -0.2, 0.3) : 0;  // gặm cỏ từng đợt: cúi hẳn xuống, đầu chúc đất
      co.rotation.x += ((0.6 + cui * 1.65) - co.rotation.x) * Math.min(1, dt * 2.5);
      dau.rotation.x = 1.7 - (co.rotation.x - 0.6) * 0.55 + Math.sin(tt * 2.1) * 0.04 + (toc > 8 ? Math.sin(pha * Math.PI * 2) * 0.1 : 0);
      duoi.rotation.z = Math.sin(tt * 1.7) * 0.25; duoi.rotation.x = 0.5 + Math.min(0.8, toc * 0.08);
    },
  };
}

// xe hai bánh kéo bởi một con ngựa; gốc xe ở mặt đất dưới trục bánh, ngựa đứng trước 2,75 m
export function dungXe(scene) {
  const GO = 0x7a5232, GO2 = 0x4a3020, SAT = 0x2a2a2e;
  const goc = new THREE.Group(); scene.add(goc);
  const manh = [[new THREE.BoxGeometry(1.5, 0.1, 1.9), GO, 0, 0.75, -0.2], [new THREE.BoxGeometry(1.5, 0.45, 0.06), GO2, 0, 1.0, -1.13], [new THREE.BoxGeometry(1.3, 0.1, 0.35), GO, 0, 1.15, 0.55],
    [new THREE.BoxGeometry(0.4, 0.3, 0.35), GO2, 0.3, 1.0, -0.6], [new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10), GO2, -0.3, 1.0, -0.5]];
  for (const x of [-0.72, 0.72]) manh.push([new THREE.BoxGeometry(0.06, 0.45, 1.9), GO2, x, 1.0, -0.2]);
  for (const x of [-0.45, 0.45]) manh.push([new THREE.BoxGeometry(0.07, 0.07, 2.4), GO2, x, 0.85, 1.85, 0.08]); // càng xe
  goc.add(luoi(gop(manh), true));
  const gBanh = gop([[new THREE.TorusGeometry(0.52, 0.045, 6, 22), SAT, 0, 0, 0, 0, Math.PI / 2], ...[0, 1, 2, 3, 4, 5].map((k) => [new THREE.BoxGeometry(0.04, 1.0, 0.05), GO2, 0, 0, 0, k / 6 * Math.PI])]);
  const banh = [-0.85, 0.85].map((x) => { const b = nhom(goc, x, 0.55, 0); b.add(luoi(gBanh)); return b; });
  const ngua = dungNgua(scene, 0x8a6a4a);
  let quay = 0; const f = new THREE.Vector3();
  return {
    goc, ngua, ghe: { y: 1.2, z: 0.55 },
    capNhat(dt, toc) {
      quay += toc * dt / 0.55; for (const b of banh) b.rotation.x = quay;
      f.set(Math.sin(goc.rotation.y), 0, Math.cos(goc.rotation.y));
      ngua.goc.position.copy(goc.position).addScaledVector(f, 2.75); ngua.goc.rotation.y = goc.rotation.y;
      ngua.goc.visible = goc.visible; ngua.capNhat(dt, Math.abs(toc));
    },
  };
}
