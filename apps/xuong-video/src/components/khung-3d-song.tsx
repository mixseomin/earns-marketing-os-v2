'use client';
// Ô 3D SỐNG trên lưới (anh 15/10/2026: "làm góc 3D thật đi — đang thấy không liền mạch, vẫn là bản cũ"). Thay ảnh JPG render Blender bằng khung
// three.js dựng từ chính bộ set + may_3d HIỆN TẠI của shot (cùng bộ dựng với trình xem đầy đủ, bo-set-three.ts): dời máy là ô đổi ngay, không chờ
// render lại trên iMac. Lưới có hàng chục ô mà trình duyệt chỉ cho ~16 WebGL context → MỘT bộ vẽ dùng chung, mỗi ô là canvas 2D chép kết quả.
// Kéo trong ô = xoay quanh điểm nhìn của máy, nhấp đúp = về máy shot, bấm (không kéo) = mở trình xem đầy đủ. Ảnh Blender vẫn là ảnh gửi mô hình.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { boSet3dTap } from '@/lib/actions';
import { V, catLop, dungCanhShot, fovMay, huyCanh, type KhoiNv } from '@/lib/xuong-video/bo-set-three';
import type { May3d } from '@/lib/xuong-video/kieu';

type DuLieu = Extract<Awaited<ReturnType<typeof boSet3dTap>>, { ok: true }>['data'];
// Bộ set + khối nhân vật: một lần mỗi tập cho cả lưới (máy của shot lấy từ thẻ — luôn mới).
const kho = new Map<number, Promise<DuLieu | null>>();
const taiTap = (tapId: number) => {
  if (!kho.has(tapId)) kho.set(tapId, boSet3dTap(tapId).then((k) => (k.ok ? k.data : null)).catch(() => { kho.delete(tapId); return null; }));
  return kho.get(tapId)!;
};

let veChung: THREE.WebGLRenderer | null = null;
const boVe = () => (veChung ??= new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));

/** Góc xoay quanh điểm nhìn: lệch ngang / dọc (rad) so với máy shot. */
type Lech = { ngang: number; doc: number };

/** children: chip / thẻ nổi luôn hiện; nhanKhoi: nhãn tên khối đo theo máy shot — chỉ hiện khi chưa xoay. */
export function Khung3DSong({ tapId, setId, may, doc, children, nhanKhoi, onMo }: { tapId: number; setId: number; may: May3d; doc: boolean; children?: ReactNode; nhanKhoi?: ReactNode; onMo: () => void }) {
  const hop = useRef<HTMLDivElement>(null);
  const ve = useRef<HTMLCanvasElement>(null);
  const [dl, setDl] = useState<DuLieu | null>(null);
  const [thay, setThay] = useState(false);
  const [lech, setLech] = useState<Lech>({ ngang: 0, doc: 0 });
  const canh = useRef<THREE.Scene | null>(null);

  // Chỉ dựng khi ô lọt vào màn (lưới dài 45+ ô).
  useEffect(() => {
    const el = hop.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setThay(true); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => { if (thay) void taiTap(tapId).then(setDl); }, [thay, tapId]);

  // Dựng lại cảnh khi máy / vị trí của shot đổi.
  const khoaMay = JSON.stringify(may);
  useEffect(() => {
    const set = dl?.sets.find((s) => s.id === setId); if (!set) return;
    canh.current = dungCanhShot(set, (t) => dl!.khoi[t] as KhoiNv | undefined, may);
    setLech({ ngang: 0, doc: 0 });
    return () => { if (canh.current) huyCanh(canh.current); canh.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dl, setId, khoaMay]);

  // Vẽ: dùng bộ vẽ chung, chép sang canvas của ô.
  useEffect(() => {
    const c = ve.current, el = hop.current, sc = canh.current; if (!c || !el || !sc) return;
    const veLai = () => {
      const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
      const tl = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(w * tl), H = Math.round(h * tl);
      const cam = new THREE.PerspectiveCamera(fovMay(may.ong_kinh, doc), w / h, 0.1, 3000);
      const dich = V(may.nhin); const goc = V(may.dat).sub(dich);
      const cau = new THREE.Spherical().setFromVector3(goc);
      cau.theta += lech.ngang; cau.phi = Math.min(Math.PI - 0.05, Math.max(0.05, cau.phi + lech.doc));
      cam.position.copy(dich.clone().add(new THREE.Vector3().setFromSpherical(cau))); cam.lookAt(dich);
      const r = boVe(); r.setPixelRatio(1); r.setSize(W, H, false); catLop(sc, cam); r.render(sc, cam);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      c.getContext('2d')?.drawImage(r.domElement, 0, 0, W, H);
    };
    veLai();
    const ro = new ResizeObserver(veLai); ro.observe(el);
    return () => ro.disconnect();
  }, [dl, setId, khoaMay, lech, doc, may]);

  // Kéo xoay; bấm không kéo = mở trình xem. Chặn sự kiện để thẻ (button) bên ngoài không mở ngăn shot.
  const keo = useRef<{ x: number; y: number; goc: Lech; da: boolean } | null>(null);
  const daXoay = lech.ngang !== 0 || lech.doc !== 0;
  return (
    <div ref={hop} role="button" tabIndex={0} title="Kéo để xoay · nhấp đúp về máy shot · bấm để mở trình xem 3D đầy đủ"
      onPointerDown={(e) => { e.stopPropagation(); keo.current = { x: e.clientX, y: e.clientY, goc: lech, da: false }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => {
        const k = keo.current; if (!k) return;
        const dx = e.clientX - k.x, dy = e.clientY - k.y; if (!k.da && Math.hypot(dx, dy) < 4) return;
        k.da = true; setLech({ ngang: k.goc.ngang - dx * 0.012, doc: k.goc.doc - dy * 0.012 });
      }}
      onPointerUp={(e) => { e.stopPropagation(); const k = keo.current; keo.current = null; if (k && !k.da) onMo(); }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => { e.stopPropagation(); setLech({ ngang: 0, doc: 0 }); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); onMo(); } }}
      style={{ position: 'relative', aspectRatio: doc ? '9 / 16' : '16 / 9', background: '#3a3b44', borderTop: '1px solid var(--line)', cursor: 'grab', touchAction: 'none' }}>
      <canvas ref={ve} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      {!dl && thay && <span className="xv-mono" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--fg-4)' }}>… dựng 3D</span>}
      {/* Nhãn khối (đo theo máy shot) chỉ đúng chỗ khi chưa xoay. */}
      {!daXoay && nhanKhoi}
      {children}
      {daXoay && <span className="xv-mono" style={{ position: 'absolute', left: 4, bottom: 4, fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.72)', color: '#facc15' }}>đang xoay · nhấp đúp về máy shot</span>}
    </div>
  );
}
