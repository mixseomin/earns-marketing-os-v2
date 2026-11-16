#!/usr/bin/env node
// CÁCH 3 (bản đầy đủ, kiểu CityGML LOD2 "mặt bằng + độ cao đo được"): giữ MẶT BẰNG + mọi chi tiết của mô hình (cửa, răng cưa, nội thất, đi bộ),
// thay ĐỘ CAO từng khối bằng số đo trên bản đồ độ cao thật (du-lieu/<lâu>-cach3.json, scripts/khop-khoi.mjs):
//   đỉnh = phân vị 95 các ô trong mặt bằng (lùi 0,6 m khỏi mép, bỏ ô vọt > trung vị + 6 m); mái giữ tỉ lệ mô hình (ước mái từ dải mép không tin được).
// Bỏ khối có khối khác chồng lên trên (đỉnh đo được là của khối trên), khối ít ô (< 12), khối lệch < 0,8 m (giữ nguyên).
// Ghi public/du-lieu/<lâu>-sua-cach3.json — ns.js chỉ áp khi mở trang với ?cach=3 (nút 🧩), bản cũ giữ nguyên.
//   node apps/castle/scripts/khoi-tu-dsm.mjs --lau neuschwanstein
// tra-repo-ok: tính phân vị độ cao theo mặt bằng (LOD2 từ DSM), dữ liệu riêng của cảnh.
import { writeFileSync, readFileSync } from 'node:fs';
import { du, moTrang } from './chung.mjs';
const DSM = JSON.parse(readFileSync(du('cach3'), 'utf8')), SUA = JSON.parse(readFileSync(du('sua'), 'utf8'));
DSM.daDo = Object.entries(SUA).filter(([, e]) => e && e.y_tren != null).map(([id]) => id);
const { pg, dong } = await moTrang();
const kq = await pg.evaluate((D) => {
  const n = window.__ns, { x0, z0, B, W, H } = D, ra = {}, bao = [], tt = {}; // tt: trạng thái MỌI khối (khung màu trên trang)
  const tr = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const kc = (x, z, v) => { let m = 1e9; for (let i = 0; i < v.length; i++) { const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const pv = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  // chỉ khối LÂU ĐÀI (≤ 100 m quanh tâm); khối đã có độ cao đo theo tia (sua.json y_tren — Torbau) giữ nguyên: số đo tay chắc hơn
  const ds = n.dsKhoi.filter((k) => k.yTren != null && !(k.vo && k.coPart)), daDo = new Set(D.daDo || []);
  const tinh = ds.filter((k) => Math.hypot(...k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0])) <= 100 && !daDo.has(k.id));
  for (const k of ds) if (!tinh.includes(k)) tt[k.id] = daDo.has(k.id) ? 'do_tay' : 'ngoai';
  for (const k of tinh) {
    const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]), tat = [], mep = [];
    for (let j = Math.max(0, Math.floor((Math.min(...zs) - z0) / B)); j <= Math.min(H - 1, Math.ceil((Math.max(...zs) - z0) / B)); j++)
      for (let i = Math.max(0, Math.floor((Math.min(...xs) - x0) / B)); i <= Math.min(W - 1, Math.ceil((Math.max(...xs) - x0) / B)); i++) {
        const y = D.y[j * W + i]; if (y == null) continue; const x = x0 + (i + 0.5) * B, z = z0 + (j + 0.5) * B; if (!tr(x, z, k.v)) continue; const d = kc(x, z, k.v); if (d < 0.6) continue; tat.push(y); if (d < 1.6) mep.push(y); }
    if (tat.length < 12) { bao.push(`${k.id}: ít ô (${tat.length})`); tt[k.id] = 'chua_do'; continue; }
    // khối khác CHỒNG LÊN (cùng mặt bằng, chân cao hơn đỉnh mình − 1 m): đỉnh đo được không phải của khối này
    const [cx, cz] = k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0]);
    if (ds.some((q) => q !== k && (q.yDuoi ?? -1e9) > k.yTren - 1 && tr(cx, cz, q.v))) { bao.push(`${k.id}: có khối chồng trên`); tt[k.id] = 'chua_do'; continue; }
    // bỏ ô vọt cao hơn trung vị khối > 6 m: chân / chóp khối CAO BÊN CẠNH lọt vào mặt bằng OSM (mặt bằng chồng nhau) — Treppenturm đo ra 90 m
    const giua = pv(tat, 0.5), sach = tat.filter((y) => y <= giua + 6), msach = mep.filter((y) => y <= giua + 6);
    const dinh = +pv(sach, 0.95).toFixed(2), chan = msach.length >= 6 ? +pv(msach, 0.15).toFixed(2) : null, mai = (k.tags['roof:shape'] || 'flat').toLowerCase();
    // chóp / tháp nhọn nhô lên (đỉnh cao hơn trung vị > 8 m): khối mái bằng sẽ kéo CẢ THÂN lên thành cột trơn (Treppenturm) — bỏ, giữ độ cao cũ
    if (dinh - giua > 8) { bao.push(`${k.id}: có chóp nhô (${giua.toFixed(1)} → ${dinh}) — giữ`); tt[k.id] = 'chua_do'; continue; }
    if (Math.abs(dinh - k.yTren) < 0.8) { tt[k.id] = 'khop'; continue; }
    const e = { y_tren: String(dinh), ly_do: `cách 3: đỉnh đo trên bản đồ độ cao thật ${dinh} m (mô hình ${k.yTren.toFixed(1)}), ${tat.length} ô` };
    // KHÔNG tự đổi chiều cao mái: dải sát mép lẫn ô thấp (sân, mái thấp kề) → mái 11 m đè mặt tiền sân trên. Chỉ dời đỉnh, giữ tỉ lệ mái của mô hình
    void chan;
    // THÁP CHÓP NHỌN: mặt bằng nhỏ (< 80 m²), mái bằng mà bản đồ báo cao vượt > 8 m → ngoài đời là tháp mảnh có chóp (Treppenturm):
    // dựng mái chóp, đỉnh chóp = số đo, chóp cao 0,6 × phần vượt + 4 m (≤ 16 m) (không kéo cả thân thành cột vuông trơn)
    const dt = Math.abs(k.v.reduce((t, p, i) => { const q = k.v[(i + 1) % k.v.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    if (mai === 'flat' && dt < 80 && dinh - k.yTren > 8) { e['roof:shape'] = 'pyramidal'; e['roof:height'] = String(+Math.min(16, (dinh - k.yTren) * 0.6 + 4).toFixed(1)); e.ly_do += ` — tháp chóp nhọn (mặt bằng ${dt.toFixed(0)} m²)`; }
    ra[k.id] = e; tt[k.id] = 'doi'; bao.push(`${k.id} ${k.tags.name || ''}: ${k.yTren.toFixed(1)} → ${dinh}${e['roof:height'] ? ` (mái ${e['roof:height']} m)` : ''}`);
  }
  // ĐỈNH THẬT mọi khối lâu đài (kể cả đo tay / chồng) để lớp 🧩 Kiểm vẽ "khung thật" cạnh khung mô hình: phân vị 95 ô trong mặt bằng, bỏ ô vọt > trung vị + 6 m
  const doDinh = {};
  for (const k of ds) { const [cx, cz] = k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0]); if (Math.hypot(cx, cz) > 100) continue;
    const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]), a = [];
    for (let j = Math.max(0, Math.floor((Math.min(...zs) - z0) / B)); j <= Math.min(H - 1, Math.ceil((Math.max(...zs) - z0) / B)); j++)
      for (let i = Math.max(0, Math.floor((Math.min(...xs) - x0) / B)); i <= Math.min(W - 1, Math.ceil((Math.max(...xs) - x0) / B)); i++) { const y = D.y[j * W + i]; if (y == null) continue; const x = x0 + (i + 0.5) * B, z = z0 + (j + 0.5) * B; if (tr(x, z, k.v) && kc(x, z, k.v) >= 0.6) a.push(y); }
    if (a.length < 12) continue; const g = pv(a, 0.5), sach = a.filter((y) => y <= g + 6);
    doDinh[k.id] = { dinh: +pv(sach, 0.95).toFixed(2), so: a.length, chong: ds.some((q) => q !== k && (q.yDuoi ?? -1e9) > k.yTren - 1 && tr(cx, cz, q.v)) }; }
  return { ra, bao, tt, doDinh };
}, DSM);
await dong();
writeFileSync(du('sua-cach3'), JSON.stringify(kq.ra, null, 1) + '\n');
// trạng thái từng khối: doi (cách 3 đổi) · do_tay (đo tay bằng tia, áp cả hai bản) · khop (đo khớp sẵn < 0,8 m) · chua_do (chồng / ít ô / chóp) · ngoai (ngoài lâu đài)
writeFileSync(du('cach3-trang-thai'), JSON.stringify(Object.fromEntries(Object.entries(kq.tt).map(([id, t]) => [id, { tt: t, ...(kq.doDinh[id] || {}) }])), null, 1) + '\n'); // { tt, dinh (đỉnh đo trên bản đồ độ cao thật), so (số ô), chong (khối khác chồng trên → dinh là của khối trên) }
console.log(kq.bao.join('\n')); console.log(`\n${Object.keys(kq.ra).length} khối đổi độ cao → ${du('sua-cach3')}`);
