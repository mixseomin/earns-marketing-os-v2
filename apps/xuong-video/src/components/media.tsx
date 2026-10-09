'use client';
// Phát media trên thẻ (#1241, #1242): MỘT cỡ cho mọi nút nghe, MỘT kiểu clip nhỏ — thay các <audio>/<video controls> mỗi chỗ một cỡ.
//   NutNghe: nút ▶/■ + nhãn + số giây, cao 22px; mỗi lúc chỉ một tiếng phát (bấm cái khác thì cái đang phát dừng).
//   ClipNho: khung xem trước (rê = tự chạy không tiếng), bấm = mở drawer xem to có đủ nút + Tải về.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { moNgan } from './ngan-chung';

let dangPhat: HTMLAudioElement | null = null;

export function NutNghe({ url, nhan, title, mau = 'var(--fg-2)' }: { url: string; nhan?: string; title?: string; mau?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [chay, setChay] = useState(false);
  const [giay, setGiay] = useState<number | null>(null);
  useEffect(() => () => { ref.current?.pause(); }, []);
  const bam = () => {
    if (!ref.current) {
      const a = new Audio(url); ref.current = a;
      a.onloadedmetadata = () => setGiay(a.duration);
      a.onended = a.onpause = () => setChay(false);
      a.onplay = () => setChay(true);
    }
    const a = ref.current;
    if (!a.paused) { a.pause(); return; }
    if (dangPhat && dangPhat !== a) dangPhat.pause();
    dangPhat = a; a.currentTime = 0; void a.play().catch(() => setChay(false));
  };
  return (
    <button type="button" className="xv-nghe" onClick={bam} title={title ?? (chay ? 'Dừng' : 'Nghe')} style={{ color: mau, borderColor: chay ? mau : undefined }}>
      <span>{chay ? '■' : '▶'}</span>{nhan && <span className="xv-nghe-nhan">{nhan}</span>}{giay != null && Number.isFinite(giay) && <span style={{ opacity: 0.7 }}>{giay.toFixed(1)}s</span>}
    </button>
  );
}

export function ClipNho({ url, ten, style }: { url: string; ten?: string; style: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <div className="xv-clip" style={style} title="Rê để xem lướt · bấm để mở to (đủ nút, tải về)" onClick={() => moNgan({ loai: 'xem', url, ten })}
      onMouseEnter={() => void ref.current?.play().catch(() => {})} onMouseLeave={() => { const v = ref.current; if (v) { v.pause(); v.currentTime = 0; } }}>
      <video ref={ref} src={url} muted playsInline loop preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, display: 'block' }} />
      <span className="xv-clip-nut">▶</span>
    </div>
  );
}
