#!/usr/bin/env node
// ẢNH CHÍNH DIỆN MỌI MẶT TƯỜNG từ ẢNH THẬT 3D GOOGLE (đủ 4 phía, không cần ảnh chụp từng mặt): với mỗi cạnh tường của khối chọn,
// camera TRỰC GIAO đặt ngoài tường nhìn thẳng vào, khung đúng bề ngang cạnh × (chân tường → đỉnh mái), 8 px/m, chỉ vẽ lớp ảnh 3D.
// Cùng khuôn ra với nan-mat.mjs (mat-<nhãn>-<k>.png + mat-<nhãn>.json) → scripts/do-cua-so.py dò ô cửa.
//   node apps/castle/scripts/nan-google.mjs <thư mục ra> [tên khối = Palas] [--ca: cả khối không tên nằm trong vỏ]
// tra-repo-ok: công cụ nội bộ của cảnh (three.js OrthographicCamera + 3d-tiles-renderer đã nạp trong trang).
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const GOC = join(dirname(fileURLToPath(import.meta.url)), '..'), PUB = join(GOC, 'public');
const [RA, TEN = 'Palas'] = process.argv.slice(2).filter((a) => !a.startsWith('--')); if (!RA) { console.error('dùng: nan-google.mjs <thư mục> [tên khối]'); process.exit(1); }
mkdirSync(RA, { recursive: true });
const PW = process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const LOAI = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream' };
const may = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); const f = join(PUB, p); if (!f.startsWith(PUB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': LOAI[extname(f)] || 'application/octet-stream' }).end(readFileSync(f)); });
await new Promise((ok, loi) => may.once('error', loi).listen(18777, '127.0.0.1', ok)).catch((e) => { console.error('cổng 18777 đang bận:', e.code); process.exit(1); });
const { chromium } = await import(PW);
const b = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] }); const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
pg.on('pageerror', (e) => console.log('LỖI TRANG', e.message));
await pg.addInitScript(() => { try { localStorage.setItem('ns-anh3d', '1'); localStorage.setItem('ns-dau-thu', '1'); } catch {} });
await pg.goto('http://127.0.0.1:18777/neuschwanstein.html'); await pg.waitForFunction(() => window.__ns?.tt && window.__ns.anh3d(), null, { timeout: 180000 });
const ds = await pg.evaluate((TEN) => window.__ns.TUONG_MT.map((t, j) => ({ j, ten: t.ten, khoi: t.k?.id, n: t.v.length })).filter((t) => t.ten === TEN), TEN);
const meta = [];
for (const t of ds) for (let i = 0; i < t.n; i++) {
  const m = await pg.evaluate(async ([j, i]) => {
    const n = window.__ns, T = n.THREE, a3 = n.anh3d(), t = n.TUONG_MT[j], [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 3) return null;
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    if (t.k && n.dsKhoi.some((q) => q !== t.k && q.yTren > t.yMong + 3 && (() => { const v = q.v, x = mx + nx * 1.5, z = mz + nz * 1.5; let c = false; for (let a = 0, b = v.length - 1; a < v.length; b = a++) { const [xa, za] = v[a], [xb, zb] = v[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; })())) return { L, bo: 'khối khác áp vào' };
    const y0 = t.yMong, y1 = (t.y2 ?? t.y1) + 1, PX = 8, w = Math.round(L * PX), h = Math.round((y1 - y0) * PX);
    const cam = new T.OrthographicCamera(-L / 2, L / 2, (y1 - y0) / 2, -(y1 - y0) / 2, 0.5, 80);
    cam.position.set(mx + nx * 40, (y0 + y1) / 2, mz + nz * 40); cam.lookAt(mx, (y0 + y1) / 2, mz); cam.near = 40 - 14; cam.far = 40 + 4; cam.updateProjectionMatrix(); // lớp dày 18 m quanh mặt tường (OSM lệch ảnh 3D vài mét theo chiều sâu ở vài mặt)
    const r = n.renderer, cu = r.getSize(new T.Vector2()), anTam = []; for (const o of n.scene.children) if (o !== a3.goc && !o.isLight && o.visible) { o.visible = false; anTam.push(o); }
    const suong = n.scene.fog; n.scene.fog = null; a3.goc.visible = true; r.setSize(w, h, false); a3.t.setCamera(cam); a3.t.setResolution(cam, w * 2, h * 2);
    for (let k = 0, on = 0; k < 200 && (k < 20 || on < 6); k++) { a3.t.update(); r.render(n.scene, cam); await new Promise((ok) => setTimeout(ok, 100)); on = (a3.t.loadProgress ?? 1) >= 0.999 ? on + 1 : 0; } // tối thiểu 20 vòng: lượt đầu hàng đợi ô còn trống nên loadProgress báo xong giả
    a3.t.update(); r.render(n.scene, cam); const anh = r.domElement.toDataURL('image/png');
    n.scene.fog = suong; for (const o of anTam) o.visible = true; r.setSize(cu.x, cu.y, false); a3.t.deleteCamera?.(cam); a3.t.setCamera(n.camera);
    return { khoi: t.k?.id, canh: i, x1, z1, x2, z2, y0, y1, L, px: PX, thay: 1, anh };
  }, [t.j, i]);
  if (!m) continue; if (m.bo) { console.log(`${t.khoi} cạnh ${i}: bỏ (${m.bo})`); continue; }
  const tep = join(RA, `mat-g-${meta.length}.png`); writeFileSync(tep, Buffer.from(m.anh.split(',')[1], 'base64')); const { anh, ...r } = m; meta.push({ ...r, tep });
  console.log(`${m.khoi} cạnh ${i}: ${m.L.toFixed(1)} m → ${tep}`);
}
writeFileSync(join(RA, 'mat-g.json'), JSON.stringify(meta, null, 1));
await b.close(); may.close();
