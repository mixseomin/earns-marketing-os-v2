#!/usr/bin/env node
// KHO GÓC NHÌN ẢNH 3D GOOGLE + ĐỘ SÂU (20/11/2026) — nửa "bản đồ" của việc định vị ảnh chụp không có GPS (nửa kia: scripts/khop-lg.py ghép điểm đặc trưng
// bằng LightGlue rồi giải camera bằng PnP). Đứng trên lưới điểm quanh một vùng (mắt 1,6 m trên đất thật, ngoài mọi khối nhà), mỗi điểm quay 6 hướng,
// vẽ RIÊNG lớp ảnh 3D Google: một ảnh màu + một ảnh độ sâu (khoảng cách dọc trục nhìn, đóng 24 bit vào RGB) + ma trận camera → mỗi điểm ảnh có toạ độ 3D.
//   node apps/castle/scripts/kho-goc-nhin.mjs <thư mục ra> <x0> <x1> <z0> <z1> [bước m = 9]
// tra-repo-ok: cùng ý "ảnh tham chiếu có độ sâu" của cvg/Hierarchical-Localization, nhưng ảnh tham chiếu ở đây dựng từ chính trang (three.js + 3d-tiles) — keo nội bộ.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { doiSo, moTrang } from './chung.mjs';
const [RA, X0, X1, Z0, Z1, BUOC = 9] = doiSo; if (!RA || Z1 === undefined) { console.error('dùng: kho-goc-nhin.mjs <thư mục> <x0> <x1> <z0> <z1> [bước]'); process.exit(1); }
mkdirSync(RA, { recursive: true });
const W = 1024, H = 768, FOV = 75, XA = 400;
const { pg, dong } = await moTrang({ anh3d: true, khung: { width: W, height: H } });
const diem = await pg.evaluate(([x0, x1, z0, z1, b]) => { const n = window.__ns, ra = [];
  const trong = (x, z, v) => { let t = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) t = !t; } return t; };
  const moc = n.matDat((x0 + x1) / 2, (z0 + z1) / 2);
  for (let x = x0; x <= x1; x += b) for (let z = z0; z <= z1; z += b) {
    if (n.TUONG_MT.some((t) => trong(x, z, t.v))) continue; // trong nhà
    const y = n.matDat(x, z); if (!Number.isFinite(y) || Math.abs(y - moc) > 12) continue; // vực / mái
    ra.push([x, +(y + 1.6).toFixed(2), z]);
  }
  return ra; }, [+X0, +X1, +Z0, +Z1, +BUOC]);
console.log(`${diem.length} điểm đứng × 6 hướng`);
await pg.evaluate(([W, H, XA]) => { const n = window.__ns, T = n.THREE;
  n.moSo(n.ANH.findIndex((a) => !a.khongDung)); // chế độ so ảnh = vòng vẽ của trang KHÔNG đụng camera (ns.js: "camera do thông số ảnh quyết")
  n.renderer.setPixelRatio(1); n.renderer.setSize(W, H); n.camera.aspect = W / H;
  // 20/11/2026: thiếu dòng tắt orbit → vòng vẽ của trang xoay camera về tâm lâu đài giữa lúc chờ tải ô: 6 hướng mỗi điểm đứng ra CÙNG một ảnh (khop-lg --tu-kiem bắt)
  const sau = new T.ShaderMaterial({ uniforms: { xa: { value: XA } }, side: T.DoubleSide,
    vertexShader: 'varying float vD; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'precision highp float; uniform float xa; varying float vD; void main() { float v = floor(clamp(vD / xa, 0.0, 1.0) * 16777215.0); float r = floor(v / 65536.0); float g = floor((v - r * 65536.0) / 256.0); float b = v - r * 65536.0 - g * 256.0; gl_FragColor = vec4(r / 255.0, g / 255.0, b / 255.0, 1.0); }' });
  const doc = () => { const gl = n.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), d = g.createImageData(w, h);
    for (let y = 0; y < h; y++) d.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); for (let i = 3; i < d.data.length; i += 4) d.data[i] = 255;
    g.putImageData(d, 0, 0); return c; };
  window.__gocNhin = async ([x, y, z], yaw, pitch, fov) => {
    const a3 = n.anh3d(), cam = n.camera; cam.position.set(x, y, z); cam.rotation.set(pitch, yaw, 0, 'YXZ'); cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    a3.goc.visible = true; const an = []; for (const o of n.scene.children) if (o !== a3.goc && !o.isLight && o.visible) { o.visible = false; an.push(o); }
    a3.t.setCamera(cam); a3.t.setResolutionFromRenderer(cam, n.renderer);
    for (let k = 0, on = 0; k < 80 && on < 4; k++) { a3.t.update(); n.renderer.render(n.scene, cam); await new Promise((r) => setTimeout(r, 100)); on = (a3.t.loadProgress ?? 1) >= 0.999 ? on + 1 : 0; }
    a3.t.update(); n.renderer.render(n.scene, cam); const mau = doc().toDataURL('image/jpeg', 0.93);
    const nen = n.scene.background, suong = n.scene.fog; n.scene.background = null; n.scene.fog = null; n.renderer.setClearColor(0x000000, 1); n.scene.overrideMaterial = sau;
    n.renderer.render(n.scene, cam); const ds = doc().toDataURL('image/png');
    n.scene.overrideMaterial = null; n.scene.background = nen; n.scene.fog = suong; for (const o of an) o.visible = true;
    cam.updateMatrixWorld(); const e = cam.matrixWorld.elements, yawThat = Math.atan2(e[8], e[10]), lech = Math.abs(((yawThat - yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (lech > 0.01 || Math.abs(Math.asin(-e[9]) - pitch) > 0.01) throw new Error(`camera bị trang xoay đi trong lúc chụp (hướng lệch ${lech.toFixed(2)} rad) — kho sẽ sai`);
    return { mau, sau: ds, m: Array.from(e) };
  };
}, [W, H, XA]);
const meta = []; const t0 = Date.now();
for (const [i, p] of diem.entries()) for (let h = 0; h < 6; h++) {
  const yaw = h * Math.PI / 3, r = await pg.evaluate(([p, yaw, fov]) => window.__gocNhin(p, yaw, 0.3, fov), [p, yaw, FOV]), ten = `g${String(i).padStart(3, '0')}-${h}`;
  writeFileSync(join(RA, ten + '.jpg'), Buffer.from(r.mau.split(',')[1], 'base64')); writeFileSync(join(RA, ten + '-sau.png'), Buffer.from(r.sau.split(',')[1], 'base64'));
  meta.push({ ten, p, yaw: +yaw.toFixed(4), pitch: 0.3, fov: FOV, w: W, h: H, xa: XA, m: r.m });
  if (h === 5 && i % 10 === 9) console.log(`  ${i + 1}/${diem.length} điểm · ${((Date.now() - t0) / 1000).toFixed(0)} giây`);
}
writeFileSync(join(RA, 'kho.json'), JSON.stringify(meta));
console.log(`ghi ${meta.length} góc nhìn → ${RA} · ${((Date.now() - t0) / 1000).toFixed(0)} giây`);
await dong();
