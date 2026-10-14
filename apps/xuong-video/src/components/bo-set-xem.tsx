'use client';
// 🧊 TRÌNH XEM BỘ SET 3D (anh 14/10/2026: "link map 3D lên đây để xoay, xem được không?"). Dựng lại ĐÚNG bộ set Blender dựng khung xám
// (scripts/bo-set/dung-set.py) từ cùng dữ liệu (xv_bo_set + khoi_3d + may_3d): kéo để xoay, cuộn để phóng, chuột phải để dời; "👁 Máy shot"
// nhìn qua đúng máy ảo của shot (cùng ống kính, khung 9:16 / 16:9). Mỗi shot: khối ở chỗ MỞ (đặc) + chỗ KẾT (mờ) nối bằng một vạch;
// "Đường đi" vẽ hành trình từng nhân vật cả tập (ngắt ở chỗ khai nhảy / đang được cầm, như mặt bằng); nón đỏ = máy của mọi shot, bấm để chọn.
// Toạ độ dữ liệu: cm, x phải, y sâu vào bàn, z lên → three: (x, z, −y).
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { boSet3dTap } from '@/lib/actions';
import type { BoSet, KhoiSet, May3d, NhanVat } from '@/lib/xuong-video/kieu';
import { goiAction, Loi, mono } from './ui';

type DuLieu = Extract<Awaited<ReturnType<typeof boSet3dTap>>, { ok: true }>['data'];
type Khoi = NonNullable<NhanVat['khoi_3d']>;
type Phan = Omit<KhoiSet, 'ten'> & { ten?: string; bac?: number };

const V = (p: number[]) => new THREE.Vector3(p[0] ?? 0, p[2] ?? 0, -(p[1] ?? 0));
const vatLieu = new Map<string, THREE.Material>();
function chat(mau: string, sang = 0, mo = 1): THREE.Material {
  const k = `${mau}|${sang}|${mo}`;
  if (!vatLieu.has(k)) vatLieu.set(k, new THREE.MeshStandardMaterial({ color: mau, roughness: 0.6, emissive: sang ? mau : '#000000', emissiveIntensity: sang ? Math.min(1, sang / 3) : 0, transparent: mo < 1, opacity: mo, depthWrite: mo >= 1 }));
  return vatLieu.get(k)!;
}

/** Một khối — cùng luật dung-set.py › khoi: tam = (x, y, z ĐÁY) tương đối gốc nhóm (quay theo xoay°), co = (rộng x, sâu y, cao z). */
function khoi(p: Phan, goc: number[] = [0, 0], xoay = 0, mo = 1): THREE.Object3D {
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
  else g = new THREE.SphereGeometry(0.5, 32, 16);
  const o = new THREE.Mesh(g, m);
  o.position.copy(V([gx, gy, cy])); o.scale.set(w, sy, dd); o.rotation.y = ((xoay + (p.xoay ?? 0)) * Math.PI) / 180;
  return o;
}

/** Nhân vật / đạo cụ ở một chỗ — cùng luật dung-set.py › nhan_vat: quay theo huong, có mắt nếu khối khai `mat`, nằm thì cao thành sâu. */
function nhanVat(k: Khoi & { mat?: boolean; phan?: Phan[]; sang?: number }, vt: { tam: number[]; huong?: number; nam?: boolean }, mo = 1): THREE.Group {
  const g = new THREE.Group();
  const [X, Y, Z] = [vt.tam[0]!, vt.tam[1]!, vt.tam[2] ?? 0];
  let [w, d, h] = k.co as [number, number, number];
  if (vt.nam) [d, h] = [h, d];
  const hg = vt.huong ?? 0;
  g.add(khoi({ hinh: k.hinh, co: [w, d, h], mau: k.mau, sang: k.sang, tam: [0, 0, Z] }, [X, Y], hg, mo));
  const phan: Phan[] = vt.nam ? [] : [...(k.phan ?? [])];
  if (k.mat) {
    const e = Math.max(0.3, 0.26 * Math.min(w, h)); const ex = 0.22 * w;
    const [ey, ez] = vt.nam ? [-d * 0.25, h - e * 0.3] : [-d / 2 + e * 0.15, h * 0.62 - e / 2];
    for (const sx of [-1, 1]) {
      phan.push({ hinh: 'cau', co: [e, e, e], mau: '#ffffff', tam: [sx * ex, ey, ez] });
      phan.push({ hinh: 'cau', co: [e * 0.5, e * 0.5, e * 0.5], mau: '#111111', tam: vt.nam ? [sx * ex, ey - e * 0.2, ez + e * 0.45] : [sx * ex, ey - e * 0.38, ez + e * 0.25] });
    }
  }
  for (const p of phan) g.add(khoi({ ...p, tam: [p.tam![0]!, p.tam![1]!, p.tam![2]! + Z] }, [X, Y], hg, mo));
  return g;
}

