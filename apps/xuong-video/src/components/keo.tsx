'use client';
// Kéo đổi kích thước (cột, panel, hàng) — MỘT cơ chế cho mọi tay kéo của studio: giá trị nhớ theo trình duyệt (lib/luu-tru),
// kẹp [min, max], nhấp đúp = về mặc định. Trước đây mỗi tay kéo viết tay một lần (cột nhãn timeline); #1276 cần thêm ba.
import { useState, type CSSProperties, type PointerEvent as PE } from 'react';
import { docLT, ghiLT } from '@/lib/luu-tru';

export function useKichThuoc(khoa: string, macDinh: number, min: number, max: number) {
  const [v, setV] = useState(() => { const x = Number(docLT(khoa)); return x >= min && x <= max ? x : macDinh; });
  /** truc: kéo theo trục nào; chieu -1 = kéo về phía âm thì TO ra (panel bên phải, kéo mép trái). */
  const keo = (truc: 'x' | 'y', chieu: 1 | -1 = 1) => (e: PE<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const p0 = truc === 'x' ? e.clientX : e.clientY; const v0 = v; let moi = v0;
    const di = (ev: PointerEvent) => { moi = Math.round(Math.max(min, Math.min(max, v0 + chieu * ((truc === 'x' ? ev.clientX : ev.clientY) - p0)))); setV(moi); };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); ghiLT(khoa, String(moi)); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const veMacDinh = () => { setV(macDinh); ghiLT(khoa, null); };
  return { v, keo, veMacDinh };
}

/** Tay kéo: vạch mảnh, rê thấy, con trỏ đổi cỡ. */
export function TayKeo({ truc, onPointerDown, onDoubleClick, style, title = 'Kéo để đổi kích thước · nhấp đúp = mặc định' }: { truc: 'x' | 'y'; onPointerDown: (e: PE<HTMLDivElement>) => void; onDoubleClick: () => void; style?: CSSProperties; title?: string }) {
  return <div className="xv-tay-keo" onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} title={title}
    style={{ cursor: truc === 'x' ? 'col-resize' : 'row-resize', touchAction: 'none', background: 'var(--line)', ...(truc === 'x' ? { width: 4 } : { height: 4 }), ...style }} />;
}
