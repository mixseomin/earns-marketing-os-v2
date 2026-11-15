#!/usr/bin/env node
// THÊM CHÓP / THÁP NHỎ CÒN THIẾU (OSM không có) từ máy kiểm đường viền: mỗi đoạn THIẾU hẹp (thieu.json của kiem-vien.py) →
// tia từ camera ĐÃ KHỚP (khop-camera.mjs) qua điểm ảnh ngay dưới viền mô hình cắt MÁI MÔ HÌNH (đã khớp ảnh 3D) = chân chóp (x, y, z);
// tia qua mũi chóp trên ảnh → điểm gần đường thẳng đứng qua chân nhất = độ cao mũi; bề ngang đoạn → bán kính.
// Gộp chóp trùng giữa các ảnh (< 2,5 m), chỉ giữ chóp nằm trên mái lâu đài (chân cao hơn mặt sân trên, trong / sát mặt bằng khối lâu đài).
// Ghi apps/castle/public/du-lieu/<lâu>-chop.json — ns.js dựng (nón bát giác + chóp).
//   node apps/castle/scripts/chup-so-anh.mjs <thư mục> && python3 apps/castle/scripts/kiem-vien.py <thư mục>; node apps/castle/scripts/them-chop.mjs <thư mục>
// tra-repo-ok: công cụ nội bộ của cảnh (Raycaster three.js trên lớp ảnh 3D đã nạp).
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { GOC, PUB, LAU, du, doiSo, moTrang } from './chung.mjs';
import { join } from 'node:path';
const THU = doiSo[0];
if (!THU) { console.error('thiếu thư mục có thieu.json'); process.exit(1); }
const THIEU = JSON.parse(readFileSync(join(THU, 'thieu.json'), 'utf8'));
const { pg, dong } = await moTrang({ anh3d: false, khung: { width: 1600, height: 1200 }, nhanLog: '[chop]' });
const tim = [];
for (const i of [...new Set(THIEU.map((t) => t.i))]) {
  const ds = await pg.evaluate(async ([i, ts]) => {
    const n = window.__ns, a3 = n.anh3d() || { goc: null }, T = n.THREE; n.moSo(i); n.renderer.render(n.scene, n.camera);
    const rc = new T.Raycaster(), ra = [], moHinh = n.scene.children.filter((o) => o !== a3.goc && !o.isLight && o.visible);
    const tia = (fx, fy) => { rc.setFromCamera(new T.Vector2(fx * 2 - 1, -(fy * 2 - 1)), n.camera); return rc.ray.clone(); };
    for (const t of ts) {
      const r0 = tia(t.x, t.yChan + 0.004); rc.ray.copy(r0); const h = rc.intersectObjects(moHinh, true)[0]; if (!h) continue; // chân chóp = chỗ tia cắt MÁI MÔ HÌNH (mái đã khớp ảnh 3D; ô ảnh 3D ở xa tải thô, hụt viền)
      const P = h.point, r1 = tia(t.x, t.yDinh), o = r1.origin, d = r1.direction, dh = Math.hypot(d.x, d.z);
      const k = ((P.x - o.x) * d.x + (P.z - o.z) * d.z) / (dh * dh), yDinh = o.y + d.y * k; // điểm trên tia mũi gần đường đứng qua chân nhất
      const kc = P.distanceTo(o), rong = 2 * kc * Math.tan(n.camera.fov * Math.PI / 360) * n.camera.aspect * t.rong;
      ra.push({ x: P.x, z: P.z, yChan: P.y, yDinh, r: rong / 2, anh: i });
    }
    return ra;
  }, [i, THIEU.filter((t) => t.i === i)]);
  tim.push(...ds);
}
// lọc + gộp
const ctx = await pg.evaluate(() => { const n = window.__ns, tam = (v) => v.reduce((s, p) => [s[0] + p[0] / v.length, s[1] + p[1] / v.length], [0, 0]); return { san: n.MAT_SAN, khoi: n.dsKhoi.filter((k) => k.tags.height || k.la).map((k) => k.v), tamKhoi: n.dsKhoi.filter((k) => k.la).map((k) => tam(k.v)) }; });
await dong();
const trong = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const ganKhoi = (x, z) => ctx.khoi.some((v) => trong(x, z, v) || v.some(([a, c]) => Math.hypot(a - x, c - z) < 4));
const loc = tim.filter((c) => c.yChan > ctx.san + 3 && c.yDinh - c.yChan > 2.5 && c.r > 0.25 && c.r < 3 && ganKhoi(c.x, c.z));
const gop = [];
for (const c of loc) { const g = gop.find((q) => Math.hypot(q.x - c.x, q.z - c.z) < 2.5); if (g) { const n = g.so + 1; for (const k of ['x', 'z', 'yChan', 'yDinh', 'r']) g[k] = (g[k] * g.so + c[k]) / n; g.so = n; g.anh = [...new Set([...g.anh, c.anh])]; } else gop.push({ ...c, so: 1, anh: [c.anh] }); }
// chiều sâu chỉ chắc khi thấy trên ≥ 2 ảnh (hai tia gặp nhau) hoặc chân trùng tâm một khối OSM có sẵn (nối dài chóp của khối đó); một ảnh → bỏ
const chac = gop.filter((c) => c.anh.length >= 2 || ctx.tamKhoi.some(([x, z]) => Math.hypot(x - c.x, z - c.z) < 3));
const ra = chac.map((c) => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), yChan: +c.yChan.toFixed(2), yDinh: +c.yDinh.toFixed(2), r: +c.r.toFixed(2), anh: c.anh }));
const TEP = du('chop');
writeFileSync(TEP, JSON.stringify({ ghi_chu: 'CHÓP / THÁP NHỎ OSM không có, tìm bằng máy kiểm đường viền (scripts/kiem-vien.py) + tia từ camera đã khớp xuống ảnh 3D Google (scripts/them-chop.mjs). Toạ độ cảnh: chân (x, yChan, z), mũi yDinh, bán kính r; anh = chỉ số ảnh so thấy chóp', luc: new Date().toISOString(), chop: ra }, null, 1) + '\n');
console.log(`${tim.length} điểm dò → lọc ${loc.length} → gộp ${gop.length} → chắc ${ra.length} chóp → ${TEP}`); for (const c of ra) console.log(' ', JSON.stringify(c));