const nhan = (chu: string, mau = 'rgba(0,0,0,.65)') => {
  const el = document.createElement('span');
  el.textContent = chu; el.style.cssText = `font:10px ui-monospace,monospace;color:#fff;background:${mau};padding:0 4px;border-radius:3px;white-space:nowrap;pointer-events:none`;
  return new CSS2DObject(el);
};

export function BoSetXem({ tapId, canhId }: { tapId: number; canhId?: number | null }) {
  const [dl, setDl] = useState<DuLieu | null>(null);
  const [loi, setLoi] = useState('');
  const [chon, setChon] = useState<number | null>(canhId ?? null);
  const [quaMay, setQuaMay] = useState(!!canhId);
  const [duongDi, setDuongDi] = useState(false);
  const [coNhan, setCoNhan] = useState(true);
  const [moiMay, setMoiMay] = useState(true);
  const khung = useRef<HTMLDivElement>(null);
  const banh = useRef<{ dat: (s: { quaMay: boolean; chon: number | null }) => void } | null>(null);

  useEffect(() => { void (async () => { const { loi: l, kq } = await goiAction(() => boSet3dTap(tapId)); setLoi(l); if (kq?.ok) setDl(kq.data); })(); }, [tapId]);
  const shots = useMemo(() => (dl?.shots ?? []).filter((s) => s.set_id && s.may_3d), [dl]);
  const shot = shots.find((s) => s.id === chon) ?? null;
  const setId = shot?.set_id ?? shots[0]?.set_id ?? null;
  const set: BoSet | undefined = dl?.sets.find((x) => x.id === setId);
  const doc = dl?.ti_le !== '16:9';
  // Góc nhìn tự do giữ qua các lần dựng lại cảnh (bật/tắt nhãn, đường đi) — chỉ đặt lại khi đổi shot hoặc đổi chế độ máy.
  const goc = useRef<{ khoa: string; vt: THREE.Vector3; dich: THREE.Vector3 } | null>(null);

  // Dựng cảnh một lần cho mỗi (set, shot đang chọn, các bật/tắt) — bộ set nhỏ (vài trăm khối), dựng lại tức thì.
  useEffect(() => {
    const el = khung.current; if (!el || !dl || !set) return;
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const nhanR = new CSS2DRenderer(); nhanR.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    el.append(r.domElement, nhanR.domElement);
    const canh = new THREE.Scene(); canh.background = new THREE.Color('#3a3b44');
    canh.add(new THREE.HemisphereLight('#ffffff', '#5a4a3a', 1.6));
    const den = new THREE.DirectionalLight('#ffffff', 1.4); den.position.set(60, 120, 80); canh.add(den);
    const may = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
    const dk = new OrbitControls(may, r.domElement); dk.enableDamping = true;

    // Bộ set
    for (const v of set.du_lieu.vat) {
      const g = new THREE.Group();
      if ('phan' in v) for (const p of v.phan) g.add(khoi(p as Phan, v.goc, v.xoay ?? 0));
      else g.add(khoi(v as Phan));
      canh.add(g);
      if (coNhan && !v.nen) {
        const hop = new THREE.Box3().setFromObject(g); const l = nhan(v.ten); l.position.set((hop.min.x + hop.max.x) / 2, hop.max.y + 0.6, (hop.min.z + hop.max.z) / 2); canh.add(l);
      }
    }
    const kh = (t: string) => dl.khoi[t] as (Khoi & { mat?: boolean; phan?: Phan[] }) | undefined;
    // Shot đang chọn: chỗ MỞ đặc + chỗ KẾT mờ + vạch nối
    if (shot?.may_3d) for (const v of shot.may_3d.vi_tri) {
      const k = kh(v.ten); if (!k) continue;
      canh.add(nhanVat(k, v));
      if (coNhan) { const l = nhan(v.ten, 'rgba(220,38,38,.85)'); l.position.copy(V([v.tam[0]!, v.tam[1]!, (v.tam[2] ?? 0) + (k.co[2] ?? 2) + 1])); canh.add(l); }
      if (v.den) {
        canh.add(nhanVat(k, { tam: v.den, huong: v.huong_den ?? v.huong, nam: v.nam }, 0.35));
        canh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V([v.tam[0]!, v.tam[1]!, (v.tam[2] ?? 0) + 0.3]), V([v.den[0]!, v.den[1]!, (v.den[2] ?? 0) + 0.3])]), new THREE.LineBasicMaterial({ color: k.mau })));
      }
    }
    // Đường đi cả tập (cùng luật ngắt nét với mặt bằng)
    if (duongDi) {
      const doan = new Map<string, number[][][]>();
      for (const s of shots.filter((x) => x.set_id === set.id)) for (const v of s.may_3d!.vi_tri) {
        const dd = doan.get(v.ten) ?? [[]]; doan.set(v.ten, dd);
        if ((s.may_3d!.nhay || v.nhay || v.cam) && dd[dd.length - 1]!.length) dd.push([]);
        dd[dd.length - 1]!.push(v.tam, ...(v.den ? [v.den] : []));
      }
      for (const [ten, dd] of doan) for (const d of dd) if (d.length > 1) canh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(d.map((p) => V([p[0]!, p[1]!, 0.5]))), new THREE.LineBasicMaterial({ color: kh(ten)?.mau ?? '#ffffff' })));
    }
    // Nón máy của mọi shot (bấm để chọn)
    const non: THREE.Mesh[] = [];
    // Nhìn qua máy shot thì ẩn nón máy (nón của shot khác lọt vào khung như một vật lạ).
    if (moiMay && !(quaMay && shot)) for (const s of shots.filter((x) => x.set_id === set.id)) {
      const m = s.may_3d!; const o = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 12), chat(s.id === chon ? '#facc15' : '#ff2d55', 2));
      o.position.copy(V(m.dat)); o.lookAt(V(m.nhin)); o.rotateX(-Math.PI / 2); o.userData.id = s.id; canh.add(o); non.push(o);
      if (coNhan) { const l = nhan(`#${s.thu_tu}`, s.id === chon ? 'rgba(202,138,4,.9)' : 'rgba(0,0,0,.5)'); l.position.copy(V(m.dat)).add(new THREE.Vector3(0, 1.6, 0)); canh.add(l); }
    }
    const tia = new THREE.Raycaster(); let bam: { x: number; y: number } | null = null;
    const xuong = (e: PointerEvent) => { bam = { x: e.clientX, y: e.clientY }; };
    const len = (e: PointerEvent) => {
      if (!bam || Math.hypot(e.clientX - bam.x, e.clientY - bam.y) > 4) return;
      const b = r.domElement.getBoundingClientRect();
      tia.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), may);
      const t = tia.intersectObjects(non)[0]; if (t) { setChon(t.object.userData.id as number); setQuaMay(false); }
    };
    r.domElement.addEventListener('pointerdown', xuong); r.domElement.addEventListener('pointerup', len);

    const coKhung = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h); nhanR.setSize(w, h); may.aspect = w / h; may.updateProjectionMatrix(); };
    banh.current = {
      dat: ({ quaMay: qm, chon: c }) => {
        const s = shots.find((x) => x.id === c)?.may_3d as May3d | undefined;
        if (qm && s) {
          // Cùng ống kính với Blender (cảm biến 36 mm theo chiều dài hơn của khung).
          may.fov = (2 * Math.atan((doc ? 18 : 18 * 9 / 16) / s.ong_kinh) * 180) / Math.PI;
          may.position.copy(V(s.dat)); dk.target.copy(V(s.nhin));
        } else {
          may.fov = 40;
          const tam = s ? V(s.nhin) : new THREE.Vector3(0, 0, -55);
          dk.target.copy(tam); may.position.copy(tam.clone().add(new THREE.Vector3(30, 45, 70)));
        }
        may.updateProjectionMatrix(); dk.update();
      },
    };
    coKhung();
    const khoa = `${chon}|${quaMay}`;
    banh.current.dat({ quaMay, chon });
    if (goc.current?.khoa === khoa) { may.position.copy(goc.current.vt); dk.target.copy(goc.current.dich); dk.update(); }
    const ro = new ResizeObserver(coKhung); ro.observe(el);
    let raf = 0; const ve = () => { raf = requestAnimationFrame(ve); dk.update(); r.render(canh, may); nhanR.render(canh, may); }; ve();
    return () => {
      goc.current = { khoa, vt: may.position.clone(), dich: dk.target.clone() };
      cancelAnimationFrame(raf); ro.disconnect(); dk.dispose();
      r.domElement.removeEventListener('pointerdown', xuong); r.domElement.removeEventListener('pointerup', len);
      canh.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      r.dispose(); el.replaceChildren(); banh.current = null;
    };
  }, [dl, set, shot, chon, quaMay, duongDi, coNhan, moiMay, shots, doc]);

  const nut = (bat: boolean, chu: string, title: string, f: () => void) => <button type="button" className={`xv-btn${bat ? ' chinh' : ''}`} title={title} onClick={f}>{chu}</button>;
  if (loi) return <Loi>{loi}</Loi>;
  if (!dl) return <div style={mono}>… đang tải bộ set</div>;
  if (!set) return <div style={mono}>Tập này chưa có shot nào thuộc bộ set 3D.</div>;
  const iShot = shot ? shots.indexOf(shot) : -1;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{set.ten}</b>
        <select className="xv-in" value={chon ?? ''} onChange={(e) => setChon(e.target.value ? Number(e.target.value) : null)} style={{ maxWidth: 260 }}>
          <option value="">— toàn bộ set —</option>
          {shots.filter((s) => s.set_id === set.id).map((s) => <option key={s.id} value={s.id}>#{s.thu_tu}{s.ma ? ` · ${s.ma}` : ''} · {s.canh.slice(0, 40)}</option>)}
        </select>
        <button type="button" className="xv-btn" disabled={iShot <= 0} title="Shot trước" onClick={() => setChon(shots[iShot - 1]!.id)}>◀</button>
        <button type="button" className="xv-btn" disabled={iShot < 0 || iShot >= shots.length - 1} title="Shot sau" onClick={() => setChon(shots[iShot + 1]!.id)}>▶</button>
        {nut(quaMay, '👁 Máy shot', 'Nhìn qua đúng máy ảo của shot (cùng ống kính + khung như khung xám)', () => setQuaMay(!quaMay))}
        {nut(duongDi, '〰 Đường đi', 'Hành trình từng nhân vật cả tập (ngắt ở chỗ khai nhảy / đang được cầm)', () => setDuongDi(!duongDi))}
        {nut(coNhan, '🏷 Nhãn', 'Tên từng khối', () => setCoNhan(!coNhan))}
        {nut(moiMay, '🎥 Mọi máy', 'Nón máy của mọi shot — bấm một nón để chọn shot đó', () => setMoiMay(!moiMay))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: shot?.xam ? 'minmax(0, 1fr) 180px' : '1fr', gap: 8, alignItems: 'start' }}>
        <div ref={khung} style={{ position: 'relative', width: '100%', height: quaMay && shot ? undefined : '70vh', aspectRatio: quaMay && shot ? (doc ? '9 / 16' : '16 / 9') : undefined, maxHeight: '78vh', margin: quaMay && shot && doc ? '0 auto' : undefined, maxWidth: quaMay && shot && doc ? 'calc(78vh * 9 / 16)' : undefined, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)', cursor: 'grab' }} />
        {shot?.xam && <div style={{ display: 'grid', gap: 4 }}><span style={mono}>Khung xám (Blender)</span><img src={shot.xam} alt="" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--line)' }} /></div>}
      </div>
      <span style={mono}>Kéo = xoay · cuộn = phóng · chuột phải / hai ngón = dời · khối đặc = chỗ MỞ shot, khối mờ = chỗ KẾT · bấm nón đỏ để chọn shot</span>
    </div>
  );
}
