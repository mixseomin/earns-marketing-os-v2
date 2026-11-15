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
await pg.goto('http://127.0.0.1:18777/neuschwanstein.html?goc=osm'); // ?goc=osm: trang dựng khối THUẦN OSM (chân = đất thấp nhất, không chỉnh theo số đo cũ) để so cặp từng điểm
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
  // ĐỘ CAO TUYỆT ĐỐI: ReorientationPlugin đặt ô theo độ cao thật (GOC_Y + geoid) → lấy số THÔ, trừ phần trang đã tự dịch nhóm ô (goc.position.y) khi bù lúc chạy.
  // Kiểm chéo: lối vào lâu đài 965 m so mặt biển (Klett), sân trên phải cao hơn lối vào. Ghi thêm độ lệch sân trên so với nền sân đang dựng để theo dõi.
  const DICH = a3.goc.position.y || 0,  cao = (x, z) => { const y = n.cao3d(x, z); return y == null ? null : y - DICH; };
  const san = n.D.khoi.find((k) => k.tags.building === 'courtyard')?.ngoai?.[0], mSan = [];
  if (san) { const xs = san.map((p) => p[0]), zs = san.map((p) => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1.5) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 1.5) if (tr(x, z, san) && kcVien(x, z, san) > 2.5) { const y = cao(x, z); if (y != null) mSan.push(y); } }
  const SAN = pv(mSan, 0.5), IQR = mSan.length ? pv(mSan, 0.75) - pv(mSan, 0.25) : null;
  // MẶT ĐẤT THẬT quanh lâu đài: lưới 1,5 m trong hộp bao các khối lâu đài (+10 m), bỏ điểm trong mặt bằng nhà (+0,6 m) → nền đá / sân / lối đi
  const lauDai = n.dsKhoi.filter((k) => { const c = k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0]); return Math.hypot(c[0], c[1]) < 100; });
  const bx = lauDai.flatMap((k) => k.v.map((p) => p[0])), bz = lauDai.flatMap((k) => k.v.map((p) => p[1]));
  const hop = [Math.min(...bx) - 10, Math.max(...bx) + 10, Math.min(...bz) - 10, Math.max(...bz) + 10], BUOC = 1.5, nen = [];
  for (let x = hop[0]; x <= hop[1]; x += BUOC) for (let z = hop[2]; z <= hop[3]; z += BUOC) {
    if (lauDai.some((k) => tr(x, z, k.v) || kcVien(x, z, k.v) < 0.6)) continue;
    const y = cao(x, z); if (y != null) nen.push([+x.toFixed(2), +z.toFixed(2), +y.toFixed(2)]);
  }
  const ds = [];
  for (const k of n.dsKhoi) {
    if (k.yTren == null || (k.vo && k.coPart)) continue;
    const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]); const tat = [], mep = [], lech = [];
    // mặt trên của CHÍNH khối mô hình tại (x, z): tia thẳng đứng cắt các tam giác k.hinh (tường + mái), lấy chỗ cao nhất
    const tg = [...(k.hinh?.[0] || []), ...(k.hinh?.[1] || [])], mhY = (x, z) => { let y = null;
      for (let i = 0; i + 8 < tg.length; i += 9) { const ax = tg[i], ay = tg[i + 1], az = tg[i + 2], bx = tg[i + 3], by = tg[i + 4], bz = tg[i + 5], cx = tg[i + 6], cy = tg[i + 7], cz = tg[i + 8];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-6) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v; if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
        const yy = u * ay + v * by + w * cy; if (y == null || yy > y) y = yy; } return y; };
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.75) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.75) {
      if (!tr(x, z, k.v)) continue; const d = kcVien(x, z, k.v); if (d < 0.35) continue;
      const y = cao(x, z); if (y == null) continue; tat.push(y); if (d < 1.2) mep.push(y);
      if (d > 0.5) { const m = mhY(x, z); if (m != null) lech.push(y - m); }
    }
    ds.push({ id: k.id, ten: k.tags.name || '', mai: k.tags['roof:shape'] || 'flat', so: tat.length, lech: pv(lech, 0.5), soLech: lech.length, lechIQR: lech.length ? pv(lech, 0.75) - pv(lech, 0.25) : null, dinhGoogle: pv(tat, 0.98), chanMaiGoogle: pv(mep, 0.5), dinhMoHinh: k.yTren, chanMaiMoHinh: k._y1 ?? null, day: k.day, osmCao: +(k.tagsGoc?.height ?? k.tags.height ?? NaN), suaCao: k.tagsGoc ? +k.tags.height : null });
  }
  return { dich: DICH, san: SAN, sanIQR: IQR, sanSoDiem: mSan.length, matSanDangDung: n.MAT_SAN, goc: n.GOC_Y, hop, buoc: BUOC, nen, ds };
});
await b.close(); may.close();

