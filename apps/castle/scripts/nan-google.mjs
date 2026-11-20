#!/usr/bin/env node
// ẢNH CHÍNH DIỆN MỌI MẶT TƯỜNG từ ẢNH THẬT 3D GOOGLE (đủ 4 phía, không cần ảnh chụp từng mặt): với mỗi cạnh tường của khối chọn,
// camera TRỰC GIAO đặt ngoài tường nhìn thẳng vào, khung đúng bề ngang cạnh × (chân tường → đỉnh mái), 8 px/m, chỉ vẽ lớp ảnh 3D.
// Cùng khuôn ra với nan-mat.mjs (mat-<nhãn>-<k>.png + mat-<nhãn>.json) → scripts/do-cua-so.py dò ô cửa.
//   node apps/castle/scripts/nan-google.mjs <thư mục ra> [tên khối = Palas | * | way/1,way/2] [--ca: cả khối không tên nằm trong vỏ]
//   node apps/castle/scripts/nan-google.mjs <thư mục ra> --mat x1,z1,x2,z2,y0,y1[;…]   mặt đứng TỰ CHỌN (đoạn thẳng + khoảng cao, toạ độ cảnh): mặt ghép nhiều khối / phần dưới
//     chân khối OSM (cổng vòm, chân đá thô dưới mốc sân) mà chụp theo cạnh khối không thấy; nhìn từ phía pháp tuyến (uz, −ux) như cạnh khối; khoá "mat#<k>"
//   --thap: thay tên khối — mọi mặt của các khối THÁP đứng trên đất (đo chân xoè, scripts/so-mat.py)
//   --mo-hinh: chụp thêm MÔ HÌNH ở đúng camera đó (mat-m-<k>.png, nền hồng tím như ảnh Google) → so từng mặt cùng thước mét (scripts/so-mat.py)
// tra-repo-ok: công cụ nội bộ của cảnh (three.js OrthographicCamera + 3d-tiles-renderer đã nạp trong trang).
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { GOC, PUB, LAU, du, doiSo, moTrang } from './chung.mjs';
import { join } from 'node:path';
const MH = doiSo.includes('--mo-hinh'), THAP = doiSo.includes('--thap'), kMat = doiSo.indexOf('--mat'), MAT = kMat < 0 ? null : doiSo[kMat + 1].split(';').map((m) => m.split(',').map(Number));
const [RA, TEN = '*'] = doiSo.filter((a, k) => !a.startsWith('--') && (kMat < 0 || k !== kMat + 1)); if (!RA) { console.error('dùng: nan-google.mjs <thư mục> [tên khối]'); process.exit(1); }
mkdirSync(RA, { recursive: true });
const { pg, dong } = await moTrang({ anh3d: true, khung: { width: 1200, height: 900 } });
const ds = MAT ? MAT.map((m, j) => ({ j: -1 - j, khoi: 'mat#' + j, n: 1, m })) : await pg.evaluate(([TEN, THAP]) => window.__ns.TUONG_MT.map((t, j) => ({ j, ten: t.ten, khoi: t.k?.id, n: t.v.length, laThap: !!t.k && (() => { // --thap: khối THÁP đứng trên đất (mặt bằng ≤ 150 m², cao ≥ 12 m, chân sát đất) — đo chân xoè
    const v = t.v; let a = 0; for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a) / 2 <= 150 && t.k.yTren - t.yMong >= 12 && t.k.yDuoi <= (t.k.datCao ?? t.yMong) + 2; })() }))
  .filter((t) => (THAP ? t.laThap : TEN === '*' ? !!t.khoi : TEN.startsWith('way/') ? TEN.split(',').includes(t.khoi) : t.ten === TEN)), [TEN, THAP]); // '*' = mọi khối lâu đài (mọi mặt tường); 'way/…,way/…' = đúng các khối đó
