// Dựng bộ set 3D bằng three.js — MỘT chỗ cho trình xem đầy đủ (bo-set-xem.tsx) và ô 3D sống trên lưới (khung-3d-song.tsx).
// Cùng luật dung-set.py (Blender) để khung nhìn qua máy shot ở trình duyệt khớp khung xám. Toạ độ dữ liệu: cm, x phải, y sâu vào bàn, z lên → three: (x, z, −y).
import * as THREE from 'three';
import type { BoSet, KhoiSet, May3d, NhanVat } from './kieu';

export type Khoi = NonNullable<NhanVat['khoi_3d']>;
export type Phan = Omit<KhoiSet, 'ten'> & { ten?: string; bac?: number };
export type KhoiNv = Khoi & { mat?: boolean; phan?: Phan[]; sang?: number; dinh?: number };

export const V = (p: number[]) => new THREE.Vector3(p[0] ?? 0, p[2] ?? 0, -(p[1] ?? 0));
const vatLieu = new Map<string, THREE.Material>();
export function chat(mau: string, sang = 0, mo = 1): THREE.Material {
  const k = `${mau}|${sang}|${mo}`;
  if (!vatLieu.has(k)) vatLieu.set(k, new THREE.MeshStandardMaterial({ color: mau, roughness: 0.6, emissive: sang ? mau : '#000000', emissiveIntensity: sang ? Math.min(1, sang / 3) : 0, transparent: mo < 1, opacity: mo, depthWrite: mo >= 1 }));
  return vatLieu.get(k)!;
}

