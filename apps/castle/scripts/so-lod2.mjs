#!/usr/bin/env node
// SO MÔ HÌNH VỚI LoD2 CHÍNH THỨC CỦA BAVARIA (20/11/2026): dữ liệu mở Bayerische Vermessungsverwaltung (geodaten.bayern.de/opengeodata, CC BY 4.0) —
// "Schloss Neuschwanstein" là một toà LoD2 có 214 mặt mái đo đạc (ô 630_5268). Mỗi khối OSM của cảnh: lấy các mặt mái LoD2 có tâm nằm trong mặt bằng khối
// → mái hiên (điểm thấp nhất) + nóc (điểm cao nhất) so với đỉnh tường / đỉnh mái của mô hình. In bảng lệch + ghi du-lieu-goc/bayern/so-lod2.json.
//   python3 … (tách lod2-lau-dai.json — xem QUY-TRINH) rồi: node apps/castle/scripts/so-lod2.mjs
// tra-repo-ok: so sánh dữ liệu riêng của cảnh với tệp CityGML đã tách; không có thư viện tương ứng.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOC, moTrang } from './chung.mjs';
const T = readFileSync(join(GOC, 'du-lieu-goc/bayern/lod2-630_5268.gml'), 'utf8'), E0 = 631637.44, N0 = 5268614.78, g = 1.7498 * Math.sin(47.5576 * Math.PI / 180) * Math.PI / 180;
const loc = (E, N) => { const dE = (E - E0) / 0.99981, dN = (N - N0) / 0.99981; return [dE * Math.cos(g) + dN * Math.sin(g), -(-dE * Math.sin(g) + dN * Math.cos(g))]; };
const toa = T.split('<bldg:Building ').find((b) => b.includes('Schloss Neuschwanstein')), mai = [...toa.matchAll(/<bldg:RoofSurface[\s\S]*?<\/bldg:RoofSurface>/g)].map((m) => { const v = m[0].match(/<gml:posList[^>]*>([^<]*)/)[1].trim().split(/\s+/).map(Number), p = []; for (let i = 0; i < v.length; i += 3) p.push([...loc(v[i], v[i + 1]), v[i + 2]]); return p; });
// ĐO TỪNG ĐIỂM (không so theo tâm mặt mái — mặt mái LoD2 trùm nhiều khối OSM): lưới 1 m trong mặt bằng mỗi khối, tại mỗi điểm
//   độ cao mái LoD2 (mặt phẳng của đa giác mái chứa điểm, lấy mặt cao nhất) − độ cao mặt trên của mô hình (tia từ trên xuống lớp OSM) → trung vị / khối
const mp = mai.map((p) => { const [a, b, c] = [p[0], p[1], p.find((q, i) => i > 1 && Math.abs((p[1][0] - p[0][0]) * (q[1] - p[0][1]) - (p[1][1] - p[0][1]) * (q[0] - p[0][0])) > 0.05) || p[2]];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  return { p, a, n, xs: [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0]))], zs: [Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[1]))] }; }).filter((m) => Math.abs(m.n[2]) > 1e-6);
const trong = (x, z, v) => { let t = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) t = !t; } return t; };
const caoLod2 = (x, z) => { let h = null; for (const m of mp) { if (x < m.xs[0] || x > m.xs[1] || z < m.zs[0] || z > m.zs[1] || !trong(x, z, m.p)) continue; const y = m.a[2] - (m.n[0] * (x - m.a[0]) + m.n[1] * (z - m.a[1])) / m.n[2]; if (h === null || y > h) h = y; } return h; };
const { pg, dong } = await moTrang({ anh3d: false });
const K = await pg.evaluate(() => { const n = window.__ns, T = n.THREE, rc = new T.Raycaster(), xuong = new T.Vector3(0, -1, 0), lop = n.LOP_OSM.filter((o) => o.visible !== false);
  const trong = (x, z, v) => { let t = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) t = !t; } return t; };
  return { goc: n.GOC_Y, ds: n.TUONG_MT.filter((t) => t.k?.id).map((t) => { const xs = t.v.map((p) => p[0]), zs = t.v.map((p) => p[1]), d = [];
    for (let x = Math.ceil(Math.min(...xs)) + 0.5; x < Math.max(...xs); x += 1) for (let z = Math.ceil(Math.min(...zs)) + 0.5; z < Math.max(...zs); z += 1) { if (!trong(x, z, t.v)) continue; rc.set(new T.Vector3(x, 400, z), xuong); const h = rc.intersectObjects(lop, true)[0]; if (h) d.push([x, z, +h.point.y.toFixed(2)]); }
    return { id: t.k.id, ten: t.ten, d }; }) }; }); await dong();
writeFileSync(join(GOC, 'du-lieu-goc/bayern/diem-mo-hinh.json'), JSON.stringify(K)); // điểm đo mô hình (x, z, y cảnh) từng khối — scripts/so-dom20.py so tiếp với DOM20
const DX = +(process.env.DX || 0), DZ = +(process.env.DZ || 0); // dời mặt bằng OSM → dữ liệu chính thức (scripts/so-dom20.py dò ra: +7, +1)
const tv = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; }, ra = [], moi = [];
for (const k of K.ds) { const l = []; for (const [x, z, y] of k.d) { const h = caoLod2(x + DX, z + DZ); if (h !== null) { l.push(h - (y + K.goc)); moi.push(h - (y + K.goc)); } }
  ra.push({ id: k.id, ten: k.ten, diem: k.d.length, co: l.length, lech: l.length >= 3 ? +tv(l).toFixed(2) : null, trai: l.length >= 3 ? +(tv(l.map((v) => Math.abs(v - tv(l))))).toFixed(2) : null }); }
const bu = tv(moi), co = ra.filter((r) => r.lech !== null);
console.log(`gốc cảnh ${K.goc.toFixed(1)} m · ${mp.length} mặt mái LoD2 · ${co.length}/${ra.length} khối có điểm đo · ${moi.length} điểm · bù mốc độ cao (trung vị mọi điểm) ${bu.toFixed(2)} m`);
console.log('khối'.padEnd(16), 'tên'.padEnd(14), 'điểm', ' LoD2 − mô hình (m, sau bù)', ' độ trải');
for (const r of co.sort((a, b) => Math.abs(b.lech - bu) - Math.abs(a.lech - bu))) console.log(r.id.padEnd(16), String(r.ten || '').slice(0, 13).padEnd(14), String(r.co).padStart(4), (r.lech - bu).toFixed(1).padStart(12), String(r.trai).padStart(16));
const l = co.map((r) => Math.abs(r.lech - bu)); console.log(`lệch đỉnh khối: trung vị ${tv(l).toFixed(1)} m · ≤ 1 m: ${l.filter((x) => x <= 1).length} · 1–3 m: ${l.filter((x) => x > 1 && x <= 3).length} · > 3 m: ${l.filter((x) => x > 3).length} khối · không có mái LoD2: ${ra.length - co.length} khối`);
writeFileSync(join(GOC, 'du-lieu-goc/bayern/so-lod2.json'), JSON.stringify({ bu, ds: ra }, null, 1));
