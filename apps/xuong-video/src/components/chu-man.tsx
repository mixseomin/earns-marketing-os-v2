'use client';
// Chữ màn trên ô xem trước (timeline, animatic) vẽ GIỐNG bản xuất: cùng kiểu chữ của phim (qc.kieu_chu: font, màu, viền, màu nhấn số),
// cùng vị trí (qc.vi_tri_chu), đổi câu theo giây trong shot ("@0.9 …") — xem trên trang là thấy đúng thứ sẽ ra MP4.
import { doanChuMan, KIEU_CHU_MAC_DINH, type ThongTinQc } from '@/lib/xuong-video/kieu';

export function ChuManXem({ chu, giay, rong, qc }: { chu: string; giay: number; rong: number; qc?: ThongTinQc | null }) {
  const doan = doanChuMan(chu, 999);
  if (!doan.length) return null;
  const cau = [...doan].reverse().find((d) => d.tu <= giay + 0.001) ?? doan[0]!;
  const k = { ...KIEU_CHU_MAC_DINH, ...Object.fromEntries(Object.entries(qc?.kieu_chu ?? {}).filter(([, v]) => v !== '' && v != null)) } as typeof KIEU_CHU_MAC_DINH;
  const fs = Math.max(9, Math.round(rong * k.co));
  const vien = Math.max(1, Math.round(fs * k.vien_day));
  const viTri = qc?.vi_tri_chu ?? 'tren';
  const font = k.font === 'DejaVu Sans' ? 'system-ui, sans-serif' : `"${k.font}", "Montserrat", system-ui, sans-serif`;
  const to = (t: string) => (k.nhan ? t.split(/([0-9?$%]+)/).map((p, i) => (i % 2 ? <span key={i} style={{ color: k.nhan }}>{p}</span> : p)) : t);
  return (
    <div style={{ position: 'absolute', left: '5%', right: '5%', textAlign: 'center', pointerEvents: 'none', fontFamily: font, fontWeight: 900, fontSize: fs, lineHeight: 1.15, color: k.mau,
      WebkitTextStroke: `${vien}px ${k.vien}`, paintOrder: 'stroke fill', textShadow: '0 1px 4px rgba(0,0,0,.35)',
      ...(viTri === 'giua' ? { top: '50%', transform: 'translateY(-50%)' } : viTri === 'duoi' ? { top: '62%', transform: 'translateY(-50%)' } : { top: '14%' }) }}>
      {cau.dong.map((d, i) => <div key={i}>{to(d)}</div>)}
    </div>
  );
}
