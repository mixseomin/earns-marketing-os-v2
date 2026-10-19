// ĐO KHUNG TRÊN 3D SỐNG (anh 19/10/2026: "không dùng runpod nữa — dùng trực tiếp 3D thực để chấm điểm"): cùng các số Blender đo khi dựng khung
// (dung-set.py › nhin_thay + kiem_hinh_hoc) nhưng tính trên CẢNH three.js của shot (bo-set-three.ts — đúng cảnh ô 3D trên lưới vẽ), không render
// ảnh. Ra `thay` (lưới 27×48 tia: mỗi vật chiếm bao nhiêu % khung, hộp bao, có chắn tiền cảnh không) + `kiem` (mỗi người / món: tâm trong khung,
// cao bao nhiêu % khung, bị vật nào che — 9 tia). Mọi cổng / điểm đọc khung_xam (liền mạch, Murch, dẫn dắt, chủ thể, chữ lệch 3D…) chạy nguyên trên
// số này. Khác Blender: người là khối của khoi_3d (không có dáng mocap / MPFB) — đủ cho bố cục / che / cỡ, không đủ cho nét mặt. Thuần (three, không DB).
import * as THREE from 'three';
import { V, khoi, nhanVat, catLop, fovMay, type KhoiNv, type Phan } from './bo-set-three';
import { laKinh, vatHien, type BoSet, type KhungXam, type May3d, type VatThay } from './kieu';
import { chuThe } from './bo-set-3d';

const C = 27, R = 48;
type Kiem = KhungXam['kiem'][number];
const tenCua = (o: THREE.Object3D | null): THREE.Object3D | null => { let x = o; while (x && x.userData.ten == null) x = x.parent; return x; };

