'use client';
// Văn phòng pixel LIVE cố định bên phải ngăn phòng (góp ý #1272, anh đổi 11/10/2026: không phải tab — mở phòng là thấy phòng đang làm).
// Chỉ nạp khi khung thật sự hiện ra (ngăn ẩn / khổ hẹp chưa hiện thì chưa nối WebSocket).
import { useEffect, useRef, useState } from 'react';

export function KhungVp({ src, ghi }: { src: string; ghi: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hien, setHien] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || hien) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setHien(true); io.disconnect(); } });
    io.observe(el); return () => io.disconnect();
  }, [hien]);
  return (
    <div ref={ref} className="cty-vp-khung">
      <div className="cty-vp-dau"><span className="cty-muted cty-nho">{ghi}</span><a className="cty-btn" href={src} target="_blank" rel="noreferrer">Mở riêng ↗</a></div>
      {hien ? <iframe src={src} title={ghi} /> : <p className="cty-muted">Đang mở văn phòng…</p>}
    </div>
  );
}
