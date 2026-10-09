'use client';
// Thẻ gợi ý khi rê (#1247) — thay ô `title` thô của trình duyệt cho khối có nhiều dòng. Phần tử chỉ cần `data-goi-y="<chữ>"`:
//   dòng 1 = tiêu đề (đậm) · dòng "Nhãn: giá trị" (nhãn ≤ 24 ký tự) = bảng hai cột · dòng khác = đoạn văn.
// MỘT host ở layout lo vị trí (theo chuột, kẹp trong màn), độ trễ, ẩn khi bấm/cuộn — chỗ dùng không phải dựng gì.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Hien = { chu: string; x: number; y: number };
const DONG_NHAN = /^([^:\n]{1,24}):\s+(.+)$/;

export function GoiYHost() {
  const [hien, setHien] = useState<Hien | null>(null);
  const [vt, setVt] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let hen: ReturnType<typeof setTimeout> | null = null;
    let dang: Element | null = null;
    const an = () => { if (hen) clearTimeout(hen); hen = null; dang = null; setHien(null); };
    const vao = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-goi-y]') ?? null;
      if (el === dang) return;
      an(); if (!el) return;
      const chu = el.getAttribute('data-goi-y') ?? ''; if (!chu.trim()) return;
      dang = el;
      hen = setTimeout(() => setHien({ chu, x: e.clientX, y: e.clientY }), 220);
    };
    const di = (e: PointerEvent) => { if (dang) setHien((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h)); };
    document.addEventListener('pointerover', vao); document.addEventListener('pointermove', di);
    document.addEventListener('pointerdown', an, true); window.addEventListener('scroll', an, true);
    return () => { document.removeEventListener('pointerover', vao); document.removeEventListener('pointermove', di); document.removeEventListener('pointerdown', an, true); window.removeEventListener('scroll', an, true); };
  }, []);
  useLayoutEffect(() => {
    if (!hien || !ref.current) { setVt(null); return; }
    const r = ref.current.getBoundingClientRect(), le = 8;
    let left = hien.x + 14, top = hien.y + 16;
    if (left + r.width > window.innerWidth - le) left = Math.max(le, hien.x - r.width - 10);
    if (top + r.height > window.innerHeight - le) top = Math.max(le, hien.y - r.height - 10);
    setVt({ left, top });
  }, [hien]);
  if (!hien) return null;
  const dong = hien.chu.split('\n').map((x) => x.trim()).filter(Boolean);
  const [tieuDe, ...con] = dong;
  return (
    <div ref={ref} className="xv-goi-y" style={{ left: vt?.left ?? -9999, top: vt?.top ?? -9999 }}>
      <div className="xv-goi-y-tieu-de">{tieuDe}</div>
      {con.length > 0 && (
        <div className="xv-goi-y-than">
          {con.map((d, i) => { const m = d.match(DONG_NHAN); return m ? <div key={i} className="xv-goi-y-dong"><span>{m[1]}</span><span>{m[2]}</span></div> : <div key={i} className="xv-goi-y-van">{d}</div>; })}
        </div>
      )}
    </div>
  );
}
