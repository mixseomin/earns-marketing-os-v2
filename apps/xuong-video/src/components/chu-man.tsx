'use client';
// Chữ màn trên ô xem trước (timeline, animatic) vẽ GIỐNG bản xuất: cùng kiểu chữ của phim (qc.kieu_chu: font, màu, viền, màu nhấn số),
// cùng vị trí (qc.vi_tri_chu), đổi câu theo giây trong shot ("@0.9 …") — xem trên trang là thấy đúng thứ sẽ ra MP4.
import { doanChuMan, gopKieu, type KieuChu, type ThongTinQc } from '@/lib/xuong-video/kieu';
import { dongChuMan, emCss } from '@/lib/xuong-video/ngat-dong';

export function ChuManXem({ chu, giay, rong, qc, kieu }: { chu: string; giay: number; rong: number; qc?: ThongTinQc | null; kieu?: KieuChu }) {
  const doan = doanChuMan(chu, 999);
  if (!doan.length) return null;
  const cau = [...doan].reverse().find((d) => d.tu <= giay + 0.001) ?? doan[0]!;
  const k = gopKieu(qc?.kieu_chu, kieu);
  // Ngắt + thu nhỏ y như bản xuất (dongChuMan); CSS tính cỡ theo em còn libass theo winAscent+winDescent → quy đổi bằng emCss, kẻo ô xem to hơn MP4.
  const ng = cau.dong.map((d) => (/\*\*/.test(d) ? { dong: [d], co: 1 } : dongChuMan(d, rong, k)));
  const fsAss = rong * k.co * Math.min(...ng.map((x) => x.co)); const em = emCss(k.font);
  const fs = Math.max(9, Math.round(fsAss * em));
  const hep = k.ngang / 100;
  const vien = Math.max(1, Math.round(fsAss * k.vien_day));
  const viTri = qc?.vi_tri_chu ?? 'tren';
  const font = k.font === 'DejaVu Sans' ? 'system-ui, sans-serif' : `"${k.font}", "Montserrat", system-ui, sans-serif`;
  const so = (t: string, kh: string) => (k.nhan ? t.split(/([0-9?$%]+)/).map((p, i) => (i % 2 ? <span key={`${kh}${i}`} style={{ color: k.nhan }}>{p}</span> : p)) : t);
  const to = (t: string) => t.split(/\*\*(.+?)\*\*/).map((p, i) => (i % 2 ? <span key={`n${i}`} style={{ fontSize: '180%', fontStyle: 'italic', color: k.nhan || k.mau }}>{p}</span> : <span key={`t${i}`}>{so(p, `t${i}`)}</span>));
  return (
    <div style={{ position: 'absolute', left: '5%', right: '5%', textAlign: 'center', pointerEvents: 'none', fontFamily: font, fontWeight: 900, fontSize: fs, lineHeight: 1 / em, color: k.mau,
      WebkitTextStroke: `${vien}px ${k.vien}`, paintOrder: 'stroke fill', textShadow: '0 1px 4px rgba(0,0,0,.35)',
      ...(typeof k.y === 'number' ? { top: `${k.y * 100}%`, transform: 'translateY(-50%)' } : viTri === 'giua' ? { top: '50%', transform: 'translateY(-50%)' } : viTri === 'duoi' ? { top: '62%', transform: 'translateY(-50%)' } : { top: '14%' }) }}>
      <div key={`${cau.tu}`} className={k.vao ? `xv-chu-${k.vao}` : undefined}>
      {ng.flatMap((x) => x.dong).map((d, i) => <div key={i} style={{ whiteSpace: 'nowrap', transform: hep !== 1 ? `scaleX(${hep})` : undefined }}><span style={k.nen ? { background: k.nen, padding: '0.1em 0.4em', borderRadius: 4, WebkitTextStroke: '0' } : undefined}>{to(d)}</span></div>)}
      </div>
    </div>
  );
}
