#!/usr/bin/env node
// ẢNH CHÍNH DIỆN MỌI MẶT TƯỜNG từ ẢNH THẬT 3D GOOGLE (đủ 4 phía, không cần ảnh chụp từng mặt): với mỗi cạnh tường của khối chọn,
// camera TRỰC GIAO đặt ngoài tường nhìn thẳng vào, khung đúng bề ngang cạnh × (chân tường → đỉnh mái), 8 px/m, chỉ vẽ lớp ảnh 3D.
// Cùng khuôn ra với nan-mat.mjs (mat-<nhãn>-<k>.png + mat-<nhãn>.json) → scripts/do-cua-so.py dò ô cửa.
//   node apps/castle/scripts/nan-google.mjs <thư mục ra> [tên khối = Palas | * | way/1,way/2] [--ca: cả khối không tên nằm trong vỏ]
// tra-repo-ok: công cụ nội bộ của cảnh (three.js OrthographicCamera + 3d-tiles-renderer đã nạp trong trang).
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { GOC, PUB, LAU, du, doiSo, moTrang } from './chung.mjs';
import { join } from 'node:path';
const [RA, TEN = '*'] = doiSo.filter((a) => !a.startsWith('--')); if (!RA) { console.error('dùng: nan-google.mjs <thư mục> [tên khối]'); process.exit(1); }
mkdirSync(RA, { recursive: true });
const { pg, dong } = await moTrang({ anh3d: true, khung: { width: 1200, height: 900 } });
const ds = await pg.evaluate((TEN) => window.__ns.TUONG_MT.map((t, j) => ({ j, ten: t.ten, khoi: t.k?.id, n: t.v.length })).filter((t) => (TEN === '*' ? !!t.khoi : TEN.startsWith('way/') ? TEN.split(',').includes(t.khoi) : t.ten === TEN)), TEN); // '*' = mọi khối lâu đài (mọi mặt tường); 'way/…,way/…' = đúng các khối đó
const meta = [];
for (const t of ds) for (let i = 0; i < t.n; i++) {
  const m = await pg.evaluate(async ([j, i, PXM]) => {
    const n = window.__ns, T = n.THREE, a3 = n.anh3d(), t = n.TUONG_MT[j], [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 3) return null;
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    if (t.k && n.dsKhoi.some((q) => q !== t.k && q.yTren > t.yMong + 3 && (() => { const v = q.v, x = mx + nx * 1.5, z = mz + nz * 1.5; let c = false; for (let a = 0, b = v.length - 1; a < v.length; b = a++) { const [xa, za] = v[a], [xb, zb] = v[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; })())) return { L, bo: 'khối khác áp vào' };
    const y0 = t.yMong, y1 = (t.y2 ?? t.y1) + 1, PX = PXM, w = Math.round(L * PX), h = Math.round((y1 - y0) * PX);
    const cam = new T.OrthographicCamera(-L / 2, L / 2, (y1 - y0) / 2, -(y1 - y0) / 2, 0.5, 80);
    cam.position.set(mx + nx * 40, (y0 + y1) / 2, mz + nz * 40); cam.lookAt(mx, (y0 + y1) / 2, mz); cam.near = 40 - 14; cam.far = 40 + 4; cam.updateProjectionMatrix(); // lớp dày 18 m quanh mặt tường (OSM lệch ảnh 3D vài mét theo chiều sâu ở vài mặt)
    const r = n.renderer, cu = r.getSize(new T.Vector2()), anTam = []; for (const o of n.scene.children) if (o !== a3.goc && !o.isLight && o.visible) { o.visible = false; anTam.push(o); }
    // tắt sương bằng đẩy xa (đặt null làm vòng vẽ của trang lỗi mỗi khung); nền hồng tím (khung vẽ của trang không có kênh alpha) → bước sau tách thành trong suốt
    const suong = n.scene.fog, sg = [suong.near, suong.far], nen = n.scene.background, mau = r.getClearColor(new T.Color()), aMau = r.getClearAlpha(); suong.near = suong.far = 1e7;
    n.scene.background = null; r.setClearColor(0xff00ff, 1); a3.goc.visible = true; r.setSize(w, h, false);
    a3.t.setCamera(cam); a3.t.setResolution(cam, w * 2, h * 2);
    for (let k = 0, on = 0; k < 200 && (k < 20 || on < 6); k++) { a3.t.update(); r.render(n.scene, cam); await new Promise((ok) => setTimeout(ok, 100)); on = (a3.t.loadProgress ?? 1) >= 0.999 ? on + 1 : 0; } // tối thiểu 20 vòng: lượt đầu hàng đợi ô còn trống nên loadProgress báo xong giả
    a3.t.update(); r.render(n.scene, cam); const anh = r.domElement.toDataURL('image/png');
    [suong.near, suong.far] = sg; n.scene.background = nen; r.setClearColor(mau, aMau); for (const o of anTam) o.visible = true; r.setSize(cu.x, cu.y, false); a3.t.deleteCamera?.(cam); a3.t.setCamera(n.camera);
    return { khoi: t.k?.id, canh: i, x1, z1, x2, z2, y0, y1, L, px: PX, thay: 1, anh };
  }, [t.j, i, +(process.env.PX || 8)]); // PX=… (điểm ảnh / mét) — 8 cho dò cửa, 16 cho ảnh dán mặt tường
  if (!m) continue; if (m.bo) { console.log(`${t.khoi} cạnh ${i}: bỏ (${m.bo})`); continue; }
  const tep = join(RA, `mat-g-${meta.length}.png`); writeFileSync(tep, Buffer.from(m.anh.split(',')[1], 'base64')); const { anh, ...r } = m; meta.push({ ...r, tep });
  console.log(`[${meta.length}] ${m.khoi} cạnh ${i}: ${m.L.toFixed(1)} m`);
}
writeFileSync(join(RA, 'mat-g.json'), JSON.stringify(meta, null, 1));
await dong();
