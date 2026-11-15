#!/usr/bin/env node
// ĐO CỬA MÁI + CHÓP NHỎ TRÊN MÁI từ ảnh 3D Google: với mỗi khối mái dốc (gabled / hipped / side_hipped), dò độ cao ảnh 3D trên lưới 0,5 m trong mặt bằng,
// khớp mặt mái của chính khối mô hình (k.hinh mái), phần nhô hơn mặt mái > 1 m thành cụm → mỗi cụm là một cửa mái (thấp, rộng) hoặc chóp (cao, hẹp):
// tâm, bề ngang, độ nhô, hướng mặt mái. Ghi public/du-lieu/<lâu>-mai.json { khoi: { id: [{ x, z, y, rong, nho, loai, huong }] } }; ns.js dựng khối 3D.
//   node apps/castle/scripts/do-mai.mjs --lau neuschwanstein [id khối …]
// tra-repo-ok: công cụ đo nội bộ (gọi __ns.cao3d có sẵn), không có thư viện tương ứng.
import { writeFileSync } from 'node:fs';
import { du, doiSo, moTrang } from './chung.mjs';
const { pg, dong } = await moTrang({ anh3d: true });
const nap = async (x, z) => { await pg.evaluate(([x, z]) => { const n = window.__ns; n.orbit.target.set(x, 40, z); n.camera.position.set(x + 15, 85, z + 15); n.orbit.update(); }, [x, z]);
  for (let i = 0, on = 0; i < 80 && on < 6; i++) { await pg.waitForTimeout(500); on = (await pg.evaluate(() => window.__ns.anh3d().t.loadProgress)) >= 0.999 ? on + 1 : 0; } };
const ds = await pg.evaluate((chon) => window.__ns.dsKhoi.filter((k) => /gabled|hipped/.test(k.tags['roof:shape'] || '') && k.hinh?.[1]?.length && (!chon.length || chon.includes(k.id)))
  .map((k) => ({ id: k.id, c: k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0]) })), doiSo);
const kq = {};
for (const k of ds) {
  await nap(k.c[0], k.c[1]);
  const r = await pg.evaluate((id) => {
    const n = window.__ns, k = n.dsKhoi.find((q) => q.id === id), tg = k.hinh[1], D = n.anh3d().goc.position.y || 0;
    const tr = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    const mai = (x, z) => { let y = null, nn = null; for (let i = 0; i + 8 < tg.length; i += 9) { const [ax, ay, az, bx, by, bz, cx, cy, cz] = tg.slice(i, i + 9), d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-6) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v; if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
      const yy = u * ay + v * by + w * cy; if (y == null || yy > y) { y = yy; const e1 = [bx - ax, by - ay, bz - az], e2 = [cx - ax, cy - ay, cz - az]; nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; } } return y == null ? null : { y, nn }; };
    const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]), B = 0.5, o = new Map();
    // lệch nền: trung vị (Google − mặt mái) toàn mái → bù sai lệch độ cao chung
    const pts = [];
    for (let x = Math.min(...xs) + 0.4; x < Math.max(...xs) - 0.4; x += B) for (let z = Math.min(...zs) + 0.4; z < Math.max(...zs) - 0.4; z += B) { if (!tr(x, z, k.v)) continue;
      const m = mai(x, z), g = n.cao3d(x, z); if (!m || g == null) continue; pts.push({ x, z, m: m.y, nn: m.nn, d: g - D - m.y }); }
    if (pts.length < 30) return null;
    const lech = pts.map((p) => p.d).sort((a, b) => a - b)[pts.length >> 1];
    const cao = pts.filter((p) => p.d - lech > 1.0), seen = new Set(), cum = [], key = (p) => Math.round(p.x / B) + ',' + Math.round(p.z / B), map = new Map(cao.map((p) => [key(p), p]));
    for (const p of cao) { const k0 = key(p); if (seen.has(k0)) continue; const st = [p], c = []; seen.add(k0);
      while (st.length) { const q = st.pop(); c.push(q); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = (Math.round(q.x / B) + a) + ',' + (Math.round(q.z / B) + b); if (map.has(kk) && !seen.has(kk)) { seen.add(kk); st.push(map.get(kk)); } } }
      if (c.length < 3) continue; const top = c.reduce((a, b) => (b.d > a.d ? b : a)), xs2 = c.map((q) => q.x), zs2 = c.map((q) => q.z);
      const rong = Math.max(Math.max(...xs2) - Math.min(...xs2), Math.max(...zs2) - Math.min(...zs2)) + B, nho = top.d - lech;
      const nn = top.nn, hl = Math.hypot(nn[0], nn[2]) || 1;
      cum.push({ x: +(c.reduce((s, q) => s + q.x, 0) / c.length).toFixed(2), z: +(c.reduce((s, q) => s + q.z, 0) / c.length).toFixed(2), y: +(top.m).toFixed(2), rong: +rong.toFixed(2), nho: +nho.toFixed(2), loai: nho > 4 && rong < 3.5 ? 'chop' : 'cuaMai', huong: +Math.atan2(nn[0] / hl, nn[2] / hl).toFixed(3), diem: c.length }); }
    return { lech: +lech.toFixed(2), so: pts.length, cum };
  }, k.id);
  // mái mô hình lệch ảnh 3D > 3 m: số đo cửa mái không tin được → bỏ (khu cổng Torbau lệch 8–10 m)
  if (r) { kq[k.id] = Math.abs(r.lech) > 3 ? [] : r.cum; console.log(`${k.id}: ${r.so} điểm, lệch nền ${r.lech} m → ${r.cum.filter((c) => c.loai === 'cuaMai').length} cửa mái, ${r.cum.filter((c) => c.loai === 'chop').length} chóp`); }
}
writeFileSync(du('mai'), JSON.stringify({ ghi_chu: 'cửa mái / chóp nhỏ trên mái đo trên ảnh 3D Google (scripts/do-mai.mjs): phần nhô > 1 m khỏi mặt mái của khối mô hình; x, z tâm, y mặt mái tại đỉnh cụm, rong (m), nho (m nhô), huong (hướng mặt mái, rad)', khoi: kq }, null, 1) + '\n');
console.log('ghi', du('mai')); await dong();
