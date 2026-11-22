#!/usr/bin/env node
// KHỚP CAMERA ẢNH SO bằng ẢNH THẬT 3D (Google, đã khớp toạ độ): đặt camera ở chỗ đứng của ảnh (lat/lng trong du-lieu/<lâu>-anh.json), vẽ RIÊNG lớp ảnh 3D,
// lấy viền trời từng cột rồi dò (độ cao, hướng, ngẩng, ống kính) để viền ảnh 3D trùng viền ảnh thật nhất (trung vị lệch các cột có lâu đài).
// Camera khớp xong ghi lại vào du-lieu/<lâu>-anh.json → máy kiểm đường viền (chup-so-anh.mjs + kiem-vien.py) so mô hình với ảnh trên camera đúng.
// Chạy trên iMac: node apps/castle/scripts/khop-camera.mjs [chỉ số ảnh …] (mặc định mọi ảnh đã có camera). Tự mở máy chủ tĩnh cổng 18777.
// tra-repo-ok: cùng ý tưởng khớp camera một ảnh của fSpy (perarnia/fSpy, GPL) nhưng tự động bằng viền ảnh 3D; công cụ nội bộ của cảnh.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { GOC, PUB, LAU, du, doiSo, moTrang } from './chung.mjs';
import { join } from 'node:path';
const TEP = du('anh');
const { pg, dong } = await moTrang({ anh3d: true, khung: { width: 1600, height: 1200 } });
const ANH = JSON.parse(readFileSync(TEP, 'utf8'));
const chon = doiSo.map(Number); const ds = ANH.map((a, i) => i).filter((i) => !ANH[i].khongDung && (chon.length ? chon.includes(i) : ANH[i].camera)); // chỉ định chỉ số thì khớp cả ảnh chưa có camera (dò thô trước)