const meta = [];
for (const t of ds) for (let i = 0; i < t.n; i++) {
  const m = await pg.evaluate(async ([j, i, PXM, MM, MH, THAP]) => {
    const n = window.__ns, T = n.THREE, a3 = n.anh3d(), t = MM ? { v: [[MM[0], MM[1]], [MM[2], MM[3]]], yMong: MM[4], y1: MM[5] - 1, k: { id: 'mat#' + (-1 - j) } } : n.TUONG_MT[j];
    let [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 3) return null;
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux; let mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, sau = 4;
    if (!MM && t.k && n.dsKhoi.some((q) => q !== t.k && q.yTren > t.yMong + 3 && (() => { const v = q.v, x = mx + nx * 1.5, z = mz + nz * 1.5; let c = false; for (let a = 0, b = v.length - 1; a < v.length; b = a++) { const [xa, za] = v[a], [xb, zb] = v[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; })())) return { L, bo: 'khối khác áp vào' };
    let y0 = t.yMong; const y1 = (t.y2 ?? t.y1) + 1, PX = PXM;
    if (THAP) { // --thap: khung = CẢ bóng tháp nhìn theo pháp tuyến cạnh này + 5 m hai bên (mép tháp phải nằm trong ảnh mới đo được chân xoè), lớp sâu phủ hết thân tháp, đáy ảnh 2 m dưới chân
      const pu = t.v.map(([x, z]) => (x - mx) * ux + (z - mz) * uz), pd = t.v.map(([x, z]) => (x - mx) * nx + (z - mz) * nz), lo = Math.min(...pu) - 5, hi = Math.max(...pu) + 5, c = (lo + hi) / 2;
      mx += ux * c; mz += uz * c; L = hi - lo; sau = 2 - Math.min(...pd); x1 = mx - ux * L / 2; z1 = mz - uz * L / 2; x2 = mx + ux * L / 2; z2 = mz + uz * L / 2; y0 = Math.min(y0, t.k.datCao ?? y0) - 2; }
    const w = Math.round(L * PX), h = Math.round((y1 - y0) * PX);
    const cam = new T.OrthographicCamera(-L / 2, L / 2, (y1 - y0) / 2, -(y1 - y0) / 2, 0.5, 80);
    cam.position.set(mx + nx * 40, (y0 + y1) / 2, mz + nz * 40); cam.lookAt(mx, (y0 + y1) / 2, mz); cam.near = 40 - 14; cam.far = 40 + sau; cam.updateProjectionMatrix(); // lớp dày 18 m quanh mặt tường (OSM lệch ảnh 3D vài mét theo chiều sâu ở vài mặt)
    const r = n.renderer, cu = r.getSize(new T.Vector2()), anTam = []; for (const o of n.scene.children) if (o !== a3.goc && !o.isLight && o.visible) { o.visible = false; anTam.push(o); }
    // tắt sương bằng đẩy xa (đặt null làm vòng vẽ của trang lỗi mỗi khung); nền hồng tím (khung vẽ của trang không có kênh alpha) → bước sau tách thành trong suốt
    const suong = n.scene.fog, sg = [suong.near, suong.far], nen = n.scene.background, mau = r.getClearColor(new T.Color()), aMau = r.getClearAlpha(); suong.near = suong.far = 1e7;
    n.scene.background = null; r.setClearColor(0xff00ff, 1); a3.goc.visible = true; r.setSize(w, h, false);
    a3.t.setCamera(cam); a3.t.setResolution(cam, w * 2, h * 2);
    for (let k = 0, on = 0; k < 200 && (k < 20 || on < 6); k++) { a3.t.update(); r.render(n.scene, cam); await new Promise((ok) => setTimeout(ok, 100)); on = (a3.t.loadProgress ?? 1) >= 0.999 ? on + 1 : 0; } // tối thiểu 20 vòng: lượt đầu hàng đợi ô còn trống nên loadProgress báo xong giả
    a3.t.update(); r.render(n.scene, cam); const anh = r.domElement.toDataURL('image/png'); let anhMH = null;
    if (MH) { // lớp mô hình (LOP_OSM) bị apDungAnh3d ẩn khi đang hiện ảnh 3D → bật tạm đúng lúc chụp rồi trả lại
      const osm = n.LOP_OSM.filter((o) => !o.visible); a3.goc.visible = false; for (const o of [...anTam, ...osm]) o.visible = true; r.render(n.scene, cam); anhMH = r.domElement.toDataURL('image/png');
      for (const o of [...anTam, ...osm]) o.visible = false; a3.goc.visible = true; }
    [suong.near, suong.far] = sg; n.scene.background = nen; r.setClearColor(mau, aMau); for (const o of anTam) o.visible = true; r.setSize(cu.x, cu.y, false); a3.t.deleteCamera?.(cam); a3.t.setCamera(n.camera);
    // KHỐI TRONG KHUNG: mỗi khối có phần nằm trong lớp chụp (sâu −4 → +14 m trước mặt) — s0/s1 = mét từ MÉP TRÁI ảnh, d0/d1 = sâu ra phía camera;
    // scripts/so-mat.py lấy đây biết mép bóng nào là mép khối nào (chân tháp xoè, cổng xuyên khối)
    const khoiMat = n.dsKhoi.filter((q) => q.yTren != null).map((q) => { const s = q.v.map(([x, z]) => L / 2 - ((x - mx) * ux + (z - mz) * uz)), d = q.v.map(([x, z]) => (x - mx) * nx + (z - mz) * nz);
      return { id: q.id, s0: Math.min(...s), s1: Math.max(...s), d0: Math.min(...d), d1: Math.max(...d), yDuoi: q.yDuoi, yTren: q.yTren, dat: q.datCao }; }).filter((o) => o.d1 > -sau && o.d0 < 14 && o.s1 > 0 && o.s0 < L);
    return { khoi: t.k?.id, canh: i, x1, z1, x2, z2, y0, y1, L, px: PX, thay: 1, anh, anhMH, khoiMat, nx, nz };
  }, [t.j, i, +(process.env.PX || 8), t.m || null, MH, THAP]); // PX=… (điểm ảnh / mét) — 8 cho dò cửa, 16 cho ảnh dán mặt tường
  if (!m) continue; if (m.bo) { console.log(`${t.khoi} cạnh ${i}: bỏ (${m.bo})`); continue; }
  const tep = join(RA, `mat-g-${meta.length}.png`); writeFileSync(tep, Buffer.from(m.anh.split(',')[1], 'base64')); const { anh, anhMH, ...r } = m;
  const tepMH = anhMH ? join(RA, `mat-m-${meta.length}.png`) : undefined; if (anhMH) writeFileSync(tepMH, Buffer.from(anhMH.split(',')[1], 'base64')); meta.push({ ...r, tep, tepMH });
  console.log(`[${meta.length}] ${m.khoi} cạnh ${i}: ${m.L.toFixed(1)} m`);
}
writeFileSync(join(RA, 'mat-g.json'), JSON.stringify(meta, null, 1));
if (MH) { const f = join(PUB, 'du-lieu', `${LAU}-mat-dung.json`); writeFileSync(join(RA, 'mo-hinh-xoe.json'), JSON.stringify(existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).chan_xoe ?? {} : {})); } // chân xoè mô hình ĐANG CÓ lúc chụp → so-mat.py --ghi cộng phần còn lệch lên trên, không đếm hai lần
await dong();
