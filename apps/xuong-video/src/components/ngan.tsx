'use client';
// Drawer dùng chung của studio: trượt từ phải, Esc / bấm nền để đóng. `nho` = drawer hẹp.
// Ngăn kéo XẾP CHỒNG (#1222): drawer mở sau hẹp hơn drawer bên dưới 64px mỗi tầng → ngăn dưới luôn lộ mép trái, bấm vào mép đó
// (là nền của ngăn trên) thì ngăn trên đóng, quay về ngăn dưới. Tầng đếm lúc mở từ số .xv-drawer đang có trên trang.
import { useLayoutEffect, useRef, useState, useEffect, type ReactNode } from 'react';

const LO = 64;
export function Ngan({ onClose, nho, children }: { onClose: () => void; nho?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tang, setTang] = useState(0);
  useLayoutEffect(() => {
    const ds = [...document.querySelectorAll<HTMLElement>('.xv-drawer')].filter((d) => d !== ref.current && d.offsetWidth > 0);
    setTang(ds.length);
  }, []);
  // Esc chỉ đóng ngăn TRÊN CÙNG.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; const ds = [...document.querySelectorAll('.xv-drawer')]; if (ds[ds.length - 1] === ref.current) onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const rong = nho ? `min(520px, calc(96vw - ${tang * LO}px))` : `calc(min(1100px, 96vw) - ${tang * LO}px)`;
  return <><div className={`xv-backdrop${nho ? ' nho' : ''}`} style={tang ? { zIndex: 50 + tang * 2, background: 'rgba(0,0,0,.3)' } : undefined} onClick={onClose} />
    <div ref={ref} className={`xv-drawer${nho ? ' nho' : ''}`} style={{ width: rong, ...(tang ? { zIndex: 51 + tang * 2, boxShadow: '-12px 0 30px rgba(0,0,0,.45)' } : {}) }}>{children}</div></>;
}
