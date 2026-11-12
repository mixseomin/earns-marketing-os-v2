'use client';
// Ô 🚦 CỔNG TIỀN HÌNH trên Lưới kịch bản (anh 12/11/2026: "studio phải thể hiện rõ những thông tin chấm và block này"): điểm Murch cả tập so ngưỡng +
// từng lỗi máy đo trên 3D theo shot (người nói không thấy mặt, thoại trong toàn cảnh, liền mạch). Cùng hàm với cổng keyframe (cong-video-tho.ts) —
// thấy ĐÓNG ở đây thì nút sinh keyframe cũng chặn đúng các câu này. Bấm số shot = mở shot đó.
import { useState } from 'react';
import { mauDiem } from '@/lib/xuong-video/diem-murch';
import type { CongVideoTho } from '@/lib/xuong-video/cong-video-tho';
import type { KqTheLoai } from '@/lib/xuong-video/cham-the-loai';

export function OCongMay({ k, chan, onMo, tl, tenTl }: { k: CongVideoTho; /** phim bật video thô: ô này LÀ cổng keyframe; không bật = chỉ để xem */ chan: boolean; onMo: (id: number) => void; /** chấm thể loại (cham-the-loai.ts) — null = thể loại chưa có bộ chấm */ tl?: KqTheLoai | null; tenTl?: string }) {
  const [mo, setMo] = useState(false);
  const theoShot = new Map<number, { thu_tu: number; ly: CongVideoTho['loi'] }>();
  for (const l of k.loi) (theoShot.get(l.id) ?? theoShot.set(l.id, { thu_tu: l.thu_tu, ly: [] }).get(l.id)!).ly.push(l);
  const ds = [...theoShot.entries()].sort((a, b) => a[1].thu_tu - b[1].thu_tu); const hien = mo ? ds : ds.slice(0, 4);
  const trang = !chan ? { chu: 'CHỈ XEM', mau: 'var(--fg-3)', y: 'Phim này không bật cổng video thô — điểm và lỗi để tham khảo, không chặn keyframe' }
    : k.mo ? { chu: 'MỞ', mau: '#4ade80', y: 'Máy chấm đạt: được sinh keyframe' } : { chu: 'ĐÓNG', mau: 'var(--red)', y: 'Máy chấm chưa đạt: nút sinh keyframe đang chặn đúng các lỗi dưới đây' };
  return (
    <div style={{ border: `1px solid ${chan && !k.mo ? 'var(--red)' : 'var(--line)'}`, borderRadius: 6, padding: '6px 10px', display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12 }}>🚦 Cổng tiền hình · máy chấm</b>
        <span title={trang.y} style={{ fontSize: 11, fontWeight: 700, color: trang.mau, border: `1px solid ${trang.mau}`, borderRadius: 3, padding: '0 6px' }}>{trang.chu}</span>
        <span className="xv-mono" style={{ fontSize: 11 }} title="Điểm Murch trung bình cả tập (diem-murch.ts — Rule of Six: cảm xúc 51 · truyện 23 · nhịp 10 · eye trace 7 · trục 5 · không gian 4)">
          Murch cả tập <b style={{ color: mauDiem(k.diem) }}>{k.diem}</b>/100 · cần ≥ {k.nguong}</span>
        <span className="xv-mono" style={{ fontSize: 11, color: k.loi.length ? 'var(--red)' : '#4ade80' }}>{k.loi.length ? `${k.loi.length} lỗi ở ${ds.length} shot` : 'không lỗi đo được'}</span>
        <span className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{trang.y}</span>
      </div>
      {hien.map(([id, s]) => (
        <div key={id} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 11 }}>
          <button type="button" className="xv-btn" style={{ padding: '0 6px', flex: 'none' }} title="Mở shot" onClick={() => onMo(id)}>#{s.thu_tu}</button>
          <span style={{ display: 'grid', gap: 1 }}>{s.ly.map((l, i) => (
            <span key={i} style={{ color: l.loai === 'nguoi_noi' ? 'var(--red)' : 'var(--amber)' }} title={l.ly}>{l.loai === 'nguoi_noi' ? '🗣 ' : '⛓ '}{l.ly}</span>
          ))}</span>
        </div>
      ))}
      {tenTl && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 4, display: 'grid', gap: 2 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12 }}>🎭 Chấm thể loại · {tenTl}</b>
            {tl ? <span className="xv-mono" style={{ fontSize: 11 }} title="Tỉ lệ tiêu chí ngành của thể loại đạt (cham-the-loai.ts) — tham khảo, chưa chặn keyframe">
              <b style={{ color: mauDiem(tl.diem) }}>{tl.diem}</b>/100 · {tl.tieu_chi.filter((x) => x.dat).length}/{tl.tieu_chi.filter((x) => x.dat !== null).length} tiêu chí đạt</span>
              : <span className="xv-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>chưa có bộ chấm cho thể loại này</span>}
          </div>
          {tl?.tieu_chi.map((x, i) => (
            <span key={i} style={{ fontSize: 11, color: x.dat ? '#4ade80' : x.dat === false ? 'var(--amber)' : 'var(--fg-3)' }} title={x.nguon ? `Nguồn ngành: ${x.nguon}` : undefined}>
              {x.dat ? '✓' : x.dat === false ? '✗' : '?'} {x.ten}: {x.ly}</span>
          ))}
        </div>
      )}
      {ds.length > 4 && <button type="button" className="xv-btn" style={{ justifySelf: 'start', padding: '0 8px', fontSize: 11 }} onClick={() => setMo(!mo)}>{mo ? 'Thu gọn' : `Xem cả ${ds.length} shot lỗi`}</button>}
    </div>
  );
}