const { nen, hop, buoc, ...bang } = kq;
const ra = join(GOC, 'du-lieu-goc', 'do-khoi-google.json');
writeFileSync(ra, JSON.stringify({ luc: new Date().toISOString(), ghi_chu: 'đỉnh / chân mái đo trên ảnh thật 3D Google — độ cao TUYỆT ĐỐI theo toạ độ cảnh (0 = GOC_Y so mặt biển); mô hình = khối đang dựng', ...bang }, null, 1) + '\n');
const raNen = join(PUB, 'du-lieu', 'neuschwanstein-nen.json');
const khoi = Object.fromEntries(kq.ds.filter((d) => d.lech != null).map((d) => [d.id, [+d.lech.toFixed(2), d.soLech, +d.dinhGoogle.toFixed(2), +d.lechIQR.toFixed(2)]]));
writeFileSync(raNen, JSON.stringify({ ghi_chu: 'ĐO TRÊN ẢNH 3D GOOGLE (scripts/do-khoi-google.mjs), toạ độ cảnh, y so GOC_Y: diem = mặt đất ngoài mặt bằng nhà [x, z, y]; san = trung vị mặt sân trên; khoi = { id: [lệch (trung vị từng điểm: mặt Google − mặt khối thuần OSM chân đất thấp nhất), số điểm, đỉnh phân vị 98, độ trải giữa của lệch] }. ns.js dùng làm mốc chân nhà + mặt đất quanh lâu đài', luc: new Date().toISOString(), goc: kq.goc, san: +kq.san.toFixed(2), hop, buoc, khoi, diem: nen }) + '\n');
console.log(`sân trên Google: ${kq.san?.toFixed(2)} m (= ${(kq.goc + kq.san).toFixed(1)} m so mặt biển; ${kq.sanSoDiem} điểm, độ trải giữa ${kq.sanIQR?.toFixed(2)} m) · nền sân đang dựng ${kq.matSanDangDung?.toFixed?.(2)} m · trang đã dịch ô ${kq.dich.toFixed(2)} m`);
console.log(`mặt đất: ${nen.length} điểm lưới ${buoc} m → ${raNen} · ${kq.ds.length} khối → ${ra}`);
console.log('khối                          mái          điểm  đỉnh Google  đỉnh mô hình  lệch   chân mái Google  mô hình  lệch');
for (const d of kq.ds.sort((p, q) => Math.abs((q.dinhGoogle ?? 0) - q.dinhMoHinh) - Math.abs((p.dinhGoogle ?? 0) - p.dinhMoHinh))) {
  const f = (v) => (v == null ? '   —' : v.toFixed(1).padStart(6));
  console.log(`${(d.id + ' ' + d.ten).slice(0, 30).padEnd(30)} ${d.mai.padEnd(12)} ${String(d.so).padStart(5)} ${f(d.dinhGoogle)}       ${f(d.dinhMoHinh)}  ${d.dinhGoogle == null ? '   —' : (d.dinhMoHinh - d.dinhGoogle).toFixed(1).padStart(6)}   ${f(d.chanMaiGoogle)}        ${f(d.chanMaiMoHinh)} ${d.chanMaiGoogle == null || d.chanMaiMoHinh == null ? '   —' : (d.chanMaiMoHinh - d.chanMaiGoogle).toFixed(1).padStart(6)}`);
}
