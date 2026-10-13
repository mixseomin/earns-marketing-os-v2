'use client';
// Poster phim (poster.ts): poster đang dùng + các bản đã sinh (bấm để chọn) + ô ý tưởng + nút sinh có giá. Lỗi hiện ngay dưới nút —
// cả lỗi lúc bấm lẫn lỗi của lượt sinh chạy nền (docPhim › loiPoster).
import { useState } from 'react';
import { sinhPoster, chonPoster } from '@/lib/actions';
import { giaAnhCents, tien, type Phim } from '@/lib/xuong-video/kieu';
import { MO_HINH_POSTER, tenPoster, anchorPoster } from '@/lib/xuong-video/poster';
import type { NhanVat } from '@/lib/xuong-video/kieu';
import { Nut, Loi, mono } from './ui';

export function PosterPhim({ phim, nhanVat, dang, loiNen, onChanged }: { phim: Phim; nhanVat: NhanVat[]; dang: number; loiNen: string; onChanged: () => Promise<void> }) {
  const [yTuong, setYTuong] = useState('');
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const gia = giaAnhCents(MO_HINH_POSTER);
  const ds = phim.poster_uv ?? [];
  const nv = anchorPoster(nhanVat);
  const ly = !nv.length && 'chưa có anchor nào có ảnh mẫu — sinh ảnh mẫu nhân vật ở mục 2 trước';
  const lam = async (fn: () => Promise<{ ok: boolean; loi?: string }>) => {
    setBan(true); setLoi('');
    try { const r = await fn(); if (!r.ok) setLoi(r.loi ?? 'lỗi'); } catch (e) { setLoi(`Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'})`); }
    setBan(false); await onChanged();
  };
  return (
    <div className="xv-panel">
      <h3>Poster<small>dọc 2:3 · tên “{tenPoster(phim)}” là chữ duy nhất · nhân vật theo ảnh mẫu: {nv.map((v) => v.ten).join(', ') || '—'}</small></h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 150, aspectRatio: '2 / 3', borderRadius: 8, border: '1px solid var(--line)', background: phim.poster_url ? `center / cover no-repeat url(${phim.poster_url}), #111` : 'var(--bg-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {!phim.poster_url && <span style={mono}>{dang ? 'đang sinh…' : 'chưa có poster'}</span>}
        </div>
        <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 240 }}>
          <input className="xv-in" value={yTuong} onChange={(e) => setYTuong(e.target.value)} placeholder="Ý tưởng poster (tuỳ chọn) — vd: cáo ngồi trên cành nhìn miếng phô mai, quạ phía sau" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Nut chinh ly={ly} ban={ban} gia={gia} title="Gemini 3 Pro Image — vẽ chữ tên phim đúng chính tả nhất" onClick={() => void lam(() => sinhPoster(phim.id, yTuong))}>🎨 {ds.length ? 'Sinh thêm poster' : 'Sinh poster'} · {tien(gia)}</Nut>
            {dang > 0 && <span style={{ ...mono, color: 'var(--violet)' }}>⏳ đang sinh {dang} poster…</span>}
            {ly && <span style={{ fontSize: 11, color: 'var(--red)' }}>{ly}</span>}
          </div>
          <Loi>{loi || (dang ? '' : loiNen && `Lượt sinh poster gần nhất lỗi: ${loiNen}`)}</Loi>
          {ds.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ds.map((u) => (
                <img key={u} src={u} alt="" title={u === phim.poster_url ? 'poster đang dùng' : 'bấm để dùng poster này'} onClick={() => u !== phim.poster_url && void lam(() => chonPoster(phim.id, u))}
                  style={{ width: 54, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 5, cursor: 'pointer', border: `2px solid ${u === phim.poster_url ? 'var(--cyan)' : 'transparent'}` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