/** Lưới tấm khăn rủ (Mr. Wipe) — CÙNG công thức dung-set.py › khan_diem, đổi sang toạ độ three (lên = y, sâu dữ liệu = −z), tâm ở giữa khối. */
const khoKhan = new Map<number, THREE.BufferGeometry>();
export function khanHinh(wd: number, NT = 56, NV = 26): THREE.BufferGeometry {
  const khoa = Math.round(wd * 100); const co = khoKhan.get(khoa); if (co) return co.clone();
  const p: number[] = []; const ix: number[] = [];
  for (let j = 0; j <= NV; j++) {
    const t = j / NV;
    const f = t < 0.32 ? Math.sqrt(Math.max(0, 1 - (1 - t / 0.32) ** 2)) * 0.56 : 0.56 + 0.44 * ((t - 0.32) / 0.68) ** 1.5;
    const k = wd + (1 - wd) * t;
    for (let i = 0; i < NT; i++) {
      const g = (2 * Math.PI * i) / NT; let z = 1 - t;
      if (t > 0.62) { const q = ((t - 0.62) / 0.38) ** 2; z -= q * (0.13 * Math.abs(Math.cos(2 * g)) ** 4 + 0.025 * Math.sin(11 * g)); }
      p.push(0.5 * f * Math.cos(g), Math.max(0, z) - 0.5, -0.5 * f * k * Math.sin(g));
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NT; i++) { const a = j * NT + i, b = j * NT + ((i + 1) % NT); ix.push(a, b + NT, b, a, a + NT, b + NT); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
  khoKhan.set(khoa, g); return g.clone();
}

/** Một khối — cùng luật dung-set.py › khoi: tam = (x, y, z ĐÁY) tương đối gốc nhóm (quay theo xoay°), co = (rộng x, sâu y, cao z). */
/** MA-NƠ-CANH NGƯỜI (khoi_3d.hinh 'nguoi', phim người thật) — cùng tỉ lệ nhân trắc với Blender (scripts/bo-set/mesh/nguoi.py › TL): các khối elip
 *  hông, bụng, ngực, cổ, đầu, tay, chân; đáy giữa ở (0,0,0) dữ liệu, mặt nhìn −y. Trước 17/10/2026 trình xem vẽ viên nhộng.
 *  ngoi = tư thế ngồi của nguoi.py › tu_the('ngoi'): hông hạ xuống cẳng chân + bàn chân, đùi nằm ngang ra trước, cẳng tay đặt ra trước
 *  (người phụ ngồi bàn / ghế họp của bộ set — anh 17/10/2026 "bối cảnh sơ sài, AI bịa"). */
const TL = { chan: 0.039, cang: 0.246, dui: 0.245, hong: 0.1, bung: 0.1, nguc: 0.13, co: 0.052, dau: 0.13, vai: 0.129, tay_tren: 0.186, tay_duoi: 0.146, ban_tay: 0.108, hong_rong: 0.095 };
function nguoiThree(H: number, da: string, ao: string, mo: number, ngoi = false): THREE.Group {
  const L = Object.fromEntries(Object.entries(TL).map(([k, v]) => [k, v * H])) as typeof TL;
  const g = new THREE.Group();
  const k = (x: number, y: number, z0: number, w: number, d: number, c: number, mau: string) => g.add(khoi({ hinh: 'cau', co: [w, d, c], tam: [x, y, z0], mau }, [0, 0], 0, mo));
  const e = (x: number, z0: number, rx: number, ry: number, dai: number, mau: string, y = 0) => k(x, y, z0, rx * 2, ry * 2, dai, mau);
  const zH = ngoi ? L.chan + L.cang : L.chan + L.cang + L.dui;
  for (const s of [-1, 1]) {
    const x = s * L.hong_rong * 0.55;
    if (ngoi) {
      k(x, -L.dui - 0.02 * H, L.chan * 0.2, 0.052 * H, 0.08 * H, L.chan * 1.1, ao);   // bàn chân dưới gối
      k(x, -L.dui, L.chan, 0.068 * H, 0.068 * H, L.cang, ao); k(x, -L.dui / 2, zH - 0.045 * H, 0.09 * H, L.dui, 0.09 * H, ao);   // cẳng đứng · đùi ngang
    } else {
      e(x, L.chan * 0.2, 0.026 * H, 0.04 * H, L.chan * 1.1, ao, -0.02 * H);   // bàn chân (mũi ra trước)
      e(x, L.chan, 0.034 * H, 0.034 * H, L.cang, ao); e(x, L.chan + L.cang, 0.045 * H, 0.045 * H, L.dui, ao);
    }
    const xv = s * L.vai, zv = zH + L.bung + L.nguc * 0.88;
    e(xv * 1.02, zv - L.tay_tren, 0.03 * H, 0.03 * H, L.tay_tren, ao);
    if (ngoi) {   // cẳng tay + bàn tay đặt ra trước (lên đùi / mặt bàn)
      k(xv * 1.04, -L.tay_duoi / 2, zv - L.tay_tren - 0.024 * H, 0.048 * H, L.tay_duoi, 0.048 * H, da);
      k(xv * 1.05, -L.tay_duoi - L.ban_tay / 2, zv - L.tay_tren - 0.018 * H, 0.036 * H, L.ban_tay, 0.02 * H, da);
    } else {
      e(xv * 1.04, zv - L.tay_tren - L.tay_duoi, 0.024 * H, 0.024 * H, L.tay_duoi, da);
      e(xv * 1.05, zv - L.tay_tren - L.tay_duoi - L.ban_tay, 0.018 * H, 0.01 * H, L.ban_tay, da);
    }
  }
  e(0, zH - L.hong * 0.6, L.hong_rong * 1.05, 0.1 * H, L.hong, ao); e(0, zH, 0.085 * H, 0.06 * H, L.bung, ao); e(0, zH + L.bung, 0.11 * H, 0.068 * H, L.nguc, ao);
  e(0, zH + L.bung + L.nguc, 0.03 * H, 0.03 * H, L.co, da); e(0, zH + L.bung + L.nguc + L.co, 0.046 * H, 0.056 * H, L.dau, da);
  e(0, zH + L.bung + L.nguc + L.co + L.dau * 0.38, 0.008 * H, 0.012 * H, 0.02 * H, da, -0.05 * H);   // mũi: chỉ hướng mặt
  return g;
}

export function khoi(p: Phan, goc: number[] = [0, 0], xoay = 0, mo = 1): THREE.Object3D {
  if (p.hinh === 'nguoi') {
    const a0 = (xoay * Math.PI) / 180; const [x0, y0, z0] = [p.tam?.[0] ?? 0, p.tam?.[1] ?? 0, p.tam?.[2] ?? 0];
    const n = nguoiThree(p.co?.[2] ?? 170, p.mau, p.ao ?? p.mau, mo, p.tu_the === 'ngoi');
    n.position.copy(V([goc[0]! + x0 * Math.cos(a0) - y0 * Math.sin(a0), goc[1]! + x0 * Math.sin(a0) + y0 * Math.cos(a0), z0])); n.rotation.y = ((xoay + (p.xoay ?? 0)) * Math.PI) / 180;
    return n;
  }
  const m = chat(p.mau, p.sang ?? 0, mo);
  if (p.hinh === 'day') {
    const d = (p.diem ?? []).map(V);
    const duong = p.bac === 1 ? new THREE.CurvePath<THREE.Vector3>() : new THREE.CatmullRomCurve3(d);
    if (duong instanceof THREE.CurvePath) for (let i = 1; i < d.length; i++) duong.add(new THREE.LineCurve3(d[i - 1]!, d[i]!));
    return new THREE.Mesh(new THREE.TubeGeometry(duong as THREE.Curve<THREE.Vector3>, Math.max(16, d.length * 12), p.ban_kinh ?? 0.3, 8, false), m);
  }
  const [x, y, z] = [p.tam?.[0] ?? 0, p.tam?.[1] ?? 0, p.tam?.[2] ?? 0]; const [w, dd, c] = [p.co?.[0] ?? 1, p.co?.[1] ?? 1, p.co?.[2] ?? 1];
  const a = (xoay * Math.PI) / 180;
  const gx = goc[0]! + x * Math.cos(a) - y * Math.sin(a), gy = goc[1]! + x * Math.sin(a) + y * Math.cos(a);
  let g: THREE.BufferGeometry; let cy = z + c / 2; let sy = c;
  if (p.hinh === 'hop') g = new THREE.BoxGeometry(1, 1, 1);
  else if (p.hinh === 'vom') { g = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); cy = z; sy = c * 2; }
  else if (p.hinh === 'khan') { g = khanHinh(w / (dd || 1)); }   // tấm khăn rủ: đơn vị tâm ở giữa khối như hộp
  else if (p.hinh === 'non') g = new THREE.CylinderGeometry(0.5 * (p.dinh ?? 0.4), 0.5, 1, 40);   // nón cụt: thân khăn rủ Mr. Wipe
  else g = new THREE.SphereGeometry(0.5, 32, 16);
  const o = new THREE.Mesh(g, m);
  // Nghiêng quanh trục x của khối TRƯỚC rồi mới xoay quanh trục đứng (như Blender Euler XYZ) → thứ tự 'YXZ' của three.
  o.position.copy(V([gx, gy, cy])); o.scale.set(w, sy, dd); o.rotation.order = 'YXZ'; o.rotation.y = ((xoay + (p.xoay ?? 0)) * Math.PI) / 180; o.rotation.x = ((p.nghieng ?? 0) * Math.PI) / 180;
  return o;
}

/** Nhân vật / đạo cụ ở một chỗ — cùng luật dung-set.py › nhan_vat: quay theo huong, có mắt nếu khối khai `mat`. NẰM = dựng người đứng đủ tay /
 *  chân / tóc rồi ngửa ra sau 90° quanh trục ngang của nó (dung-set.py › nam_xuong) — không còn cắt bỏ các phần. */
export function nhanVat(k: KhoiNv, vt: { tam: number[]; huong?: number; nam?: boolean }, mo = 1): THREE.Group {
  const [X, Y, Z] = [vt.tam[0]!, vt.tam[1]!, vt.tam[2] ?? 0];
  const [w, d, h] = k.co as [number, number, number];
  const trong = new THREE.Group();   // người đứng, đáy giữa ở gốc, mặt nhìn −y dữ liệu
  trong.add(khoi({ hinh: k.hinh, co: [w, d, h], mau: k.mau, sang: k.sang, dinh: k.dinh, tam: [0, 0, 0], ...((k as KhoiNv & { ao?: string }).ao ? { ao: (k as KhoiNv & { ao?: string }).ao } : {}) } as Phan, [0, 0], 0, mo));
  const phan: Phan[] = [...(k.phan ?? [])];
  if (k.mat) {
    const e = Math.max(0.3, 0.26 * Math.min(w, h)); const ex = 0.22 * w; const [ey, ez] = [-d / 2 + e * 0.15, h * 0.62 - e / 2];
    for (const sx of [-1, 1]) {
      phan.push({ hinh: 'cau', co: [e, e, e], mau: '#ffffff', tam: [sx * ex, ey, ez] });
      phan.push({ hinh: 'cau', co: [e * 0.5, e * 0.5, e * 0.5], mau: '#111111', tam: [sx * ex, ey - e * 0.38, ez + e * 0.25] });
    }
  }
  for (const p of phan) trong.add(khoi(p, [0, 0], 0, mo));
  if (vt.nam) { trong.rotation.x = -Math.PI / 2; trong.position.set(0, d / 2, h / 2); }   // mặt trước (+z three) ngửa lên, thân nằm giữa chỗ đứng
  const g = new THREE.Group(); g.add(trong);
  g.position.copy(V([X, Y, Z])); g.rotation.y = ((vt.huong ?? 0) * Math.PI) / 180;
  return g;
}

/** Nhãn tên: bên gọi tự quyết vẽ thế nào (CSS2D ở trình xem; ô lưới không vẽ). */
export type GanNhan = (chu: string, mau: string, viTri: THREE.Vector3) => void;

/** Cảnh của MỘT shot: đèn + bộ set (đồ tuỳ chọn theo may.them) + nhân vật/đạo cụ chỗ MỞ (đặc) và chỗ KẾT (mờ, nối vạch).
 *  may = null → toàn set, đồ tuỳ chọn hiện mờ. */
export function dungCanhShot(set: BoSet, khoiCua: (ten: string) => KhoiNv | undefined, may: May3d | null, nhan?: GanNhan): THREE.Scene {
  const canh = new THREE.Scene(); canh.background = new THREE.Color('#3a3b44');
  canh.add(new THREE.HemisphereLight('#ffffff', '#5a4a3a', 1.6));
  const den = new THREE.DirectionalLight('#ffffff', 1.4); den.position.set(60, 120, 80); canh.add(den);
  const them = new Set(may?.them ?? []);
  for (const v of set.du_lieu.vat) {
    if (v.tuy_chon && may && !them.has(v.ten)) continue;
    const mo = v.tuy_chon && !may ? 0.35 : 1;
    const g = new THREE.Group();
    if ('phan' in v) for (const p of v.phan) g.add(khoi(p as Phan, v.goc, v.xoay ?? 0, mo));
    else g.add(khoi(v as Phan, undefined, 0, mo));
    if (v.nen) g.userData.nen = true;
    canh.add(g);
    if (nhan && !v.nen) { const hop = new THREE.Box3().setFromObject(g); nhan(v.tuy_chon ? `${v.ten} (tuỳ chọn)` : v.ten, 'rgba(0,0,0,.65)', new THREE.Vector3((hop.min.x + hop.max.x) / 2, hop.max.y + 0.6, (hop.min.z + hop.max.z) / 2)); }
  }
  if (may) for (const v of may.vi_tri) {
    const k = khoiCua(v.ten); if (!k) continue;
    canh.add(nhanVat(k, v));
    if (nhan) nhan(v.ten, 'rgba(220,38,38,.85)', V([v.tam[0]!, v.tam[1]!, (v.tam[2] ?? 0) + (k.co[2] ?? 2) + 1]));
    if (v.den) {
      canh.add(nhanVat(k, { tam: v.den, huong: v.huong_den ?? v.huong, nam: v.nam }, 0.35));
      canh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V([v.tam[0]!, v.tam[1]!, (v.tam[2] ?? 0) + 0.3]), V([v.den[0]!, v.den[1]!, (v.den[2] ?? 0) + 0.3])]), new THREE.LineBasicMaterial({ color: k.mau })));
    }
  }
  return canh;
}

