// CẢNH XA TỚI CHÂN TRỜI (anh 21/11/2026 "làm theo đề xuất 2-3-1", bước 2): ảnh trực giao thật trên địa hình thật tới 10 km — dữ liệu dựng sẵn bằng scripts/tai-canh-xa.py
// (Bavaria DOP20 + DGM1, basemap.at, Copernicus GLO-30; nguồn ghi trong du-lieu/<lâu>-xa.json). Ba vòng:
//   noi  ±NUA  lưới đất EU-DEM của ns.js — chỉ thay màu đỉnh bằng ảnh trực giao
//   giua ±2100 m lưới 20 m — hoà độ cao về lưới trong ở 420 → 640 m (không thấy mép), đỉnh trong ±NUA hạ 3 m, tam giác lọt hẳn trong bỏ đi; cây vòng giữa vẽ hàng loạt
//   xa   ±10 km lưới 50 m — lỗ giữa 2050 m, đỉnh trong vòng giữa hạ 5 m
// Thiếu tệp → không dựng gì, trang chạy như cũ.
// Điện thoại (nhe; anh 21/11/2026 'vẫn phải đảm bảo tốc độ, loading và tối ưu ko bị nóng trên mobile'): chờ trang rảnh mới tải, vòng giữa lưới thưa gấp đôi (40 m), vòng xa gấp bốn (200 m, chìm trong sương),
// bỏ cây vòng giữa (ảnh trực giao đã có màu rừng), ảnh xa 2k, không lọc dị hướng → ~40 nghìn tam giác thêm, ~2,5 MB tải sau khi lâu đài đã hiện.
export async function datCanhXa({ THREE, scene, ten, luoiTrong, caoDat, NUA, GOC_Y, nhe }) {
  await new Promise((ok) => (self.requestIdleCallback ? requestIdleCallback(() => ok(), { timeout: 4000 }) : setTimeout(ok, 1500))); // không giành băng thông / CPU với lâu đài lúc mở trang
  const M = await fetch(`./du-lieu/${ten}-xa.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!M?.vong?.giua?.n) return [];
  const nap = new THREE.TextureLoader(), anh = (tep) => new Promise((ok) => nap.load(`./du-lieu/${tep}`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = nhe ? 1 : 4; ok(t); }, undefined, () => ok(null)));
  const bin = (tep) => fetch(`./du-lieu/${tep}`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const V = M.vong, [tN, tG, tX, bG, bX, bC] = await Promise.all([anh(V.noi.anh), anh(V.giua.anh), anh(nhe && M.xa_mac ? 'anh/xa/xa-2k.jpg' : V.xa.anh), bin(V.giua.cao), bin(V.xa.cao), M.cay && !nhe ? bin(M.cay.tep) : null]);
  const ra = [];
  if (tN && luoiTrong) { luoiTrong.material.map = tN; luoiTrong.material.vertexColors = false; luoiTrong.material.needsUpdate = true; } // PlaneGeometry xoay −90° quanh X: v = 1 ở bắc = hàng ảnh đầu
  // lưới vuông (n × n, bước b, nửa H) → mesh; cao(x, z, hGoc) trả độ cao cảnh; boTrong = nửa cạnh vùng bỏ tam giác (cả ba đỉnh lọt trong)
  function luoi(n, b, H, cao, boTrong, tex, buoc = 1) {
    const m = Math.floor((n - 1) / buoc) + 1, pos = new Float32Array(m * m * 3), uv = new Float32Array(m * m * 2), chi = [];
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const x = -H + i * buoc * b, z = -H + j * buoc * b, k = j * m + i;
      pos.set([x, cao(x, z, i * buoc, j * buoc), z], k * 3); uv.set([(x + H) / (2 * H), 1 - (z + H) / (2 * H)], k * 2); }
    const trong = (k) => Math.max(Math.abs(pos[k * 3]), Math.abs(pos[k * 3 + 2])) < boTrong;
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) { const a = j * m + i, b2 = a + 1, c = a + m, d = c + 1;
      if (trong(a) && trong(b2) && trong(c) && trong(d)) continue; chi.push(a, c, b2, b2, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(m * m > 65535 ? new THREE.Uint32BufferAttribute(chi, 1) : new THREE.Uint16BufferAttribute(chi, 1)); g.computeVertexNormals();
    const me = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : 0x55704a })); me.receiveShadow = false; scene.add(me); ra.push(me); return me;
  }
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // vòng giữa: độ cao tuyệt đối (dm) → cảnh; hoà về lưới trong (caoDat kéo dài mép) ở 420 → 640 m
  const G = V.giua, hG = bG && new Uint16Array(bG);
  const caoG = (x, z, i, j) => { const r = Math.max(Math.abs(x), Math.abs(z)), h = hG[j * G.n + i] / 10, w = ss(NUA, NUA + 220, r);
    return (caoDat(x, z) * (1 - w) + h * w) - GOC_Y - (r < NUA + 1 ? 3 : 0); };
  if (hG) luoi(G.n, G.buoc, G.nua, caoG, NUA - 20, tG, nhe ? 2 : 1);
  // độ cao vòng giữa nội suy (cây đứng đúng mặt lưới)
  const caoGiua = (x, z) => { const fx = (x + G.nua) / G.buoc, fz = (z + G.nua) / G.buoc, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = (a, b) => caoG(-G.nua + a * G.buoc, -G.nua + b * G.buoc, a, b);
    return (o(i, j) * (1 - u) + o(i + 1, j) * u) * (1 - v) + (o(i, j + 1) * (1 - u) + o(i + 1, j + 1) * u) * v; };
  const X = V.xa, hX = bX && new Uint16Array(bX);
  if (hX) luoi(X.n, X.buoc, X.nua, (x, z, i, j) => hX[j * X.n + i] / 10 - GOC_Y - (Math.max(Math.abs(x), Math.abs(z)) < G.nua + 1 ? 5 : 0), G.nua - 50, tX, nhe ? 4 : 1);
  if (bC && hG) { // cây vòng giữa (máy bàn): nón thấp đa giác, một lệnh vẽ
    const p = new Int16Array(bC), so = p.length / 2, buoc = nhe ? 2 : 1, tan = new THREE.ConeGeometry(3, 16, 5); tan.translate(0, 9, 0);
    const im = new THREE.InstancedMesh(tan, new THREE.MeshLambertMaterial({ color: 0x2c4429, flatShading: true }), Math.ceil(so / buoc)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    let k = 0; for (let i = 0; i < so; i += buoc) { const x = p[i * 2] / 10, z = p[i * 2 + 1] / 10, s = 0.75 + ((i * 7919) % 100) / 200;
      m4.compose(new THREE.Vector3(x, caoGiua(x, z) - 1, z), q.setFromAxisAngle(Y, i), new THREE.Vector3(s, s, s)); im.setMatrixAt(k, m4); im.setColorAt(k++, c.setHSL(0.29 + (i % 7) * 0.01, 0.3, 0.15 + (i % 11) * 0.008)); }
    im.count = k; im.computeBoundingSphere(); scene.add(im); ra.push(im);
  }
  console.info('[ns] cảnh xa:', ra.length, 'lớp ·', bC ? M.cay.so : 0, 'cây vòng giữa');
  return ra;
}
