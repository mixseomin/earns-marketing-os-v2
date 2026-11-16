#!/usr/bin/env node
// CÁCH 3 — KHỐI KHỚP LƯỚI ẢNH 3D (anh 16/11/2026: "các chuyên gia dựng lại thế nào?" → khối mẫu từ lưới thật + bộ chi tiết):
// chụp lưới ảnh thật 3D (Google, đã khớp toạ độ cảnh) TỪ TRÊN XUỐNG bằng camera trực giao, hai lượt:
//   1) ĐỘ CAO (vẽ thẳng y thế giới vào ảnh số thực) → bản đồ độ cao thật mỗi ô B m (đỉnh tháp, sống mái, đầu hồi, răng cưa đúng chỗ)
//   2) MÀU → chỉ để PHÂN LOẠI vật liệu mỗi ô (gạch đỏ / đá sáng / mái tối) — không dán ảnh lên mô hình
// Giữ ô nằm trong mặt bằng các khối lâu đài OSM nới NOI m (bỏ cây / đá xung quanh). Ghi public/du-lieu/<lâu>-cach3.json → public/cach3.js dựng khối.
//   node apps/castle/scripts/khop-khoi.mjs --lau neuschwanstein [B=0.4] [NOI=2.5]
// tra-repo-ok: chụp độ sâu trực giao bằng three.js + 3d-tiles-renderer đã nạp trong trang (cách của photogrammetry DSM / Blosm), dữ liệu riêng của cảnh.
import { writeFileSync } from 'node:fs';
import { du, doiSo, moTrang } from './chung.mjs';
const [B = 0.4, NOI = 2.5] = doiSo.map(Number);
const { pg, dong } = await moTrang({ anh3d: true, khung: { width: 1400, height: 1000 } });
const kq = await pg.evaluate(async ([B, NOI]) => {
  const n = window.__ns, T = n.THREE, a3 = n.anh3d(), r = n.renderer, DICH = a3.goc.position.y || 0;
  const tr = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const kc = (x, z, v) => { let m = 1e9; for (let i = 0; i < v.length; i++) { const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const lau = n.dsKhoi.filter((k) => Math.hypot(...k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0])) < 110 && k.yTren != null && (k.tags.height || k.la || k.vo));
  const xs = lau.flatMap((k) => k.v.map((p) => p[0])), zs = lau.flatMap((k) => k.v.map((p) => p[1]));
  const x0 = Math.floor(Math.min(...xs) - NOI - 1), x1 = Math.ceil(Math.max(...xs) + NOI + 1), z0 = Math.floor(Math.min(...zs) - NOI - 1), z1 = Math.ceil(Math.max(...zs) + NOI + 1);
  const W = Math.round((x1 - x0) / B), H = Math.round((z1 - z0) / B), TREN = 160, DUOI = -40; // camera ở y 160 nhìn xuống, cắt tới y −40
  const cam = new T.OrthographicCamera(-(x1 - x0) / 2, (x1 - x0) / 2, (z1 - z0) / 2, -(z1 - z0) / 2, 0, TREN - DUOI);
  cam.position.set((x0 + x1) / 2, TREN, (z0 + z1) / 2); cam.up.set(0, 0, -1); cam.lookAt((x0 + x1) / 2, 0, (z0 + z1) / 2); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  // ẩn mọi thứ trừ lớp ảnh 3D, ép hiện lớp đó, nạp ô chi tiết cho camera trực giao
  const anTam = []; for (const o of n.scene.children) if (o !== a3.goc && !o.isLight && o.visible) { o.visible = false; anTam.push(o); }
  a3.epHien = true; a3.goc.visible = true; const suong = n.scene.fog, sg = [suong.near, suong.far]; suong.near = suong.far = 1e7;
  a3.t.setCamera(cam); a3.t.setResolution(cam, W * 2, H * 2);
  for (let k = 0, on = 0; k < 300 && (k < 25 || on < 8); k++) { a3.t.update(); r.render(n.scene, cam); await new Promise((ok) => setTimeout(ok, 120)); on = (a3.t.loadProgress ?? 1) >= 0.999 ? on + 1 : 0; }
  const nen = n.scene.background, rtF = new T.WebGLRenderTarget(W, H, { type: T.FloatType }), rt = new T.WebGLRenderTarget(W, H);
  // lượt 1: ĐỘ CAO THẾ GIỚI ghi thẳng vào kênh đỏ ảnh số thực (không nén độ sâu — cách nén RGBA đổi giữa các bản three.js)
  n.scene.background = null; n.scene.overrideMaterial = new T.ShaderMaterial({ side: T.DoubleSide, vertexShader: 'varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: 'varying float vY; void main(){ gl_FragColor = vec4(vY, 1.0, 0.0, 1.0); }' });
  r.setRenderTarget(rtF); r.setClearColor(0x000000, 0); r.clear(); r.render(n.scene, cam); const fl = new Float32Array(W * H * 4); r.readRenderTargetPixels(rtF, 0, 0, W, H, fl);
  // lượt 2: màu (chỉ phân loại vật liệu)
  n.scene.overrideMaterial = null; r.setRenderTarget(rt); r.setClearColor(0xff00ff, 1); r.clear(); r.render(n.scene, cam); const mau = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, mau);
  r.setRenderTarget(null); rt.dispose(); rtF.dispose(); n.scene.background = nen; [suong.near, suong.far] = sg; for (const o of anTam) o.visible = true; a3.t.deleteCamera?.(cam); a3.t.setCamera(n.camera); a3.epHien = false; a3.hien = null;
  // điểm ảnh (i, j) của render target: hàng 0 ở DƯỚI; camera up = −z → hàng dưới là z lớn (nam)
  const y = new Array(W * H).fill(null), loai = new Array(W * H).fill(0); let giu = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) * B, z = z0 + (j + 0.5) * B, p = (H - 1 - j) * W + i; // p: chỉ số trong ảnh đọc ra (lật hàng)
    if (!lau.some((k) => tr(x, z, k.v) || kc(x, z, k.v) < NOI)) continue;
    if (fl[p * 4 + 1] < 0.5) continue; const yy = fl[p * 4] - DICH; // kênh xanh = 1 là có ô (nền xoá về 0)
    const R = mau[p * 4], G = mau[p * 4 + 1], Bl = mau[p * 4 + 2]; if (R > 240 && G < 20 && Bl > 240) continue; // nền hồng tím: không có ô
    const sang = (R + G + Bl) / 3; loai[j * W + i] = R > G + 22 && R > Bl + 18 ? 1 : sang < 95 || (Bl > R + 8 && sang < 140) ? 2 : 0; // 1 gạch đỏ · 2 mái tối / đồng · 0 đá sáng
    y[j * W + i] = +yy.toFixed(2); giu++;
  }
  return { x0, z0, B, W, H, y, loai, giu, dich: DICH };
}, [B, NOI]);
await dong();
writeFileSync(du('cach3'), JSON.stringify({ ghi_chu: 'CÁCH 3: bản đồ độ cao thật (chụp độ sâu trực giao lưới ảnh 3D Google từ trên xuống, scripts/khop-khoi.mjs) + loại vật liệu mỗi ô (0 đá sáng · 1 gạch đỏ · 2 mái tối); null = ngoài lâu đài. Toạ độ cảnh, y so GOC_Y.', ...kq }) + '\n');
console.log(`cách 3: lưới ${kq.W} × ${kq.H} ô ${kq.B} m, ${kq.giu} ô lâu đài → ${du('cach3')}`);
