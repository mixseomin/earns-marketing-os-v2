'use client';
// Rê chuột lên BẤT KỲ ảnh nào trong app → hiện bản to cạnh con trỏ (anh yêu cầu 08/10/2026: không bắt click để xem chi tiết).
// Gắn một lần ở layout, bắt sự kiện ở document → ảnh thêm sau này tự có, không phải nhớ bọc từng chỗ.
import { useEffect, useState } from 'react';

export function PhongToKhiRe() {
  const [anh, setAnh] = useState<{ src: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const vao = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!(t instanceof HTMLImageElement) || t.dataset.khongPhongTo != null) return;
      const r = t.getBoundingClientRect();
      if (r.width >= 360) return;   // ảnh đã đủ to thì thôi
      setAnh({ src: t.currentSrc || t.src, x: e.clientX, y: e.clientY });
    };
    const di = (e: MouseEvent) => setAnh((a) => (a ? { ...a, x: e.clientX, y: e.clientY } : a));
    const ra = (e: MouseEvent) => { if (e.target instanceof HTMLImageElement) setAnh(null); };
    document.addEventListener('mouseover', vao);
    document.addEventListener('mousemove', di, { passive: true });
    document.addEventListener('mouseout', ra);
    return () => { document.removeEventListener('mouseover', vao); document.removeEventListener('mousemove', di); document.removeEventListener('mouseout', ra); };
  }, []);
  if (!anh) return null;
  const W = typeof window === 'undefined' ? 1200 : window.innerWidth, H = typeof window === 'undefined' ? 800 : window.innerHeight;
  const maxW = Math.min(560, W * 0.45), maxH = H * 0.8;
  const trai = anh.x + 24 + maxW > W ? Math.max(8, anh.x - 24 - maxW) : anh.x + 24;
  const tren = Math.min(Math.max(8, anh.y - maxH / 2), H - maxH - 8);
  return (
    <div style={{ position: 'fixed', left: trai, top: tren, width: maxW, height: maxH, zIndex: 1000, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: anh.x + 24 + maxW > W ? 'flex-end' : 'flex-start' }}>
      <img src={anh.src} alt="" data-khong-phong-to="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, border: '1px solid var(--line)', boxShadow: '0 12px 40px rgba(0,0,0,.6)', background: 'var(--bg-0)' }} />
    </div>
  );
}