// trong trang: viền ảnh thật (một lần) + hàm chấm một camera (vẽ riêng lớp ảnh 3D, chờ ô tải, đọc điểm ảnh)
await pg.evaluate(() => {
  const n = window.__ns;
  window.__vienAnh = async (src, W, H) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data, v = []; for (let x = 0; x < W; x++) { let y = 0; for (; y < H; y++) { const i = (y * W + x) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2]; if (!(bb > r + 18 && bb > 100) && !(min3(r, gg, bb) > 185 && max3(r, gg, bb) - min3(r, gg, bb) < 40 && y < H * 0.35)) break; } v.push(y); } return v; };
  const min3 = (a, b, c) => Math.min(a, b, c), max3 = (a, b, c) => Math.max(a, b, c);
  // ảnh chụp đứng trên đất (Mapillary): camera = { dx, dz, h, … } — dx / dz bù sai số GPS quanh chỗ chụp (đã dời khung, n.raCanh), h = mắt trên mặt đất thật tại đó
  window.__yDat = (la, ln, dx = 0, dz = 0) => { const [x, z] = n.raCanh(la, ln); return n.matDat(x + dx, z + dz); };
  window.__cham = async (cam, vA, nen, gan = false) => { // gan: ảnh chụp gần từ mặt đất — xét mọi cột có trời (mép ảnh là tường / cây, không có chân trời)
    if (cam.h != null) { const a = n.ANH.find((q) => q === window.__anhDang); cam = { ...cam, y: window.__yDat(a.lat, a.lng, cam.dx, cam.dz) + cam.h }; }
    n.datCam(cam); const a3 = n.anh3d(); a3.goc.visible = true; for (const o of n.scene.children) if (o !== a3.goc && !o.isLight) o.userData.anTam = o.visible, o.visible = false;
    a3.t.setCamera(n.camera); a3.t.setResolutionFromRenderer(n.camera, n.renderer);
    for (let k = 0, on = 0; k < 80 && on < 4; k++) { a3.t.update(); n.renderer.render(n.scene, n.camera); await new Promise((r) => setTimeout(r, 120)); on = (a3.t.loadProgress ?? 1) >= 0.999 ? on + 1 : 0; }
    a3.t.update(); n.renderer.render(n.scene, n.camera);
    const gl = n.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (const o of n.scene.children) if ('anTam' in o.userData) { o.visible = o.userData.anTam; delete o.userData.anTam; }
    const vG = []; for (let x = 0; x < W; x++) { let y = 0; for (; y < H; y++) { const i = ((H - 1 - y) * W + x) * 4; if (Math.abs(px[i] - nen[0]) + Math.abs(px[i + 1] - nen[1]) + Math.abs(px[i + 2] - nen[2]) > 30) break; } vG.push(y); }
    const sx = vA.length / W, chanTroi = [...vA.slice(0, vA.length / 12), ...vA.slice(-vA.length / 12)].sort((p, q) => p - q)[Math.floor(vA.length / 12)], lech = [];
    for (let x = 0; x < W; x++) { const a = vA[Math.floor(x * sx)] / sx, g = vG[x]; if (gan ? ((a > 3 || g > 3) && (a < H * 0.97 || g < H * 0.97)) : (a < chanTroi / sx - 40 / sx || g < chanTroi / sx - 40 / sx)) lech.push(Math.abs(a - g)); }
    lech.sort((p, q) => p - q); return lech.length > W * 0.08 ? lech[lech.length >> 1] : 999;
  };
});
for (const i of ds) {
  const a = ANH[i];
  const vA = await pg.evaluate(async ([i, src, w, h]) => { window.__ns.moSo(i); window.__anhDang = window.__ns.ANH[i]; return window.__vienAnh(src, w, h); }, [i, `./du-lieu/${a.tep}`, 1600, Math.round(1600 * a.cao / a.rong)]);
  const nen = [169, 196, 220];
  let cam, tot = 999;
  const gan = !!a.cameraDau, cham = (c) => pg.evaluate(([c, v, nen, gan]) => window.__cham(c, v, nen, gan), [c, vA, nen, gan]);
  const GIOI_XA = { dx: [-10, 10], dz: [-10, 10] }; // ảnh chụp xa (cầu Marienbrücke…): toạ độ Commons ước trên bản đồ, sai số chỗ đứng ~10 m — 22/11/2026 dời khung 7 m làm ảnh 0 từ 3 → 28 px khi chỉ dò y / hướng
  const GIOI = { h: [1.2, 3], dx: [-10, 10], dz: [-10, 10] }; // ảnh đứng đất: mắt 1,2–3 m trên đất thật, sai số chỗ đứng ≤ 10 m (22/11/2026: ±6 m làm ảnh 16 dò chạm biên dx −6, lệch 27 px) — trước đây dò tự do y nên camera tụt 3–13 m dưới đất bù cho lệch ngang
  const coTroi = vA.filter((y) => y > 3).length / vA.length; // phần cột ảnh thật có trời
  if (a.cameraDau && coTroi < 0.2) { // ÍT TRỜI (22/11/2026: ảnh 13 / 14 / 15 chỉ 5–14 % cột có trời → khung ảnh 3D toàn tường cũng 'lệch 12 px', máy dò kéo hướng lệch la bàn 30°, ngẩng 0,48 khi ảnh thật nhìn xuống bãi cỏ): viền trời không đủ để dò → giữ la bàn + GPS Mapillary
    const y = await pg.evaluate(([la, ln]) => window.__yDat(la, ln, 0, 0), [a.lat, a.lng]);
    a.camera = { dx: 0, dz: 0, mat: 1.6, y: +(y + 1.6).toFixed(2), yaw: a.cameraDau.yaw, pitch: a.cameraDau.pitch, fov: a.cameraDau.fov,
      ghi_chu: `ít trời (${Math.round(coTroi * 100)} % cột) → không dò viền, camera theo la bàn + GPS Mapillary (scripts/khop-camera.mjs, ${new Date().toISOString().slice(0, 10)})` };
    writeFileSync(TEP, JSON.stringify(ANH, null, 1) + '\n'); console.log(`ảnh ${i}: ít trời ${Math.round(coTroi * 100)} % cột → camera theo la bàn + GPS`); continue;
  }
  if (a.cameraDau) { // ẢNH ĐỨNG ĐẤT (Mapillary): hướng la bàn + ống kính ban đầu; dò hướng / ngẩng ở chỗ GPS, rồi dò cả chỗ đứng (dx, dz) + chiều cao mắt trong GIOI
    const goc = a.camera ? { yaw: a.camera.yaw, pitch: a.camera.pitch, fov: a.camera.fov } : a.cameraDau;
    for (let k = 0; k < 3; k++) await cham({ h: 1.6, dx: 0, dz: 0, ...goc });
    for (const [dx, dz] of [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4], [-8, 0], [8, 0], [0, -8], [0, 8]]) for (const pitch of [0, 0.12, 0.24, 0.36, 0.48]) for (let d = -0.3; d <= 0.31; d += 0.1) {
      const c = { h: 1.6, dx, dz, yaw: goc.yaw + d, pitch, fov: goc.fov }, e = await cham(c); if (e < tot) { tot = e; cam = c; } }
    console.log(`  dò quanh hướng ban đầu + chỗ đứng: lệch ${tot.toFixed(1)} px`, JSON.stringify(cam));
    if (!cam) { console.log(`ảnh ${i}: BỎ — không đo được viền trời`); continue; }
  }
  else if (a.camera) { cam = { y: a.camera.y, dx: a.camera.dx || 0, dz: a.camera.dz || 0, yaw: a.camera.yaw, pitch: a.camera.pitch, fov: a.camera.fov }; for (let k = 0; k < 4; k++) tot = await cham(cam); } // làm nóng: lần đầu ô ảnh 3D chưa tải đủ chi tiết ở chỗ đứng này → điểm sai
  else { // ẢNH CHƯA CÓ CAMERA: đứng 1,6 m trên mặt đất thật ở toạ độ ảnh, hướng về lâu đài (tâm các khối), dò thô lưới hướng × ngẩng × ống kính
    const g = await pg.evaluate(([la, ln]) => { const n = window.__ns, [x, z] = n.raCanh(la, ln);
      return { y: n.matDat(x, z) + 1.6, yaw: Math.atan2(-(-30 - x), -(15 - z)) }; }, [a.lat, a.lng]);
    for (let k = 0; k < 3; k++) tot = await cham({ y: g.y, yaw: g.yaw, pitch: 0.2, fov: 50 });
    tot = 999;
    // biên rộng: ảnh gần chụp ngửa (ngẩng tới 0,8 rad) bằng ống kính rộng (tới 84°) — lần đầu biên 0,4 / 66° bị chạm biên, lệch 107 px
    for (const fov of [40, 58, 76, 84]) for (const pitch of [0, 0.25, 0.5, 0.75]) for (let d = -0.9; d <= 0.91; d += 0.12) {
      const c = { y: g.y, yaw: g.yaw + d, pitch, fov }, e = await cham(c); if (e < tot) { tot = e; cam = c; }
    }
    console.log(`  dò thô: lệch ${tot.toFixed(1)} px`, JSON.stringify(cam));
  }
  console.log(`ảnh ${i}: bắt đầu lệch ${tot.toFixed(1)} px`, JSON.stringify(cam));
  const buoc = a.cameraDau ? { dx: 2, dz: 2, h: 0.6, yaw: 0.04, pitch: 0.04, fov: 3 } : a.camera ? { y: 6, dx: 4, dz: 4, yaw: 0.02, pitch: 0.02, fov: 2 } : { y: 4, yaw: 0.05, pitch: 0.05, fov: 4 }; // ảnh mới: bước lớn hơn (từ kết quả dò thô)
  for (let vong = 0; vong < 5; vong++) {
    for (const k of Object.keys(buoc)) for (const dau of [1, -1]) {
      for (;;) { const thu = { ...cam, [k]: cam[k] + dau * buoc[k] }; const gh = a.cameraDau ? GIOI[k] : GIOI_XA[k]; if (gh && (thu[k] < gh[0] || thu[k] > gh[1])) break; const e = await cham(thu); if (e < tot - 0.2) { cam = thu; tot = e; } else break; }
    }
    for (const k of Object.keys(buoc)) buoc[k] /= 2;
    console.log(`  vòng ${vong + 1}: lệch ${tot.toFixed(1)} px`, JSON.stringify(Object.fromEntries(Object.entries(cam).map(([k, v]) => [k, +v.toFixed(4)]))));
  }
  if (cam.h != null) { const y = await pg.evaluate(([la, ln, dx, dz]) => window.__yDat(la, ln, dx, dz), [a.lat, a.lng, cam.dx, cam.dz]); cam = { ...cam, y: y + cam.h }; }
  a.camera = { ...(a.camera || {}), ...(cam.dx != null ? { dx: +cam.dx.toFixed(2), dz: +cam.dz.toFixed(2) } : {}), ...(cam.h != null ? { mat: +cam.h.toFixed(2) } : {}), y: +cam.y.toFixed(2), yaw: +cam.yaw.toFixed(4), pitch: +cam.pitch.toFixed(4), fov: +cam.fov.toFixed(2),
    ghi_chu: `khớp tự động bằng viền ảnh thật 3D Google (scripts/khop-camera.mjs, ${new Date().toISOString().slice(0, 10)}): trung vị lệch viền ${tot.toFixed(1)} px trên khung 1600 px` };
  writeFileSync(TEP, JSON.stringify(ANH, null, 1) + '\n'); console.log(`  ghi ảnh ${i} →`, TEP); // ghi SAU MỖI ẢNH: 22/11/2026 loạt 7 ảnh treo ở ảnh 18 (trang quá 600 s) → mất kết quả 5 ảnh đã khớp xong vì chỉ ghi ở cuối
}
await dong();
