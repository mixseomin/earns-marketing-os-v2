#!/usr/bin/env node
// SO LỆCH ẢNH THẬT ↔ MÔ HÌNH ở một góc camera (báo từ nút 🔍 trên castle.on.tc, hoặc camera tự đưa): dựng lại ĐÚNG camera (vị trí, hướng, góc nhìn, zoom, khổ),
// chụp hai bản (window.__ns.chupHaiBan — cùng hàm nút trên trang dùng), so viền trời + đường nét (scripts/so-lech.py), dò mỗi vùng lệch ra MẶT TƯỜNG OSM
// ("khối#cạnh", window.__ns.diemTaiAnh) → bảng + ảnh báo cáo khung đỏ đánh số.
//   node apps/castle/scripts/so-lech.mjs --the <id góp ý>            (đọc LECH-JSON / VUNG-JSON trong card hòm góp ý castle qua scripts/gop-y.sh trên box3)
//   node apps/castle/scripts/so-lech.mjs --cam '{"p":[x,y,z],"d":[dx,dy,dz],"fov":50,"zoom":60,"w":1280,"h":800}' [--vung '[[[u,v],…]]']
// Ra: apps/castle/.bao-lech/<id | giờ>/ (mo-hinh.png, anh-that.png, lech.json, bao-cao.png)
// tra-repo-ok: keo nội bộ (Playwright qua chung.mjs + so ảnh PIL), dữ liệu riêng của cảnh.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GOC, moTrang } from './chung.mjs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let cam = arg('--cam') ? JSON.parse(arg('--cam')) : null, vung = arg('--vung') ? JSON.parse(arg('--vung')) : [], nhan = arg('--the');
if (nhan) {
  const txt = execFileSync('ssh', ['root@167.233.241.16', `GOPY_TRANG=castle.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh show ${nhan}`], { encoding: 'utf8' });
  const m = txt.match(/LECH-JSON:(\{.*?\})(?:\s|$)/s), v = txt.match(/VUNG-JSON:(\[.*?\]\])(?:\s|$)/s);
  if (!m) { console.error('card #' + nhan + ' không có LECH-JSON (không phải báo lệch từ nút 🔍)'); process.exit(1); }
  cam = JSON.parse(m[1]); if (v) vung = JSON.parse(v[1]);
}
if (!cam) { console.error('cần --the <id> hoặc --cam <json>'); process.exit(1); }
const ra = join(GOC, '.bao-lech', nhan || new Date().toISOString().replace(/[:.]/g, '-')); mkdirSync(ra, { recursive: true });
const k = Math.min(1, 1280 / (cam.w || 1280)), khung = { width: Math.round((cam.w || 1280) * k), height: Math.round((cam.h || 800) * k) };
const { pg, dong } = await moTrang({ anh3d: true, khung });
const hai = await pg.evaluate((c) => window.__ns.chupHaiBan(c), cam);
for (const [ten, du] of [['mo-hinh.png', hai.moHinh], ['anh-that.png', hai.anhThat]]) if (du) writeFileSync(join(ra, ten), Buffer.from(du.split(',')[1], 'base64'));
if (!hai.anhThat) { console.error('ảnh thật 3D không nạp được (token Cesium chỉ nhận cổng 18777 / castle.on.tc)'); await dong(); process.exit(1); }
writeFileSync(join(ra, 'vung.json'), JSON.stringify(vung));
writeFileSync(join(ra, 'nen.json'), JSON.stringify(await pg.evaluate(() => { const c = window.__ns.scene.background; return c?.isColor ? [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)] : null; }) || [169, 196, 221]));
execFileSync('python3', [join(GOC, 'scripts', 'so-lech.py'), ra, join(ra, 'vung.json')], { stdio: 'inherit' });
const L = JSON.parse((await import('node:fs')).readFileSync(join(ra, 'lech.json'), 'utf8'));
for (const r of L.vung) { // tâm vùng → điểm trúng trên mô hình → mặt tường OSM; thử thêm 4 điểm quanh tâm nếu tâm rơi vào trời
  for (const [du, dv] of [[0.5, 0.5], [0.5, 0.75], [0.3, 0.5], [0.7, 0.5], [0.5, 0.25]]) { const t = await pg.evaluate(([u, v]) => window.__ns.diemTaiAnh(u, v), [r.u0 + (r.u1 - r.u0) * du, r.v0 + (r.v1 - r.v0) * dv]); if (t) { r.trung = t; break; } }
  if (r.trung && r.lech_px) { const p = hai.cam.p, kc = Math.hypot(r.trung.diem[0] - p[0], r.trung.diem[1] - p[1], r.trung.diem[2] - p[2]); r.lech_m = +(Math.abs(r.lech_px) * 2 * kc * Math.tan(hai.cam.fov * Math.PI / 360) / khung.height).toFixed(1); }
}
writeFileSync(join(ra, 'lech.json'), JSON.stringify(L, null, 1)); await dong();
execFileSync('python3', [join(GOC, 'scripts', 'so-lech.py'), ra, '--ve'], { stdio: 'inherit' });
console.log(`\nCamera: (${hai.cam.p.join(', ')}) hướng (${hai.cam.d.join(', ')}) · góc nhìn ${hai.cam.fov}° · zoom ${cam.zoom ?? hai.cam.zoom} m · khổ ${khung.width}×${khung.height}${vung.length ? ` · ${vung.length} nét tô đỏ` : ''}`);
L.vung.forEach((r, i) => console.log(`#${i + 1}${r.trong_vung_to ? ' [vùng tô]' : ''} điểm ${r.diem} · ${r.huong}${r.lech_m ? ` ~${r.lech_m} m` : ''} · ô ảnh u ${r.u0}–${r.u1} v ${r.v0}–${r.v1} · ${r.trung?.mat ? `mặt ${r.trung.mat}${r.trung.ten ? ' (' + r.trung.ten + ')' : ''}` : 'không trúng tường (địa hình / trời)'}${r.trung ? ` tại (${r.trung.diem.join(', ')})` : ''}`));
console.log('\nThư mục:', ra);
