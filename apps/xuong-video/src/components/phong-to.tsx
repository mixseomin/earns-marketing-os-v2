'use client';
// Rê chuột lên BẤT KỲ ảnh nào trong app → hiện bản to cạnh con trỏ (anh yêu cầu 08/10/2026: không bắt click để xem chi tiết).
// Gắn một lần ở layout, bắt sự kiện ở document → ảnh thêm sau này tự có, không phải nhớ bọc từng chỗ.
import { useEffect, useRef, useState } from 'react';
import { anhNho, anhGoc } from '@/lib/xuong-video/anh-nho';

export function PhongToKhiRe() {
  // soSanh: ảnh tham chiếu đi kèm (data-so-sanh='[{"ten","url"}]' trên ảnh keyframe) — hiện thành cột bên cạnh để so (#1215).
  const [anh, setAnh] = useState<{ src: string; x: number; y: number; soSanh: { ten: string; url: string }[]; chu: string } | null>(null);
  // Chú thích (title) của ảnh / khối bọc ảnh: tooltip gốc của trình duyệt đè ngay lên bản phóng to (#1395 — chuỗi nguồn sinh dài che kín ảnh).
  // Lúc rê: cất title đi, hiện thành dòng chú thích trên bản phóng to; rời ảnh thì trả lại.
  const catTitle = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const traTitle = () => { const g = catTitle.current; if (g && g.dataset.titleCat != null) { g.setAttribute('title', g.dataset.titleCat); delete g.dataset.titleCat; } catTitle.current = null; };
    const vao = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!(t instanceof HTMLImageElement) || t.dataset.khongPhongTo != null) return;
      const r = t.getBoundingClientRect();
      if (r.width >= 360) return;   // ảnh đã đủ to thì thôi
      let soSanh: { ten: string; url: string }[] = [];
      try { soSanh = t.dataset.soSanh ? (JSON.parse(t.dataset.soSanh) as { ten: string; url: string }[]).filter((x) => x.url).map((x) => ({ ...x, url: anhNho(x.url, 320) })) : []; } catch { soSanh = []; }
      // Ô đang rê là ảnh nhỏ (anh-nho.ts) → bản phóng to lấy nấc 640 của ảnh gốc, không tải ảnh gốc ~1 MB.
      traTitle();
      const g = t.closest<HTMLElement>('[title]');
      const chu = g?.getAttribute('title') ?? '';
      if (g && chu) { g.dataset.titleCat = chu; g.removeAttribute('title'); catTitle.current = g; }
      setAnh({ src: anhNho(anhGoc(t.currentSrc || t.src), 640), x: e.clientX, y: e.clientY, soSanh, chu });
    };
    const di = (e: MouseEvent) => setAnh((a) => (a ? { ...a, x: e.clientX, y: e.clientY } : a));
    const ra = (e: MouseEvent) => { if (e.target instanceof HTMLImageElement) { traTitle(); setAnh(null); } };
    document.addEventListener('mouseover', vao);
    document.addEventListener('mousemove', di, { passive: true });
    document.addEventListener('mouseout', ra);
    return () => { traTitle(); document.removeEventListener('mouseover', vao); document.removeEventListener('mousemove', di); document.removeEventListener('mouseout', ra); };
  }, []);
  if (!anh) return null;
  const W = typeof window === 'undefined' ? 1200 : window.innerWidth, H = typeof window === 'undefined' ? 800 : window.innerHeight;
  const cot = anh.soSanh.length ? 150 : 0;
  const maxW = Math.min(560 + cot, W * 0.62), maxH = H * 0.8;
  const benTrai = anh.x + 24 + maxW > W;
  const trai = benTrai ? Math.max(8, anh.x - 24 - maxW) : anh.x + 24;
  const tren = Math.min(Math.max(8, anh.y - maxH / 2), H - maxH - 8);
  return (
    <div style={{ position: 'fixed', left: trai, top: tren, width: maxW, height: maxH, zIndex: 1000, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8, justifyContent: benTrai ? 'flex-end' : 'flex-start' }}>
      <div style={{ position: 'relative', maxWidth: `calc(100% - ${cot + (cot ? 8 : 0)}px)`, maxHeight: '100%', display: 'flex' }}>
        <img src={anh.src} alt="" data-khong-phong-to="" style={{ maxWidth: '100%', maxHeight: maxH, borderRadius: 8, border: '1px solid var(--line)', boxShadow: '0 12px 40px rgba(0,0,0,.6)', background: 'var(--bg-0)' }} />
        {anh.chu && <div style={{ position: 'absolute', left: 6, right: 6, bottom: 6, padding: '5px 8px', borderRadius: 6, background: 'rgba(0,0,0,.78)', color: '#fff', fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-line', maxHeight: '35%', overflow: 'hidden' }}>{anh.chu}</div>}
      </div>
      {cot > 0 && (
        <div style={{ width: cot, maxHeight: '100%', overflow: 'hidden', display: 'grid', gap: 6, alignContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff', textShadow: '0 1px 3px #000' }}>so với ảnh gốc:</div>
          {anh.soSanh.slice(0, 4).map((x) => (
            <div key={x.url} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 3, boxShadow: '0 6px 20px rgba(0,0,0,.5)' }}>
              <img src={x.url} alt="" data-khong-phong-to="" style={{ width: '100%', maxHeight: (maxH - 40) / Math.min(4, anh.soSanh.length) - 26, objectFit: 'contain', borderRadius: 4, display: 'block' }} />
              <div style={{ fontSize: 10.5, color: 'var(--fg-1)', padding: '2px 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.ten}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
