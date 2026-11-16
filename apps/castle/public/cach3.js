// CÁCH 3 — LÂU ĐÀI DỰNG TỪ BẢN ĐỒ ĐỘ CAO THẬT (du-lieu/<lâu>-cach3.json, scripts/khop-khoi.mjs chụp lưới ảnh 3D từ trên xuống):
// mỗi ô B m có độ cao thật → MẶT TRÊN (góc ô = trung bình các ô kề cùng mặt, lệch ≤ BAC m → mái dốc / sống mái mượt, đổi bậc thì sắc cạnh)
// + TƯỜNG ĐỨNG ở mọi cạnh ô mà ô bên cạnh thấp hơn > BAC m hoặc không có (xuống tới mặt đất thật datThat). Màu theo vật liệu: mặt trên theo
// loại ô (gạch đỏ / đá sáng / mái tối), tường theo màu khối OSM gần nhất (building:colour). Không dán ảnh. Lớp xem để so với cách dựng cũ (nút 🧩).
// datCach3({ THREE, du, datThat, mauTuong: (x, z) => THREE.Color }) → THREE.Group
// tra-repo-ok: dựng lưới 2,5D từ bản đồ độ cao (DSM → khối, cách LOD1.5 của CityGML), mã nhỏ riêng cảnh.
export function datCach3({ THREE, du, datThat, mauTuong }) {
  const { x0, z0, B, W, H } = du, BAC = 1.2, CAO_TOI_THIEU = 2.0, g = new THREE.Group();
  // lọc trung vị 3 × 3 (bỏ gai ảnh 3D), giữ ô trống là trống
  const Y = new Float32Array(W * H).fill(NaN);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const v = du.y[j * W + i]; if (v == null) continue; const a = [];
    for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const ii = i + c, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const q = du.y[jj * W + ii]; if (q != null && Math.abs(q - v) < BAC * 2) a.push(q); }
    a.sort((p, q) => p - q); const m = a[a.length >> 1]; if (m - datThat(x0 + (i + 0.5) * B, z0 + (j + 0.5) * B) < CAO_TOI_THIEU) continue; Y[j * W + i] = m; } // sát đất (< 2 m): sân / đường / bậc, không phải nhà
  const co = (i, j) => i >= 0 && j >= 0 && i < W && j < H && !Number.isNaN(Y[j * W + i]), yo = (i, j) => Y[j * W + i];
  // độ cao góc (gi, gj) nhìn từ ô (i, j): trung bình các ô quanh góc cùng mặt với ô đó
  const goc = (i, j, gi, gj) => { const v = yo(i, j); let t = 0, n = 0; for (const [a, b] of [[gi - 1, gj - 1], [gi, gj - 1], [gi - 1, gj], [gi, gj]]) if (co(a, b) && Math.abs(yo(a, b) - v) <= BAC) { t += yo(a, b); n++; } return n ? t / n : v; };
  const MAU = { 1: new THREE.Color('#a9573f'), 2: new THREE.Color('#3f4855'), 0: new THREE.Color('#dcd5c4'), phang: new THREE.Color('#9d998f') };
  const p = [], c = [], dat = (x, z) => datThat(x, z);
  const tg = (A, Bq, C, m) => { p.push(...A, ...Bq, ...C); for (let k = 0; k < 3; k++) c.push(m.r, m.g, m.b); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!co(i, j)) continue;
    const xa = x0 + i * B, xb = xa + B, za = z0 + j * B, zb = za + B;
    const h00 = goc(i, j, i, j), h10 = goc(i, j, i + 1, j), h11 = goc(i, j, i + 1, j + 1), h01 = goc(i, j, i, j + 1);
    const doc = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00), Math.abs(h11 - h10), Math.abs(h11 - h01)) / B, l = du.loai[j * W + i];
    const m = l === 2 && doc < 0.25 ? MAU.phang : MAU[l]; // mái tối mà phẳng: nóc tháp / sàn đá
    // mặt trên (ngửa lên: thứ tự theo chiều kim nhìn từ trên với trục z hướng nam)
    tg([xa, h00, za], [xa, h01, zb], [xb, h11, zb], m); tg([xa, h00, za], [xb, h11, zb], [xb, h10, za], m);
    // tường: 4 cạnh, ô kề trống hoặc thấp hơn > BAC
    for (const [di, dj, A, Bq, hA, hB] of [[0, -1, [xb, za], [xa, za], h10, h00], [1, 0, [xb, zb], [xb, za], h11, h10], [0, 1, [xa, zb], [xb, zb], h01, h11], [-1, 0, [xa, za], [xa, zb], h00, h01]]) {
      const ii = i + di, jj = j + dj; let lA, lB;
      const gc = (P) => [Math.round((P[0] - x0) / B), Math.round((P[1] - z0) / B)]; // chỉ số góc lưới của một điểm cạnh
      if (co(ii, jj)) { if (yo(i, j) - yo(ii, jj) <= BAC) continue; lA = goc(ii, jj, ...gc(A)); lB = goc(ii, jj, ...gc(Bq)); }
      else { lA = dat(...A) - 0.5; lB = dat(...Bq) - 0.5; }
      if (hA - lA < 0.05 && hB - lB < 0.05) continue;
      const mt = mauTuong((A[0] + Bq[0]) / 2, (A[1] + Bq[1]) / 2);
      tg([A[0], hA, A[1]], [A[0], lA, A[1]], [Bq[0], lB, Bq[1]], mt); tg([A[0], hA, A[1]], [Bq[0], lB, Bq[1]], [Bq[0], hB, Bq[1]], mt);
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide, flatShading: true }));
  mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); g.userData.tamGiac = p.length / 9; return g;
}
