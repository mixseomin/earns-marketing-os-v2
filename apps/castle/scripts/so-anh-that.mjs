#!/usr/bin/env node
// SO MÔ HÌNH VỚI ẢNH THẬT ĐÚNG CAMERA (anh 21/11/2026: "từ 1 cái ảnh rồi xoay ra góc đó tự so sánh với ảnh và tìm điểm khác để sửa" · "làm thành chuẩn rồi áp dụng tiếp
// vào mặt tiếp theo. Mỗi lần làm xong thì luôn phải chụp trước sau, ảnh thật để xem hiệu quả"). Bước KIỂM của quy trình mặt tiền (QUY-TRINH.md mục 4b):
//   1. ảnh đã định vị trong <lâu>-do-anh.json (do-anh.mjs: LightGlue + PnP) → đặt camera trang đúng chỗ đứng / hướng / ngẩng / nghiêng / ống kính của ảnh
//   2. vẽ mô hình dựng (ảnh 3D Google TẮT) hai lượt: ảnh màu + ảnh độ sâu (24 bit) → mỗi điểm ảnh có toạ độ 3D → thuộc khối nào, mặt nào (khối#cạnh)
//   3. scripts/so-anh-that.py: viền trời ảnh ↔ viền mô hình (đoạn THIẾU / THỪA), nét ảnh ↔ nét mô hình theo từng mặt (tỉ lệ nét khớp), ảnh ghép chỉ chỗ lệch
//   4. --nhan sau: ghép ẢNH THẬT · TRƯỚC · SAU từng ảnh + bảng điểm từng mặt; SAU kém hơn TRƯỚC → mã thoát 1 (sửa làm hỏng chỗ khác)
//   node apps/castle/scripts/so-anh-that.mjs --khoi way/221599090[,…] [--nhan truoc|sau] [--anh <tệp,…>] [--ra <thư mục>]
//       --khoi  chọn mọi ảnh có camera nhìn thấy khối (tâm khối trong khung, ≤ 450 m); --anh chọn tay. Kết quả: apps/castle/.so-anh/<khối>/<nhãn>/
//       --dung  BƯỚC DỰNG: chi tiết THIẾU xác nhận (≥ 2 ảnh) ghi cộng dồn vào du-lieu/neuschwanstein-chi-tiet-do.json, mattien.js datChiTietDo dựng; chạy lại --nhan sau để thấy vòng khép
//   node apps/castle/scripts/so-anh-that.mjs --tu-kiem   bài kiểm có thể hỏng (so-anh-that.py --tu-kiem: mô hình so với chính nó phải khớp, dời 20 px phải ra lệch)
// tra-repo-ok: keo nội bộ — camera ảnh đo từ do-anh.mjs, đo bằng OpenCV; không thư viện nào so mô hình three.js của cảnh với ảnh chụp theo mặt OSM.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { GOC, PUB, LAU, du, doiSo, moTrang, nhip } from './chung.mjs';
const co = (c) => doiSo.includes(c), gt = (c) => { const k = doiSo.indexOf(c); return k < 0 ? null : doiSo[k + 1]; };
const PY = join(homedir(), '.venvs/castle-khop/bin/python'), PYS = join(GOC, 'scripts', 'so-anh-that.py');
if (co('--tu-kiem')) process.exit(spawnSync(PY, ['-W', 'ignore', PYS, '--tu-kiem'], { stdio: 'inherit' }).status);
const D = JSON.parse(readFileSync(join(PUB, 'du-lieu', `${LAU}.json`), 'utf8')), SO = JSON.parse(readFileSync(du('do-anh'), 'utf8')).anh;
// ảnh BỐ CỤC mặt tiền (<lâu>-mat-*.json, khối anh có camera PnP riêng): là ảnh đo hoa văn nên phải có trong mọi lượt so trước / sau — không chỉ ảnh của do-anh.json
for (const f of readdirSync(join(PUB, 'du-lieu')).filter((f) => f.startsWith(`${LAU}-mat-`) && f.endsWith('.json'))) {
  const a = JSON.parse(readFileSync(join(PUB, 'du-lieu', f), 'utf8')).anh, c = a?.camera; if (!c || !a.tep || SO[a.tep]) continue;
  SO[a.tep] = { x: c.x, z: c.z, camera: c, rong: a.rong, cao: a.cao, tacGia: a.tacGia, giayPhep: a.giayPhep, dung: 'bố cục ' + f, duong: join(GOC, a.tep) };
}
const duongAnh = (t) => SO[t]?.duong || join(PUB, 'du-lieu', t);
const KHOI = (gt('--khoi') || '').split(',').filter(Boolean), NHAN = gt('--nhan') || 'truoc';
if (!['truoc', 'sau'].includes(NHAN)) { console.error('--nhan truoc | sau'); process.exit(1); }
const tamKhoi = KHOI.map((id) => { const k = D.khoi.find((b) => b.id === id); if (!k) { console.error('không có khối ' + id); process.exit(1); } const v = k.ngoai[0]; return [v.reduce((a, p) => a + p[0], 0) / v.length, v.reduce((a, p) => a + p[1], 0) / v.length]; });
// ảnh thấy khối: tâm khối nằm trong góc ngang của khung (hướng nhìn three.js: −Z xoay theo yaw) và đủ gần
const thay = (a) => tamKhoi.some(([x, z]) => { const kc = Math.hypot(x - a.x, z - a.z), huong = Math.atan2(-(x - a.x), -(z - a.z)), nua = Math.atan(Math.tan(a.camera.fov * Math.PI / 360) * a.rong / a.cao);
  return kc < 450 && Math.abs(((huong - a.camera.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < nua * 0.9; });
const VIEC = (gt('--anh') ? gt('--anh').split(',') : Object.keys(SO).filter((t) => SO[t].camera && KHOI.length && thay(SO[t]))).filter((t) => SO[t]?.camera && existsSync(duongAnh(t))); // --anh chọn tay vẫn bỏ ảnh chưa định vị
if (!VIEC.length) { console.error('không ảnh nào có camera nhìn thấy ' + (KHOI.join(',') || '(chưa chọn --khoi / --anh)') + ' — định vị thêm ảnh: do-anh.mjs --khoi … [--vong]'); process.exit(1); }
const RA = gt('--ra') || join(GOC, '.so-anh', (KHOI.join('+') || 'anh').split('/').join('-')), THU = join(RA, NHAN); mkdirSync(THU, { recursive: true });
console.log(`${VIEC.length} ảnh có camera nhìn thấy ${KHOI.join(', ') || 'đã chọn'} → ${THU}`);
const XA = 2000, CAO = 900; // khung vẽ: cao 900 px, rộng theo tỉ lệ ảnh
const { pg, dong } = await moTrang({ anh3d: false, khung: { width: 1600, height: 1200 } });
await pg.waitForTimeout(5000); // lớp nền chạy sau (mặt tiền chi tiết, cảnh xa) — chờ xong mới vẽ
await pg.evaluate((XA) => { const n = window.__ns, T = n.THREE;
  n.moSo(n.ANH.findIndex((a) => !a.khongDung)); // chế độ so ảnh: vòng vẽ của trang không đụng camera
  for (const id of ['so', 'dau', 'nguon', 'bd', 'nut', 'so-anh']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  const sau = new T.ShaderMaterial({ uniforms: { xa: { value: XA } }, side: T.DoubleSide,
    vertexShader: 'varying float vD; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'precision highp float; uniform float xa; varying float vD; void main() { float v = floor(clamp(vD / xa, 0.0, 1.0) * 16777215.0); float r = floor(v / 65536.0); float g = floor((v - r * 65536.0) / 256.0); float b = v - r * 65536.0 - g * 256.0; gl_FragColor = vec4(r / 255.0, g / 255.0, b / 255.0, 1.0); }' });
  const phap = new T.MeshNormalMaterial({ side: T.DoubleSide });
  // MẶT NẠ VẬT CHE: vật liệu mang cờ userData.che (tranh tường, ban công — mattien.js) vẽ trắng, mọi thứ khác đen, cùng bộ đệm sâu → chỉ phần vật che THẤY ĐƯỢC.
  // Máy đo mặt (doc_mat.so) bỏ lỗ ảnh nằm sau vật che: mảng tối trong tranh / bóng ban công không phải cửa thiếu (21/11/2026 Palas #23)
  const CHE = [new T.MeshBasicMaterial({ color: 0x000000, side: T.DoubleSide }), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 })];
  const doc = () => { const gl = n.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), d = g.createImageData(w, h);
    for (let y = 0; y < h; y++) d.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); for (let i = 3; i < d.data.length; i += 4) d.data[i] = 255;
    g.putImageData(d, 0, 0); return c; };
  window.__veAnh = async ({ x, y, z, yaw, pitch, roll, fov, W, H }) => {
    n.renderer.setPixelRatio(1); n.renderer.setSize(W, H); const cam = n.camera; cam.aspect = W / H;
    // PnP đo độ cao camera kém nhất (ngẩng bù cho độ cao): người chụp không đứng TRONG đất. Mặt đứng được ngay trên camera (≤ 3 m) = camera chui dưới mặt
    // đứng được (ảnh XV: 0,75 m dưới sân trên → mặt sân cắt ngang khung thành dải xám) → đặt lên mặt đó + tầm mắt 1,6 m, ghi lại để biết ảnh nào đã nâng
    const tia = new T.Raycaster(new T.Vector3(x, y + 3, z), new T.Vector3(0, -1, 0), 0, 3); let nang = 0;
    const luoi = []; n.scene.traverseVisible((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData?.troi) luoi.push(o); }); // sprite / chim không dò được tia khi chưa có camera
    const cham = tia.intersectObjects(luoi, false).find((h) => h.object.visible && h.face && Math.abs(h.face.normal.clone().transformDirection(h.object.matrixWorld).y) > 0.5); // mặt đứng được: sàn, sân, sườn đồi dốc ≤ 60°
    if (cham) { nang = cham.point.y + 1.6 - y; y += nang; }
    cam.position.set(x, y, z); cam.rotation.set(pitch, yaw, roll, 'YXZ'); cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    for (let k = 0; k < 6; k++) { n.renderer.render(n.scene, cam); await new Promise((r) => setTimeout(r, 120)); } // vật nạp chậm theo khoảng cách (LOD) kịp hiện
    n.renderer.render(n.scene, cam); const mau = doc().toDataURL('image/jpeg', 0.92); // đọc NGAY sau lượt vẽ: qua một nhịp chờ là bộ đệm đã xoá (ảnh đen)
    const an = n.scene.children.filter((o) => o.visible && (o.userData?.troi || o.isSprite || o.isPoints)); for (const o of an) o.visible = false; // vòm trời, mây, chim: không phải mô hình
    const nen = n.scene.background, suong = n.scene.fog; n.scene.background = null; n.scene.fog = null; n.renderer.setClearColor(0x000000, 1); n.scene.overrideMaterial = sau;
    n.renderer.render(n.scene, cam); const ds = doc().toDataURL('image/png');
    n.scene.overrideMaterial = phap; n.renderer.render(n.scene, cam); const hinh = doc().toDataURL('image/png'); // màu pháp tuyến: hình khối không vân — chỉ để canh khung
    n.scene.overrideMaterial = null; const doi = []; n.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { doi.push([o, o.material]); o.material = CHE[[].concat(o.material).some((m) => m?.userData?.che) ? 1 : 0]; } });
    n.renderer.render(n.scene, cam); const che = doc().toDataURL('image/png'); for (const [o, m] of doi) o.material = m;
    n.scene.background = nen; n.scene.fog = suong; for (const o of an) o.visible = true;
    return { mau, sau: ds, hinh, che, m: Array.from(cam.matrixWorld.elements), nang };
  };
}, XA);
const ds = [];
for (const t of VIEC) {
  const a = SO[t], ten = t.split('/').pop().replace(/\.[a-z]+$/i, ''), H = CAO, W = Math.round(CAO * a.rong / a.cao);
  nhip(`vẽ ảnh ${ten}`); const r = await pg.evaluate((o) => window.__veAnh(o), { x: a.x, y: a.camera.y, z: a.z, yaw: a.camera.yaw, pitch: a.camera.pitch, roll: a.camera.roll, fov: a.camera.fov, W, H });
  writeFileSync(join(THU, `${ten}-mo-hinh.jpg`), Buffer.from(r.mau.split(',')[1], 'base64')); writeFileSync(join(THU, `${ten}-sau.png`), Buffer.from(r.sau.split(',')[1], 'base64')); writeFileSync(join(THU, `${ten}-hinh.png`), Buffer.from(r.hinh.split(',')[1], 'base64')); writeFileSync(join(THU, `${ten}-che.png`), Buffer.from(r.che.split(',')[1], 'base64'));
  ds.push({ ten, anh: duongAnh(t), tep: t, W, H, fov: a.camera.fov, xa: XA, m: r.m, tacGia: a.tacGia || '', giayPhep: a.giayPhep || '' });
  console.log(`   ${ten}: chỗ đứng (${a.x}, ${a.camera.y}, ${a.z}) · ống ${a.camera.fov}° · ${a.dung} điểm khớp${r.nang ? ` · camera dưới mặt đứng → nâng ${r.nang.toFixed(2)} m` : ''}`);
}
await dong();
writeFileSync(join(THU, 'ds.json'), JSON.stringify({ khoi: D.khoi.map((k) => ({ id: k.id, ten: k.ten || '', v: k.ngoai[0] })), chon: KHOI, ds }));
process.exit(spawnSync(PY, ['-W', 'ignore', PYS, RA, NHAN, ...(co('--dung') ? ['--dung'] : [])], { stdio: 'inherit' }).status); // --dung: bước dựng (sổ chi-tiet-do)
