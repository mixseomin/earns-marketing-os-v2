'use client';
// Drawer dùng chung của studio: trượt từ phải, Esc / bấm nền để đóng. `nho` = drawer hẹp.
// Ngăn kéo XẾP CHỒNG (#1222): drawer mở sau hẹp hơn drawer bên dưới 64px mỗi tầng → ngăn dưới luôn lộ mép trái, bấm vào mép đó
// (là nền của ngăn trên) thì ngăn trên đóng, quay về ngăn dưới. Tầng đếm lúc mở từ số .xv-drawer đang có trên trang.
// Kéo mép trái để nới/thu (#1237): bề rộng gốc nhớ theo trình duyệt, riêng cho drawer rộng và drawer hẹp; nhấp đúp mép = về mặc định.
// Tầng trên vẫn hẹp hơn tầng dưới 64px vì cùng đọc một bề rộng gốc.
// Phần đầu ghim trên cùng khi cuộn (#1233, YDNI "ghim phần đầu") — MỘT khuôn cho mọi drawer, không drawer nào tự dựng hàng tiêu đề:
//   `tieuDe` (h2) · `nut` (nút/chip phụ bên phải) · nút Đóng tự có · `dau` (dải dưới tiêu đề, vd tab).
import { useLayoutEffect, useRef, useState, useEffect, type ReactNode, type PointerEvent as PE } from 'react';
import { docLT, ghiLT } from '@/lib/luu-tru';

const LO = 64;
const MAC_DINH = { rong: 1100, nho: 520 };
const khoa = (nho?: boolean) => `xv-ngan-rong-${nho ? 'nho' : 'rong'}`;
const docRong = (nho?: boolean) => { const v = Number(docLT(khoa(nho))); return v >= 360 ? v : null; };

export function Ngan({ onClose, nho, tieuDe, nut, dau, children }: { onClose: () => void; nho?: boolean; tieuDe?: ReactNode; nut?: ReactNode; dau?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const gocRef = useRef<number | null>(null);
  const [tang, setTang] = useState(0);
  const [goc, setGoc] = useState<number | null>(null);
  useLayoutEffect(() => {
    const ds = [...document.querySelectorAll<HTMLElement>('.xv-drawer')].filter((d) => d !== ref.current && d.offsetWidth > 0);
    setTang(ds.length);
    setGoc(docRong(nho));
  }, [nho]);
  // Esc chỉ đóng ngăn TRÊN CÙNG.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; const ds = [...document.querySelectorAll('.xv-drawer')]; if (ds[ds.length - 1] === ref.current) onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const rongGoc = goc ?? (nho ? MAC_DINH.nho : MAC_DINH.rong);
  const rong = `calc(min(${rongGoc}px, 98vw) - ${tang * LO}px)`;
  const keo = (e: PE<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const di = (ev: PointerEvent) => { gocRef.current = Math.round(Math.min(window.innerWidth * 0.98, Math.max(360, window.innerWidth - ev.clientX + tang * LO))); setGoc(gocRef.current); };
    const xong = () => {
      el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong);
      if (gocRef.current) ghiLT(khoa(nho), String(gocRef.current));
    };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const veMacDinh = () => { gocRef.current = null; setGoc(null); ghiLT(khoa(nho), null); };
  const z = tang ? 51 + tang * 2 : nho ? 53 : 51;
  return <><div className={`xv-backdrop${nho ? ' nho' : ''}`} style={tang ? { zIndex: 50 + tang * 2, background: 'rgba(0,0,0,.3)' } : undefined} onClick={onClose} />
    <div ref={ref} className={`xv-drawer${nho ? ' nho' : ''}`} style={{ width: rong, ...(tang ? { zIndex: z, boxShadow: '-12px 0 30px rgba(0,0,0,.45)' } : {}) }}>{(tieuDe != null || dau != null) && <div className="xv-dau">
      {tieuDe != null && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: nho ? 15 : 17, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tieuDe}</h2>
        {nut}
        <button type="button" className="xv-btn" onClick={onClose}>Đóng</button>
      </div>}
      {dau != null && <div style={{ marginTop: tieuDe != null ? 8 : 0 }}>{dau}</div>}
    </div>}{children}</div>
    <div className="xv-keo-mep" style={{ right: `calc(${rong} - 4px)`, zIndex: z }} onPointerDown={keo} onDoubleClick={veMacDinh} title="Kéo để nới/thu drawer · nhấp đúp = về mặc định" /></>;
}
