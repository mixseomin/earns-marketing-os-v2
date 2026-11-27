'use client';
// KHUNG KÉO — bảng nổi dời được + đổi cỡ đủ 4 cạnh + 4 góc + nhớ qua F5 (anh 15/11/2026 "widget này cho phép kéo thả, resize.... (cả 4 cạnh + 4 góc)").
// Cùng luật widget của city.on.tc (bảng / ngăn: đầu cố định kéo để dời, × đóng, đổi cỡ 8 hướng, nhớ F5) nhưng viết cho React — bản city là HTML thuần trong tệp cảnh, không gắn được.
// Dùng chung: mọi bảng nổi đã GHIM (BangPhim khi bấm toà / bấm trong bảng). Vị trí + cỡ giữ trong máy theo `khoa`; kho bị chặn thì dùng chỗ mở, không lỗi. Esc đóng.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type O = { x: number; y: number; w: number; h: number };
const HUONG = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
const CON_TRO: Record<string, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
const MIN_W = 320, MIN_H = 180;

const kep = (o: O): O => {
  const W = window.innerWidth, H = window.innerHeight, w = Math.max(MIN_W, Math.min(o.w, W - 8)), h = Math.max(MIN_H, Math.min(o.h, H - 8));
  return { w, h, x: Math.max(4, Math.min(o.x, W - w - 4)), y: Math.max(4, Math.min(o.y, H - h - 4)) };
};

export function KhungKeo({ khoa, x, y, rong, cao, ten, onDong, children }: { khoa: string; x: number; y: number; rong: number; cao: number; ten?: React.ReactNode; onDong: () => void; children: React.ReactNode }) {
  const [o, setO] = useState<O>(() => {
    let nho: Partial<O> | null = null;
    try { nho = JSON.parse(localStorage.getItem(khoa) ?? 'null'); } catch { /* kho bị chặn */ }
    const W = window.innerWidth, H = window.innerHeight, w = nho?.w ?? rong, h = nho?.h ?? Math.min(cao, H - 32);
    return kep({ w, h, x: nho?.x ?? (x + 12 + w < W ? x + 12 : x - w - 12), y: nho?.y ?? y - 20 });
  });
  const henLuu = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (henLuu.current) clearTimeout(henLuu.current); henLuu.current = setTimeout(() => { try { localStorage.setItem(khoa, JSON.stringify(o)); } catch { /* kho bị chặn */ } }, 300); }, [o, khoa]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onDong(); }; const r = () => setO((v) => kep(v));
    window.addEventListener('keydown', k); window.addEventListener('resize', r); return () => { window.removeEventListener('keydown', k); window.removeEventListener('resize', r); }; }, [onDong]);
  const keo = (h: string) => (e: React.PointerEvent) => {
    if (h === 'dau' && (e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, b = o;
    const di = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (h === 'dau') { setO(kep({ ...b, x: b.x + dx, y: b.y + dy })); return; }
      let { x: nx, y: ny, w, h: hh } = b;
      if (h.includes('e')) w = b.w + dx;
      if (h.includes('s')) hh = b.h + dy;
      if (h.includes('w')) { w = Math.max(MIN_W, b.w - dx); nx = b.x + b.w - w; }
      if (h.includes('n')) { hh = Math.max(MIN_H, b.h - dy); ny = b.y + b.h - hh; }
      setO(kep({ x: nx, y: ny, w, h: hh }));
    };
    const len = () => { window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', len); document.body.style.userSelect = ''; };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', di); window.addEventListener('pointerup', len);
  };
  const tay = (h: string): React.CSSProperties => {
    const goc = h.length === 2, s: React.CSSProperties = { position: 'absolute', zIndex: 3, touchAction: 'none', cursor: CON_TRO[h] };
    if (goc) Object.assign(s, { width: 14, height: 14 }, h.includes('n') ? { top: -4 } : { bottom: -4 }, h.includes('w') ? { left: -4 } : { right: -4 });
    else if (h === 'n' || h === 's') Object.assign(s, { left: 10, right: 10, height: 8 }, h === 'n' ? { top: -4 } : { bottom: -4 });
    else Object.assign(s, { top: 10, bottom: 10, width: 8 }, h === 'w' ? { left: -4 } : { right: -4 });
    return s;
  };
  return createPortal(<div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: o.x, top: o.y, width: o.w, height: o.h, zIndex: 60, display: 'flex', flexDirection: 'column',
    background: 'var(--bg-1, #0f172a)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.45)', color: 'var(--fg-1)' }}>
    <div onPointerDown={keo('dau')} title="Kéo để dời · kéo cạnh / góc để đổi cỡ" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 4px 12px', cursor: 'move',
      borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-3)', touchAction: 'none', userSelect: 'none' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⠿ {ten}</span>
      <button onClick={onDong} aria-label="Đóng" title="Đóng (Esc)" style={{ width: 26, height: 26, border: 0, borderRadius: 6, background: 'transparent', color: 'var(--fg-2)', fontSize: 16, cursor: 'pointer' }}>×</button>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
    {HUONG.map((h) => <div key={h} onPointerDown={keo(h)} style={tay(h)} />)}
  </div>, document.body);
}
