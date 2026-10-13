'use client';
// Poster phim (poster.ts): poster đang dùng + các bản đã sinh (bấm để chọn) + ô ý tưởng + nút sinh có giá. Lỗi hiện ngay dưới nút —
// cả lỗi lúc bấm lẫn lỗi của lượt sinh chạy nền (docPhim › loiPoster).
import { useState } from 'react';
import { sinhPoster, chonPoster } from '@/lib/actions';
import { giaAnhCents, tien, type Phim } from '@/lib/xuong-video/kieu';
import { MO_HINH_POSTER, MAU_POSTER, tenPoster, anchorPoster, type MauPoster } from '@/lib/xuong-video/poster';
import type { NhanVat } from '@/lib/xuong-video/kieu';
import { Nut, Loi, mono, goiAction } from './ui';
import { useNho } from './nho';

export function PosterPhim({ phim, nhanVat, dang, loiNen, onChanged }: { phim: Phim; nhanVat: NhanVat[]; dang: number; loiNen: string; onChanged: () => Promise<void> }) {
  const [yTuong, setYTuong] = useState('');
  const [mau, setMau] = useState<MauPoster>('anh_hung');
  // Panel phụ → gập mặc định (YDNI luật 5); mở/gập nhớ theo phim. Đang sinh hoặc lỗi thì tự mở để thấy.
  const [moNho, setMo] = useNho<'0' | '1'>(`xv-poster-mo-${phim.id}`, '0', ['0', '1']);
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const gia = giaAnhCents(MO_HINH_POSTER);
  const ds = phim.poster_uv ?? [];
  const nv = anchorPoster(nhanVat);
  const ly = !nv.length && 'chưa có anchor nào có ảnh mẫu — sinh ảnh mẫu nhân vật (tab 🎭 Phim › mục 2) trước';
  const lam = async (fn: () => Promise<{ ok: boolean; loi?: string }>) => {
    setBan(true); setLoi('');
    setLoi((await goiAction(fn)).loi);
    setBan(false); await onChanged();
  };
  const mo = moNho === '1' || dang > 0 || !!loi;
  if (!mo) return (
    <div className="xv-panel" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px' }}>
      {phim.poster_url ? <img src={phim.poster_url} alt="" style={{ height: 44, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 4 }} /> : <span style={mono}>🎨</span>}
      <b style={{ fontSize: 13 }}>Poster</b><span style={mono}>{ds.length ? `${ds.length} bản` : 'chưa có'}</span>
      <button type="button" className="xv-btn" onClick={() => setMo('1')}>▾ {ds.length ? 'Đổi / sinh thêm' : 'Sinh poster'}</button>
    </div>
  );
  return (
    <div className="xv-panel">
      <h3><button type="button" className="xv-btn" style={{ marginRight: 6 }} onClick={() => setMo('0')} title="Gập">▴</button>Poster<small>dọc 2:3 · tên “{tenPoster(phim)}” là chữ duy nhất · nhân vật theo ảnh mẫu: {nv.map((v) => v.ten).join(', ') || '—'}</small></h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 150, aspectRatio: '2 / 3', borderRadius: 8, border: '1px solid var(--line)', background: phim.poster_url ? `center / cover no-repeat url(${phim.poster_url}), #111` : 'var(--bg-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {!phim.poster_url && <span style={mono}>{dang ? 'đang sinh…' : 'chưa có poster'}</span>}
        </div>
        <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 240 }}>
          {/* Mẫu bố cục: bấm chọn là đủ để sinh; ô chữ chỉ để thêm ý. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MAU_POSTER.map((m) => <button key={m.key} type="button" className={`xv-btn${mau === m.key ? ' chinh' : ''}`} title={m.mo} onClick={() => setMau(m.key)}>{m.nhan}</button>)}
          </div>
          <div style={mono}>{MAU_POSTER.find((m) => m.key === mau)?.mo}</div>
          <input className="xv-in" value={yTuong} onChange={(e) => setYTuong(e.target.value)} placeholder="Thêm ý (không bắt buộc) — vd: quạ ngậm miếng phô mai, cáo nhìn lên" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Nut chinh ly={ly || (dang > 0 && 'đang sinh poster — đợi xong')} ban={ban} gia={gia} title="Gemini 3 Pro Image — vẽ chữ tên phim đúng chính tả nhất" onClick={() => void lam(() => sinhPoster(phim.id, yTuong, mau))}>🎨 {ds.length ? 'Sinh thêm poster' : 'Sinh poster'} · {tien(gia)}</Nut>
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
