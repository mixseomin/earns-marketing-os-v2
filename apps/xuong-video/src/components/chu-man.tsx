'use client';
// Chữ màn trên ô xem trước (timeline, animatic) vẽ GIỐNG bản xuất: cùng kiểu chữ của phim (qc.kieu_chu: font, màu, viền, màu nhấn số),
// cùng vị trí (qc.vi_tri_chu), đổi câu theo giây trong shot ("@0.9 …") — xem trên trang là thấy đúng thứ sẽ ra MP4.
import { doanChuMan, KIEU_CHU_MAC_DINH, type KieuChu, type ThongTinQc } from '@/lib/xuong-video/kieu';

export function ChuManXem({ chu, giay, rong, qc, kieu }: { chu: string; giay: number; rong: number; qc?: ThongTinQc | null; kieu?: KieuChu }) {
  const doan = doanChuMan(chu, 999);
  if (!doan.length) return null;
  const cau = [...doan].reverse().find((d) => d.tu <= giay + 0.001) ?? doan[0]!;
  const k = Object.assign({}, KIEU_CHU_MAC_DINH, ...[qc?.kieu_chu, kieu].map((d) => Object.fromEntries(Object.entries(d ?? {}).filter(([, v]) => v !== '' && v != null)))) as typeof KIEU_CHU_MAC_DINH & { y?: number; nen?: string };
  const fs = Math.max(9, Math.round(rong * k.co));
  const hep = k.ngang / 100;
  const vien = Math.max(1, Math.round(fs * k.vien_day));
  const viTri = qc?.vi_tri_chu ?? 'tren';
  const font = k.font === 'DejaVu Sans' ? 'system-ui, sans-serif' : `"${k.font}", "Montserrat", system-ui, sans-serif`;
  const so = (t: string, kh: string) => (k.nhan ? t.split(/([0-9?$%]+)/).map((p, i) => (i % 2 ? <span key={`${kh}${i}`} style={{ color: k.nhan }}>{p}</span> : p)) : t);
  const to = (t: string) => t.split(/\*\*(.+?)\*\*/).map((p, i) => (i % 2 ? <span key={`n${i}`} style={{ fontSize: '180%', fontStyle: 'italic', color: k.nhan || k.mau }}>{p}</span> : <span key={`t${i}`}>{so(p, `t${i}`)}</span>));
  return (
    <div style={{ position: 'absolute', left: '5%', right: '5%', textAlign: 'center', pointerEvents: 'none', fontFamily: font, fontWeight: 900, fontSize: fs, lineHeight: 1.15, color: k.mau,
      WebkitTextStroke: `${vien}px ${k.vien}`, paintOrder: 'stroke fill', textShadow: '0 1px 4px rgba(0,0,0,.35)',
      ...(typeof k.y === 'number' ? { top: `${k.y * 100}%`, transform: 'translateY(-50%)' } : viTri === 'giua' ? { top: '50%', transform: 'translateY(-50%)' } : viTri === 'duoi' ? { top: '62%', transform: 'translateY(-50%)' } : { top: '14%' }) }}>
      {cau.dong.map((d, i) => <div key={i} style={{ transform: hep !== 1 ? `scaleX(${hep})` : undefined }}><span style={k.nen ? { background: k.nen, padding: '0.1em 0.4em', borderRadius: 4, WebkitTextStroke: '0' } : undefined}>{to(d)}</span></div>)}
    </div>
  );
}
