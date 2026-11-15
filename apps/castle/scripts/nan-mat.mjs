#!/usr/bin/env node
// NẮN ẢNH VỀ MẶT TƯỜNG: với một ảnh so đã KHỚP CAMERA (khop-camera.mjs), chiếu ngược ảnh lên mặt phẳng từng bức tường của khối được chọn
// → ảnh chính diện có thước mét (8 px/m) cho từng mặt: chỗ bị khối khác che (tia từ camera trúng mô hình trước) tô xám. Đầu vào cho scripts/do-cua-so.py.
//   node apps/castle/scripts/nan-mat.mjs <thư mục ra> <chỉ số ảnh> [tên khối = Palas]
// Ghi <thư mục>/mat-<ảnh>-<k>.png + mat.json (mỗi mặt: khối, cạnh, x1 z1 x2 z2, y0 y1, px/m, tỉ lệ thấy được).
// tra-repo-ok: công cụ nội bộ (chiếu camera three.js), không có thư viện tương ứng cho dữ liệu riêng của cảnh.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { GOC, PUB, LAU, du, doiSo, moTrang } from './chung.mjs';
import { join } from 'node:path';
const [RA, IS, TEN = '*'] = doiSo; const I = +IS; if (!RA || !Number.isInteger(I)) { console.error('dùng: nan-mat.mjs <thư mục> <chỉ số ảnh> [tên khối]'); process.exit(1); }
mkdirSync(RA, { recursive: true });
const { pg, dong } = await moTrang({ anh3d: false, khung: { width: 1600, height: 1200 } });
const kq = await pg.evaluate(async ([I, TEN, PXM]) => {
  const n = window.__ns, T = n.THREE, A = n.ANH[I]; n.moSo(I); n.renderer.render(n.scene, n.camera);
  const im = new Image(); im.src = `./du-lieu/${A.tep}`; await im.decode();
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const D = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
  const PX = PXM, cam = n.camera.position.clone(), rc = new T.Raycaster(), moHinh = n.LOP_OSM.filter((o) => o.visible !== false), ra = [];
  const kq = [];
  for (const t of n.TUONG_MT) {
    if (TEN === '*' ? !t.k : t.ten !== TEN) continue; // '*' = mọi khối
    for (let i = 0; i < t.v.length; i++) {
      const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 4) continue;
      const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      if (nx * (cam.x - mx) + nz * (cam.z - mz) <= 0) continue; // mặt quay lưng camera
      const y0 = t.yMong, y1 = t.y1, w = Math.round(L * PX), h = Math.round((y1 - y0) * PX); if (h < 8) continue;
      // che khuất: lưới 1 m, tia camera → điểm trên tường (lùi 0,3 m ra ngoài), trúng mô hình trước thì bị che
      const che = new Map(), P = new T.Vector3();
      for (let s = 0.5; s < L; s += 1) for (let y = y0 + 0.5; y < y1; y += 1) {
        P.set(x1 + ux * s + nx * 0.3, y, z1 + uz * s + nz * 0.3); const d = P.clone().sub(cam), kc = d.length(); rc.set(cam, d.normalize()); rc.far = kc - 0.2;
        che.set(`${Math.floor(s)},${Math.floor(y - y0)}`, rc.intersectObjects(moHinh, true).length > 0);
      }
      const o = document.createElement('canvas'); o.width = w; o.height = h; const og = o.getContext('2d'), od = og.createImageData(w, h); let thay = 0;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const s = (px + 0.5) / PX, y = y1 - (py + 0.5) / PX, j = (py * w + px) * 4;
        if (che.get(`${Math.floor(s)},${Math.floor(y - y0)}`)) { od.data[j] = od.data[j + 1] = od.data[j + 2] = 128; od.data[j + 3] = 255; continue; }
        P.set(x1 + ux * s, y, z1 + uz * s).project(n.camera); const qx = Math.round((P.x + 1) / 2 * W), qy = Math.round((1 - P.y) / 2 * H);
        if (qx < 0 || qy < 0 || qx >= W || qy >= H || P.z > 1) { od.data[j + 3] = 0; continue; }
        const k = (qy * W + qx) * 4; od.data[j] = D[k]; od.data[j + 1] = D[k + 1]; od.data[j + 2] = D[k + 2]; od.data[j + 3] = 255; thay++;
      }
      og.putImageData(od, 0, 0);
      kq.push({ khoi: t.k?.id, canh: i, x1, z1, x2, z2, y0, y1, L, px: PX, thay: thay / (w * h), anh: o.toDataURL('image/png') });
    }
  }
  return kq;
}, [I, TEN, +(process.env.PX || 8)]); // PX=… điểm ảnh / mét
await dong();
const meta = kq.map((m, k) => { const tep = join(RA, `mat-${I}-${k}.png`); writeFileSync(tep, Buffer.from(m.anh.split(',')[1], 'base64')); const { anh, ...r } = m; return { ...r, tep }; });
writeFileSync(join(RA, `mat-${I}.json`), JSON.stringify(meta, null, 1));
for (const m of meta) console.log(`${m.khoi} cạnh ${m.canh}: ${m.L.toFixed(1)} × ${(m.y1 - m.y0).toFixed(1)} m · thấy ${(m.thay * 100).toFixed(0)}% → ${m.tep}`);
