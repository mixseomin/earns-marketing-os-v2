'use client';

// Vị trí cho lớp nổi neo vào một nút (menu ⋯, ô chọn select2…): position FIXED theo toạ độ nút, kẹp trong khung nhìn, thiếu chỗ bên dưới thì
// lật lên trên. Trước đây dùng position:absolute trong ngăn phim (overflow:auto) → lớp nổi thò ra mép ngăn là bị cắt mất chữ (#1213).
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export function useViTriNoi(neo: RefObject<HTMLElement | null>, mo: boolean, o: { rong: number; canPhai?: boolean; caoToiDa?: number }): CSSProperties {
  const [st, setSt] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  useLayoutEffect(() => {
    if (!mo) return;
    const tinh = () => {
      const el = neo.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight, le = 8;
      const rong = Math.min(o.rong, vw - 2 * le);
      let left = o.canPhai ? r.right - rong : r.left;
      left = Math.max(le, Math.min(left, vw - rong - le));
      const duoi = vh - r.bottom - le, tren = r.top - le;
      const caoMuon = o.caoToiDa ?? 420;
      const lenTren = duoi < Math.min(caoMuon, 240) && tren > duoi;
      const cao = Math.min(caoMuon, lenTren ? tren : duoi);
      setSt({ position: 'fixed', left, width: rong, maxHeight: cao, overflow: 'auto', zIndex: 80, ...(lenTren ? { bottom: vh - r.top + 2 } : { top: r.bottom + 2 }) });
    };
    tinh();
    window.addEventListener('resize', tinh); window.addEventListener('scroll', tinh, true);
    return () => { window.removeEventListener('resize', tinh); window.removeEventListener('scroll', tinh, true); };
  }, [mo, neo, o.rong, o.canPhai, o.caoToiDa]);
  return st;
}
