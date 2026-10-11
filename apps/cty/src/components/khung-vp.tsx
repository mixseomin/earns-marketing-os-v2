'use client';
// Văn phòng pixel LIVE cố định bên phải ngăn phòng (góp ý #1272, anh đổi 11/10/2026: không phải tab — mở phòng là thấy phòng đang làm).
// Chỉ nạp khi khung thật sự hiện ra (ngăn ẩn / khổ hẹp chưa hiện thì chưa nối WebSocket).
// Kéo mép trái để đổi độ rộng (anh 11/10/2026); nhớ qua F5 ở localStorage `cty.vp.rong`. Khi kéo, iframe tạm bỏ nhận chuột
// (không thì nó nuốt pointermove và việc kéo đứng lại giữa chừng).
import { useEffect, useRef, useState } from 'react';

export function KhungVp({ src, ghi }: { src: string; ghi: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hien, setHien] = useState(false);
  const datRong = (w: number) => { const cha = ref.current?.parentElement; if (!cha) return;
    const r = Math.round(Math.min(Math.max(w, 260), cha.clientWidth - 360)); cha.style.setProperty('--vp-rong', `${r}px`); return r; };
  useEffect(() => { try { const w = Number(localStorage.getItem('cty.vp.rong')); if (w > 0) datRong(w); } catch { /* không nhớ được: rộng mặc định */ } }, []);
  const keo = (e: React.PointerEvent) => {
    const cha = ref.current?.parentElement; if (!cha) return;
    e.preventDefault(); cha.classList.add('cty-dang-keo');
    const phai = cha.getBoundingClientRect().right; let cuoi = 0;
    const di = (ev: PointerEvent) => { cuoi = datRong(phai - ev.clientX) ?? cuoi; };
    const tha = () => { cha.classList.remove('cty-dang-keo'); window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', tha);
      try { if (cuoi) localStorage.setItem('cty.vp.rong', String(cuoi)); } catch { /* chỉ giữ tới F5 */ } };
    window.addEventListener('pointermove', di); window.addEventListener('pointerup', tha);
  };
  useEffect(() => {
    const el = ref.current; if (!el || hien) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setHien(true); io.disconnect(); } });
    io.observe(el); return () => io.disconnect();
  }, [hien]);
  return (
    <div ref={ref} className="cty-vp-khung">
      <div className="cty-vp-keo" role="separator" aria-orientation="vertical" aria-label="Kéo để đổi độ rộng văn phòng" onPointerDown={keo} onDoubleClick={() => { ref.current?.parentElement?.style.removeProperty('--vp-rong'); try { localStorage.removeItem('cty.vp.rong'); } catch { /* bỏ qua */ } }} title="Kéo để đổi độ rộng · bấm đúp về mặc định" />
      <div className="cty-vp-dau"><span className="cty-muted cty-nho">{ghi}</span><a className="cty-btn" href={src} target="_blank" rel="noreferrer">Mở riêng ↗</a></div>
      {hien ? <iframe src={src} title={ghi} /> : <p className="cty-muted">Đang mở văn phòng…</p>}
    </div>
  );
}
