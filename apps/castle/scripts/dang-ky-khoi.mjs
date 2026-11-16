#!/usr/bin/env node
// ĐĂNG KÝ NGANG từng khối với ảnh 3D (anh 16/11/2026: bật ảnh thật thì khung "lệch hết cả"): OSM vẽ mặt bằng lệch chỗ thật vài mét.
// Với mỗi khối lâu đài, tìm dời (dx, dz) trong ±R m (bước 0,25) làm mặt bằng khớp nhất bản đồ độ cao thật (<lâu>-cach3.json, scripts/khop-khoi.mjs):
// điểm = tỉ lệ ô (trong mặt bằng & ảnh cao ≥ ngưỡng) + (ngoài sát mép ≤ 1,5 m & ảnh thấp hơn) — ngưỡng = đỉnh − 35 % chiều cao trên đất.
// Đề xuất dời khi: cải thiện ≥ 0,08, dời ≥ 0,75 m, không chạm biên tìm (chạm biên = không tin), khối là PHẦN đứng riêng (không có khối khác chồng trên / dưới).
// Ghi sua.json dich_x / dich_z (cộng dồn vào dời cũ) khi chạy với --ghi; không --ghi chỉ in bảng.
//   node apps/castle/scripts/dang-ky-khoi.mjs --lau neuschwanstein [R=5] [--ghi]
// tra-repo-ok: tìm lưới đơn giản trên dữ liệu riêng của cảnh.
import { readFileSync, writeFileSync } from 'node:fs';
import { du, doiSo, moTrang } from './chung.mjs';
const [R = 5] = doiSo.filter((a) => !a.startsWith('--')).map(Number), GHI = process.argv.includes('--ghi');
const D = JSON.parse(readFileSync(du('cach3'), 'utf8'));
const { pg, dong } = await moTrang();
const kq = await pg.evaluate(([D, R]) => { const n = window.__ns, { x0, z0, B, W, H } = D;
  const tr = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const tam = (k) => k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0]);
  const ds = n.dsKhoi.filter((k) => k.yTren != null && !(k.vo && k.coPart) && Math.hypot(...tam(k)) < 100);
  const yAt = (x, z) => { const i = Math.floor((x - x0) / B), j = Math.floor((z - z0) / B); return i < 0 || j < 0 || i >= W || j >= H ? null : D.y[j * W + i]; };
  const diem = (k, dx, dz) => { const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]), ng = k.yTren - 0.35 * (k.yTren - Math.min(...k.v.map(([x, z]) => n.matDat(x, z)))); let t = 0, c = 0;
    for (let x = Math.min(...xs) - 1.5; x <= Math.max(...xs) + 1.5; x += 0.5) for (let z = Math.min(...zs) - 1.5; z <= Math.max(...zs) + 1.5; z += 0.5) { const y = yAt(x + dx, z + dz), cao = y != null && y >= ng, o = tr(x, z, k.v); t++; if (o === cao) c++; } // ô trống (ngoài lâu đài) = thấp — trước bỏ qua nên dời ra chỗ trống được điểm tuyệt đối
    return t ? c / t : 0; };
  return ds.map((k) => { const [cx, cz] = tam(k), chong = ds.some((q) => q !== k && tr(cx, cz, q.v) && ((q.yDuoi ?? -1e9) > k.yTren - 1 || (k.yDuoi ?? -1e9) > q.yTren - 1));
    const s0 = diem(k, 0, 0); let b = { dx: 0, dz: 0, s: s0 }; for (let dx = -R; dx <= R + 1e-6; dx += 0.25) for (let dz = -R; dz <= R + 1e-6; dz += 0.25) { const s = diem(k, dx, dz); if (s > b.s) b = { dx, dz, s }; }
    const bien = Math.abs(b.dx) >= R - 1e-6 || Math.abs(b.dz) >= R - 1e-6, xa = Math.hypot(b.dx, b.dz);
    return { id: k.id, ten: k.tags.name || '', s0: +s0.toFixed(3), s: +b.s.toFixed(3), dx: b.dx, dz: b.dz, chong, bien, nhan: !chong && !bien && !k.trongPalas && b.s - s0 >= 0.08 && xa >= 0.75, palas: !!k.trongPalas }; }); }, [D, R]); // khối trong Palas giữ: nội thất + leo cửa sổ bám mặt bằng Palas
await dong();
const SUA = JSON.parse(readFileSync(du('sua'), 'utf8'));
for (const r of kq.sort((a, b) => (b.s - b.s0) - (a.s - a.s0))) {
  console.log(`${r.nhan ? '✓ DỜI ' : '  giữ '} ${r.id} ${r.ten} · khớp ${r.s0} → ${r.s} khi dời (${r.dx}, ${r.dz})${r.chong ? ' · có khối chồng (giữ)' : ''}${r.bien ? ' · chạm biên (không tin)' : ''}`);
  if (GHI && r.nhan) { const e = (SUA[r.id] ??= {}); e.dich_x = String(+((+e.dich_x || 0) + r.dx).toFixed(2)); e.dich_z = String(+((+e.dich_z || 0) + r.dz).toFixed(2)); e.ly_do_dich = `dang-ky-khoi.mjs ${new Date().toISOString().slice(0, 10)}: mặt bằng OSM lệch ảnh 3D (${r.dx}, ${r.dz}) m, khớp ${r.s0} → ${r.s}`; }
}
if (GHI) { writeFileSync(du('sua'), JSON.stringify(SUA, null, 1) + '\n'); console.log('ghi', du('sua')); }