/** Đo một shot. may = máy ĐẦY ĐỦ (bo-set-3d.ts › mayDayDu — có đồ để lại), cùng máy cổng keyframe tính mã khung. */
export function do3dSong(set: Pick<BoSet, 'du_lieu'>, may: May3d, khoiCua: (ten: string) => KhoiNv | undefined, laNguoi: (ten: string) => boolean = () => false): Pick<KhungXam, 'thay' | 'kiem'> {
  const canh = new THREE.Scene();
  const vat = vatHien(set.du_lieu.vat, may.them);
  for (const v of vat) {
    const g = new THREE.Group();
    if ('phan' in v) for (const p of v.phan) g.add(khoi(p as Phan, v.goc, v.xoay ?? 0));
    else g.add(khoi(v as Phan));
    g.userData = { ten: v.ten, kinh: laKinh(v), nen: !!v.nen, en: (v as { en?: string }).en, nguoi: (v as { hinh?: string }).hinh === 'nguoi' };
    canh.add(g);
  }
  const vt = may.vi_tri.filter((v) => !v.an);
  for (const v of vt) { const k = khoiCua(v.ten); if (!k) continue; const g = nhanVat(k, v); g.userData = { ten: v.ten, nguoi: laNguoi(v.ten), cam: v.cam }; canh.add(g); }
  const cam = new THREE.PerspectiveCamera(fovMay(may.ong_kinh, true), 9 / 16, 0.2, 20000);
  cam.position.copy(V(may.dat)); cam.lookAt(V(may.nhin)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  catLop(canh, cam);
  // CẮT LỚP cả VÁCH (không chỉ mặt nền): vách mỏng nằm giữa máy và lòng phòng thì ẩn — máy đứng ngoài tường trước nhìn vào (tập 135 #22: 'Tường trước 100%')
  { const tam = canh.userData.tamPhong as THREE.Vector3 | undefined;
    if (tam) for (const o of canh.children) { if (!o.userData.ten || o.userData.nen || vt.some((v) => v.ten === o.userData.ten)) continue;
      const h = new THREE.Box3().setFromObject(o); const sz = h.getSize(new THREE.Vector3()); const ax = (['x', 'y', 'z'] as const).reduce((a, b) => (sz[a] <= sz[b] ? a : b));
      const dai = [sz.x, sz.y, sz.z].sort((a, b) => b - a); if (sz[ax] > 12 || dai[1]! < 150) continue;   // chỉ tấm vách lớn, mỏng
      const p = cam.position[ax]; if ((h.min[ax] + h.max[ax]) / 2 >= tam[ax] ? p < h.min[ax] : p > h.max[ax]) o.visible = false; } }
  // tia trúng CẢ MẶT TRONG (máy lọt trong khối người / vật — như Blender ray_cast): three mặc định chỉ trúng mặt ngoài → máy trong lòng Vivian vẫn "thấy rõ" (#14)
  canh.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined; for (const x of Array.isArray(m) ? m : m ? [m] : []) x.side = THREE.DoubleSide; });
  canh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  /** Tia đầu tiên trúng vật KHÔNG phải kính (kính: ghi riêng, tia đi xuyên — như dung-set.py › tia_qua_kinh). */
  const ban = (d: THREE.Vector3, xa = Infinity) => {
    ray.set(cam.position, d.clone().normalize()); ray.far = xa;
    const hs = ray.intersectObjects(canh.children, true).filter((h) => h.object.visible && tenCua(h.object)?.visible !== false && (h.object as THREE.Mesh).isMesh);
    const kinh = hs.find((h) => tenCua(h.object)?.userData.kinh); const tr = hs.find((h) => !tenCua(h.object)?.userData.kinh);
    return { tr, kinh };
  };
  // ── kiem: mỗi người / món của shot
  const hopCua = new Map<string, THREE.Box3>();
  for (const o of canh.children) if (o.userData.ten && vt.some((v) => v.ten === o.userData.ten)) hopCua.set(o.userData.ten, new THREE.Box3().setFromObject(o));
  const bb = new Set(chuThe(may));
  const chieu = (p: THREE.Vector3) => { const q = p.clone().project(cam); return { x: (q.x + 1) / 2, y: (1 - q.y) / 2, truoc: q.z < 1 && p.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) > 0 }; };
  const kiem: Kiem[] = [];
  for (const v of vt) {
    const h = hopCua.get(v.ten); if (!h) continue;
    const tam = h.getCenter(new THREE.Vector3());
    const goc = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? h.max.x : h.min.x, i & 2 ? h.max.y : h.min.y, i & 4 ? h.max.z : h.min.z));
    const diem = [tam, ...goc.map((c) => tam.clone().lerp(c, 0.7))];
    // NGƯỜI: thêm cột điểm dọc thân (gót → đỉnh đầu) — cận mặt chỉ đầu / ngực lọt khung; Blender xét tâm từng bộ phận (đầu, ngực, tay…)
    const doc = laNguoi(v.ten) ? [0.1, 0.3, 0.5, 0.7, 0.82, 0.92].map((f) => new THREE.Vector3(tam.x, h.min.y + (h.max.y - h.min.y) * f, tam.z)) : [];
    const che: Record<string, number> = {};
    for (const p of diem) {
      const d = p.clone().sub(cam.position); const { tr } = ban(d, d.length() - 0.05);
      const t = tenCua(tr?.object ?? null)?.userData.ten as string | undefined;
      if (!t || t === v.ten || (v.cam && t === v.cam)) continue;
      const cua = canh.children.find((o) => o.userData.ten === t)?.userData.cam;
      if (cua === v.ten) continue;   // món người này đang cầm che một phần thân: tự nhiên
      che[t] = (che[t] ?? 0) + 1;
    }
    const pd = diem.map(chieu); const pg = goc.map(chieu); const pc = doc.map(chieu);
    const laN = laNguoi(v.ten);
    // người: trong khung = một bộ phận lọt khung (đầu / ngực / tay…); món: tâm trong khung
    const trong = laN ? [...pd, ...pc].some((q) => q.truoc && q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1) : (() => { const q = pd[0]!; return q.truoc && q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1; })();
    const ys = pd.filter((q) => q.truoc).map((q) => Math.min(1, Math.max(0, q.y)));   // cao = 9 điểm (tâm + 70% về góc) như Blender, kẹp mép khung
    const kx = pg.map((q) => Math.min(1, Math.max(0, q.x))), ky = pg.map((q) => Math.min(1, Math.max(0, q.y)));
    kiem.push({ nhan_vat: v.ten, bat_buoc: bb.has(v.ten), trong_khung: trong, cao_khung_pt: ys.length ? Math.round((Math.max(...ys) - Math.min(...ys)) * 1000) / 10 : 0,
      bi_che_boi: Object.entries(che).filter(([, n]) => n > diem.length / 2).map(([t]) => t).sort(), khung: [Math.min(...kx), Math.min(...ky), Math.max(...kx), Math.max(...ky)].map((x) => Math.round(x * 1000) / 1000),
      ...({ tam: [Math.round(tam.x * 10) / 10, Math.round(-tam.z * 10) / 10, Math.round(tam.y * 10) / 10] } as object) } as Kiem);
  }
  // ── thay: lưới tia
  const chu = [...bb].map((t) => hopCua.get(t)).filter((x): x is THREE.Box3 => !!x);
  const kcChu = chu.length ? Math.min(...chu.map((h) => h.getCenter(new THREE.Vector3()).distanceTo(cam.position))) : Infinity;
  const dem = new Map<string, { n: number; u0: number; v0: number; u1: number; v1: number; gan: number; mat: number; o: THREE.Object3D }>();
  const kinh = new Map<string, { n: number; u0: number; v0: number; u1: number; v1: number; o: THREE.Object3D }>();
  const nd = new THREE.Vector2();
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const u = (i + 0.5) / C, w = (j + 0.5) / R; nd.set(u * 2 - 1, 1 - w * 2); ray.setFromCamera(nd, cam); ray.far = Infinity;
    const hs = ray.intersectObjects(canh.children, true).filter((h) => h.object.visible && (h.object as THREE.Mesh).isMesh);
    const k0 = hs[0] && tenCua(hs[0].object); if (k0?.userData.kinh) { const k = kinh.get(k0.userData.ten) ?? { n: 0, u0: 1, v0: 1, u1: 0, v1: 0, o: k0 }; k.n++; k.u0 = Math.min(k.u0, u); k.v0 = Math.min(k.v0, w); k.u1 = Math.max(k.u1, u); k.v1 = Math.max(k.v1, w); kinh.set(k0.userData.ten, k); }
    const h = hs.find((x) => !tenCua(x.object)?.userData.kinh); if (!h) continue;
    const g = tenCua(h.object)!; const t = g.userData.ten as string;
    const x = dem.get(t) ?? { n: 0, u0: 1, v0: 1, u1: 0, v1: 0, gan: Infinity, mat: 0, o: g };
    const nor = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3();
    x.n++; x.mat += nor.y > 0.75 ? 1 : 0; x.u0 = Math.min(x.u0, u); x.v0 = Math.min(x.v0, w); x.u1 = Math.max(x.u1, u); x.v1 = Math.max(x.v1, w); x.gan = Math.min(x.gan, h.distance); dem.set(t, x);
  }
  const hop = (x: { u0: number; v0: number; u1: number; v1: number }): [number, number, number, number] => [x.u0 - 0.5 / C, x.v0 - 0.5 / R, x.u1 + 0.5 / C, x.v1 + 0.5 / R].map((y) => Math.round(y * 1000) / 1000) as [number, number, number, number];
  const thay: VatThay[] = [];
  for (const [t, x] of dem) {
    const pt = Math.round((x.n * 1000) / (C * R)) / 10; if (pt < 0.5) continue;
    const ud = x.o.userData;
    thay.push({ ten: t, ...(ud.en ? { en: ud.en } : {}), ...(ud.nguoi || laNguoi(t) ? { nguoi: true } : {}), pt, hop: hop(x), tien: !bb.has(t) && !ud.nen && x.gan < kcChu * 0.8 && x.mat < 0.8 * x.n } as VatThay);
  }
  for (const [t, x] of kinh) { const pt = Math.round((x.n * 1000) / (C * R)) / 10; if (pt >= 0.5 && !dem.has(t)) thay.push({ ten: t, ...(x.o.userData.en ? { en: x.o.userData.en } : {}), pt, hop: hop(x), tien: false } as VatThay); }
  return { thay: thay.sort((a, b) => b.pt - a.pt), kiem };
}
