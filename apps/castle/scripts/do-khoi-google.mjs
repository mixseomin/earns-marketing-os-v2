#!/usr/bin/env node
// ĐO HÌNH KHỐI TỪ ẢNH THẬT 3D (Google Photorealistic 3D Tiles qua Cesium ion, đã khớp toạ độ + độ cao với cảnh — ns.js apDungAnh3d):
// với từng khối OSM, dò tia thẳng đứng xuống mặt ảnh 3D trên lưới 0,75 m trong mặt bằng → đỉnh (phân vị 98), chân mái (trung vị các điểm sát mép),
// rồi so với khối mô hình đang dựng (sau tệp sửa theo ảnh). Ghi apps/castle/du-lieu-goc/do-khoi-google.json + in bảng lệch.
// Chạy trên MÁY CÓ TRÌNH DUYỆT (iMac), không chạy trên máy chủ:
//   node apps/castle/scripts/do-khoi-google.mjs
// Cần Playwright: PLAYWRIGHT=/đường/tới/playwright/index.mjs (mặc định bản cài trong courseforge-demo trên iMac).
// Token web Cesium chỉ nhận referrer http://127.0.0.1:18777 (và castle.on.tc) → công cụ tự mở máy chủ tĩnh ở đúng cổng đó.
// tra-repo-ok: công cụ đo nội bộ của cảnh, gọi lại hàm có sẵn trong trang (__ns.cao3d); không có thư viện tương ứng.
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = join(dirname(fileURLToPath(import.meta.url)), '..'), PUB = join(GOC, 'public');
const PW = process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const LOAI = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.css': 'text/css' };
const may = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(PUB, p); if (!f.startsWith(PUB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404).end(); return; }
  r.writeHead(200, { 'Content-Type': LOAI[extname(f)] || 'application/octet-stream', ETag: String(statSync(f).mtimeMs) }).end(readFileSync(f));
});
await new Promise((ok, loi) => may.once('error', loi).listen(18777, '127.0.0.1', ok)).catch((e) => { console.error('cổng 18777 đang bận (tắt máy chủ tĩnh khác rồi chạy lại):', e.code); process.exit(1); });

const { chromium } = await import(PW);
const b = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1400, height: 1000 } });
pg.on('pageerror', (e) => console.log('LỖI TRANG', e.message));
await pg.addInitScript(() => { try { localStorage.setItem('ns-anh3d', '1'); localStorage.setItem('ns-dau-thu', '1'); } catch {} });
await pg.goto('http://127.0.0.1:18777/neuschwanstein.html');
await pg.waitForFunction(() => window.__ns?.tt && window.__ns.anh3d()?.hien, null, { timeout: 180000 });

// nạp ô chi tiết: đưa camera toàn cảnh đi vòng trên lâu đài ở độ cao thấp, mỗi chỗ chờ tải xong
const cho = async (giay) => { let on = 0; for (let i = 0; i < giay * 2 && on < 6; i++) { await pg.waitForTimeout(500); const p = await pg.evaluate(() => window.__ns.anh3d().t.loadProgress ?? 1); on = p >= 0.999 ? on + 1 : 0; } };
for (const [x, z, y] of [[-30, 15, 110], [-60, 25, 90], [0, 5, 90], [30, 0, 90], [-40, 15, 60]]) {
  await pg.evaluate(([x, z, y]) => { const n = window.__ns; n.orbit.target.set(x, 10, z); n.camera.position.set(x + 25, y, z + 25); n.orbit.update(); }, [x, z, y]);
  await cho(25);
}
const kq = await pg.evaluate(() => {
  const n = window.__ns, a3 = n.anh3d();
  const tr = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const kcVien = (x, z, v) => { let m = 1e9; for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length], dx = x2 - x1, dz = z2 - z1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - x1 - dx * t, z - z1 - dz * t)); } return m; };
  const pv = (a, p) => { if (!a.length) return null; const s = [...a].sort((u, w) => u - w); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  // BÙ ĐỘ CAO: mặt sân trên của ảnh 3D phải trùng nền sân đo từ ảnh (MAT_SAN) — trung vị lệch trên các điểm cách mép sân > 2,5 m
  const san = n.D.khoi.find((k) => k.tags.building === 'courtyard')?.ngoai?.[0], lech = [];
  if (san && n.MAT_SAN != null) { const xs = san.map((p) => p[0]), zs = san.map((p) => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1.5) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 1.5) if (tr(x, z, san) && kcVien(x, z, san) > 2.5) { const y = n.cao3d(x, z); if (y != null) lech.push(y - n.MAT_SAN); } }
  const BU = pv(lech, 0.5) ?? 0, IQR = lech.length ? pv(lech, 0.75) - pv(lech, 0.25) : null;
  const cao = (x, z) => { const y = n.cao3d(x, z); return y == null ? null : y - BU; };
  const ds = [];
  for (const k of n.dsKhoi) {
    if (k.yTren == null || (k.vo && k.coPart)) continue;
    const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]); const tat = [], mep = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.75) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.75) {
      if (!tr(x, z, k.v)) continue; const d = kcVien(x, z, k.v); if (d < 0.35) continue;
      const y = cao(x, z); if (y == null) continue; tat.push(y); if (d < 1.2) mep.push(y);
    }
    ds.push({ id: k.id, ten: k.tags.name || '', mai: k.tags['roof:shape'] || 'flat', so: tat.length, dinhGoogle: pv(tat, 0.98), chanMaiGoogle: pv(mep, 0.5), dinhMoHinh: k.yTren, chanMaiMoHinh: k._y1 ?? null, day: k.day, osmCao: +(k.tagsGoc?.height ?? k.tags.height ?? NaN), suaCao: k.tagsGoc ? +k.tags.height : null });
  }
  return { bu: BU, buIQR: IQR, buSoDiem: lech.length, ds };
});
await b.close(); may.close();

const ra = join(GOC, 'du-lieu-goc', 'do-khoi-google.json');
writeFileSync(ra, JSON.stringify({ luc: new Date().toISOString(), ghi_chu: 'đỉnh / chân mái đo trên ảnh thật 3D Google (toạ độ cảnh, mét); mô hình = khối đang dựng sau tệp sửa theo ảnh', ...kq }, null, 1) + '\n');
console.log(`bù độ cao ảnh 3D theo nền sân trên: −${kq.bu.toFixed(2)} m (${kq.buSoDiem} điểm, độ trải giữa ${kq.buIQR?.toFixed(2)} m) · ${kq.ds.length} khối · ghi ${ra}`);
console.log('khối                          mái          điểm  đỉnh Google  đỉnh mô hình  lệch   chân mái Google  mô hình  lệch');
for (const d of kq.ds.sort((p, q) => Math.abs((q.dinhGoogle ?? 0) - q.dinhMoHinh) - Math.abs((p.dinhGoogle ?? 0) - p.dinhMoHinh))) {
  const f = (v) => (v == null ? '   —' : v.toFixed(1).padStart(6));
  console.log(`${(d.id + ' ' + d.ten).slice(0, 30).padEnd(30)} ${d.mai.padEnd(12)} ${String(d.so).padStart(5)} ${f(d.dinhGoogle)}       ${f(d.dinhMoHinh)}  ${d.dinhGoogle == null ? '   —' : (d.dinhMoHinh - d.dinhGoogle).toFixed(1).padStart(6)}   ${f(d.chanMaiGoogle)}        ${f(d.chanMaiMoHinh)} ${d.chanMaiGoogle == null || d.chanMaiMoHinh == null ? '   —' : (d.chanMaiMoHinh - d.chanMaiGoogle).toFixed(1).padStart(6)}`);
}