/** CẮT LỚP (cutaway — trường quay tháo trần / vách cho máy đứng ngoài nhìn vào; anh 17/10/2026 thêm trần + tường trước cho bộ set tổng tài
 *  "để AI không bịa" thì góc xem tổng bị trần che kín): mặt nền (nen — tường, trần, sàn, mặt bàn) nằm GIỮA máy xem và lòng phòng thì ẩn,
 *  theo trục mỏng nhất của nó. Máy shot đứng trong phòng → không ẩn gì, khung khớp Blender. MỌI chỗ vẽ gọi trước render. */
export function catLop(canh: THREE.Scene, may: THREE.Camera): void {
  const nen = canh.children.filter((o) => o.userData.nen);
  if (!canh.userData.tamPhong) {
    const h = new THREE.Box3(); for (const o of nen) { o.userData.hop = new THREE.Box3().setFromObject(o); h.union(o.userData.hop); }
    canh.userData.tamPhong = h.isEmpty() ? new THREE.Vector3() : h.getCenter(new THREE.Vector3());
  }
  const tam = canh.userData.tamPhong as THREE.Vector3;
  for (const o of nen) {
    const h = o.userData.hop as THREE.Box3; const s = h.getSize(new THREE.Vector3());
    const ax = s.x <= s.y && s.x <= s.z ? 'x' : s.y <= s.z ? 'y' : 'z';
    const p = may.position[ax];
    o.visible = (h.min[ax] + h.max[ax]) / 2 >= tam[ax] ? p < h.min[ax] : p > h.max[ax];
  }
}

/** Góc nhìn dọc (độ) của máy shot — cùng ống kính với Blender (cảm biến 36 mm theo chiều dài hơn của khung). */
export const fovMay = (ongKinh: number, doc: boolean) => (2 * Math.atan((doc ? 18 : 18 * 9 / 16) / ongKinh) * 180) / Math.PI;

/** Giải phóng hình học của một cảnh (vật liệu dùng chung, không huỷ). */
export function huyCanh(canh: THREE.Scene) { canh.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose(); }); }
