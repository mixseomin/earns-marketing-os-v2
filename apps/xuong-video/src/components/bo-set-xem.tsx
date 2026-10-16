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
import { boSet3dTap, boSet3dSet } from '@/lib/actions';
import { moNgan } from './ngan-chung';
import type { BoSet, May3d } from '@/lib/xuong-video/kieu';
import { V, catLop, chat, dungCanhShot, fovMay, huyCanh, type KhoiNv } from '@/lib/xuong-video/bo-set-three';
import { goiAction, Loi, mono } from './ui';
import { Chon } from './chon';

type DuLieu = Extract<Awaited<ReturnType<typeof boSet3dTap>>, { ok: true }>['data'];

const nhan = (chu: string, mau = 'rgba(0,0,0,.65)') => {
  const el = document.createElement('span');
  el.textContent = chu; el.style.cssText = `font:10px ui-monospace,monospace;color:#fff;background:${mau};padding:0 4px;border-radius:3px;white-space:nowrap;pointer-events:none`;
  return new CSS2DObject(el);
};

/** gon: bản nhúng trong ngăn chi tiết shot (#1365) — chỉ khung 3D nhìn qua máy shot, xoay / phóng được, không thanh công cụ; nút ⤢ mở bản đầy đủ. */
/** setId: xem THEO BỘ SET (thẻ bối cảnh › 🧊 Xem 3D) thay vì theo tập. */
export function BoSetXem({ tapId, setId: setTheo, canhId, gon }: { tapId?: number; setId?: number; canhId?: number | null; gon?: boolean }) {
  const [dl, setDl] = useState<DuLieu | null>(null);
  const [loi, setLoi] = useState('');
  const [chon, setChon] = useState<number | null>(canhId ?? null);
  const [quaMay, setQuaMay] = useState(!!canhId);
  const [duongDi, setDuongDi] = useState(false);
  const [coNhan, setCoNhan] = useState(true);
  const [moiMay, setMoiMay] = useState(true);
  const khung = useRef<HTMLDivElement>(null);
  const banh = useRef<{ dat: (s: { quaMay: boolean; chon: number | null }) => void } | null>(null);

  useEffect(() => { void (async () => { const { loi: l, kq } = await goiAction(() => (setTheo ? boSet3dSet(setTheo) : boSet3dTap(tapId ?? 0))); setLoi(l); if (kq?.ok) setDl(kq.data); })(); }, [tapId, setTheo]);
  const shots = useMemo(() => (dl?.shots ?? []).filter((s) => s.set_id && s.may_3d), [dl]);
  const shot = shots.find((s) => s.id === chon) ?? null;
  // Tập nhiều bối cảnh (phim tổng tài: văn phòng / thang máy / phòng họp) — chọn bộ set để tham quan, kể cả khi chưa có shot nào đứng trên nó.
  const [setXem, setSetXem] = useState<number | null>(null);
  const setId = shot?.set_id ?? setXem ?? shots[0]?.set_id ?? dl?.sets[0]?.id ?? null;
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
    const may = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
    const dk = new OrbitControls(may, r.domElement); dk.enableDamping = true;
    const kh = (t: string) => dl.khoi[t] as KhoiNv | undefined;
    // Bộ set + shot đang chọn (chỗ MỞ đặc, chỗ KẾT mờ) — cùng bộ dựng với ô 3D trên lưới (bo-set-three.ts).
    const nhanCho: CSS2DObject[] = [];
    const canh = dungCanhShot(set, kh, shot?.may_3d ?? null, coNhan ? (chu, mau, vt) => { const l = nhan(chu, mau); l.position.copy(vt); nhanCho.push(l); } : undefined);
    for (const l of nhanCho) canh.add(l);
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
          may.fov = fovMay(s.ong_kinh, doc);
          may.position.copy(V(s.dat)); dk.target.copy(V(s.nhin));
        } else {
          may.fov = 40;
          // Góc tự do lùi theo CỠ bộ set (bàn Tango ~1,5 m ↔ văn phòng tổng tài 12 × 14 m): trước đây cố định cách tâm ~90 cm → bộ set cỡ
          // người máy đứng sát sàn, không thấy gì (17/10/2026).
          const hop = new THREE.Box3();
          hop.setFromObject(canh);
          const co = hop.isEmpty() ? 120 : Math.max(hop.max.x - hop.min.x, hop.max.z - hop.min.z);
          const tam = s ? V(s.nhin) : hop.isEmpty() ? new THREE.Vector3(0, 0, -55) : hop.getCenter(new THREE.Vector3()).setY(hop.min.y + Math.min(60, (hop.max.y - hop.min.y) / 3));
          const lui = Math.max(1, co / 120);
          dk.target.copy(tam); may.position.copy(tam.clone().add(new THREE.Vector3(30, 45, 70).multiplyScalar(lui)));
        }
        may.updateProjectionMatrix(); dk.update();
      },
    };
    coKhung();
    const khoa = `${chon}|${quaMay}`;
    banh.current.dat({ quaMay, chon });
    if (goc.current?.khoa === khoa) { may.position.copy(goc.current.vt); dk.target.copy(goc.current.dich); dk.update(); }
    const ro = new ResizeObserver(coKhung); ro.observe(el);
    let raf = 0; const ve = () => { raf = requestAnimationFrame(ve); dk.update(); catLop(canh, may); r.render(canh, may); nhanR.render(canh, may); }; ve();
    return () => {
      goc.current = { khoa, vt: may.position.clone(), dich: dk.target.clone() };
      cancelAnimationFrame(raf); ro.disconnect(); dk.dispose();
      r.domElement.removeEventListener('pointerdown', xuong); r.domElement.removeEventListener('pointerup', len);
      huyCanh(canh);
      r.dispose(); el.replaceChildren(); banh.current = null;
    };
  }, [dl, set, shot, chon, quaMay, duongDi, coNhan, moiMay, shots, doc]);

  const nut = (bat: boolean, chu: string, title: string, f: () => void) => <button type="button" className={`xv-btn${bat ? ' chinh' : ''}`} title={title} onClick={f}>{chu}</button>;
  if (loi) return <Loi>{loi}</Loi>;
  if (!dl) return <div style={mono}>… đang tải bộ set</div>;
  if (!set) return <div style={mono}>Tập này chưa có shot nào thuộc bộ set 3D.</div>;
  const iShot = shot ? shots.indexOf(shot) : -1;
  if (gon) return (
    <div style={{ display: 'grid', gap: 3 }}>
      <div ref={khung} style={{ position: 'relative', width: '100%', aspectRatio: quaMay && shot ? (doc ? '9 / 16' : '16 / 9') : '1 / 1', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)', cursor: 'grab' }} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...mono, fontSize: 9.5 }}>kéo xoay · cuộn phóng</span>
        <span style={{ display: 'flex', gap: 3 }}>
          {nut(quaMay, '👁', 'Nhìn qua máy shot / nhìn tự do', () => setQuaMay(!quaMay))}
          <button type="button" className="xv-btn" title="Mở bộ xem 3D đầy đủ (đường đi, mọi máy, nhãn)" onClick={() => moNgan(setTheo ? { loai: 'bo-set', setId: setTheo } : { loai: 'bo-set', tapId: tapId ?? 0, canhId: chon })}>⤢</button>
        </span>
      </div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {(dl?.sets.length ?? 0) > 1
          ? <Chon value={String(set.id)} onChange={(v) => { setSetXem(Number(v)); if (shot && shot.set_id !== Number(v)) setChon(null); }} minWidth={200}
              options={dl!.sets.map((x) => ({ value: String(x.id), label: `🧊 ${x.ten}`, title: x.mo_ta }))} />
          : <b style={{ fontSize: 13 }}>{set.ten}</b>}
        <Chon value={chon == null ? '' : String(chon)} onChange={(v) => setChon(v ? Number(v) : null)} minWidth={260}
          options={[{ value: '', label: '— toàn bộ set —' }, ...shots.filter((s) => s.set_id === set.id).map((s) => ({ value: String(s.id), label: `#${s.thu_tu}${s.ma ? ` · ${s.ma}` : ''} · ${s.canh.slice(0, 40)}`, ngan: `#${s.thu_tu}${s.ma ? ` · ${s.ma}` : ''}`, title: s.canh }))]} />
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
