'use client';
// 🧭 LỘ TRÌNH KÊNH trong tab 📖 Phim của phim kênh (anh 02/11/2026: "dựng phần kênh nội dung và Studio để còn follow theo").
// Nguồn: scripts/lich-su/lo-trinh.json theo mã máy (kinh_thanh.may) — mos2 › Tài sản › 📺 Kênh nội dung đọc CÙNG tệp. Chỉ hiển thị; đổi giai đoạn = sửa tệp + commit.
import LT from '../../scripts/lich-su/lo-trinh.json';
import { mono } from './ui';
import type { CSSProperties } from 'react';

type TrangThai = 'cho_anh' | 'dang' | 'chua' | 'xong';
type GiaiDoan = { ma: string; ten: string; viec: string; anh: string; trang_thai: TrangThai };
type Playlist = { ma: string; ten: string; tien_to?: string; noi_dung?: string; ho_hinh?: string; ngay?: string; trang_dich?: string; mo_dau?: boolean; trang_thai: 'de_xuat' | 'mo' | 'sau' | 'tam_dung'; khi?: string };
type LoTrinh = { ten?: string; plan?: string; muc_tieu?: string; cap_nhat?: string; playlist?: Playlist[]; giai_doan: GiaiDoan[] };
const PL: Record<Playlist['trang_thai'], { ic: string; chu: string; mau: string }> = {
  mo: { ic: '▶', chu: 'đang mở', mau: 'var(--green)' }, de_xuat: { ic: '📝', chu: 'đề xuất', mau: 'var(--accent)' },
  sau: { ic: '○', chu: 'mở sau', mau: 'var(--fg-4)' }, tam_dung: { ic: '⏸', chu: 'tạm dừng', mau: 'var(--warn)' },
};
const tomTat: CSSProperties = { cursor: 'pointer', fontWeight: 700, fontSize: 12, userSelect: 'none' };
const REPO = 'https://github.com/mixseomin/earns-marketing-os-v2/blob/main';
const TT: Record<TrangThai, { ic: string; chu: string; mau: string }> = {
  xong: { ic: '✅', chu: 'xong', mau: 'var(--green)' }, dang: { ic: '▶', chu: 'đang làm', mau: 'var(--warn)' },
  cho_anh: { ic: '⏸', chu: 'chờ anh', mau: 'var(--accent)' }, chua: { ic: '○', chu: 'chưa tới', mau: 'var(--fg-4)' },
};

/** Lộ trình của một máy (null = máy không khai). */
export const loTrinhCuaMay = (may: string | undefined): LoTrinh | null => {
  const x = may ? (LT as Record<string, unknown>)[may] : null;
  return x && typeof x === 'object' && Array.isArray((x as LoTrinh).giai_doan) ? (x as LoTrinh) : null;
};

export function LoTrinhKenh({ may }: { may: string | undefined }) {
  const lt = loTrinhCuaMay(may);
  if (!lt) return null;
  const ds = lt.giai_doan, xong = ds.filter((g) => g.trang_thai === 'xong').length, h = ds.find((g) => g.trang_thai !== 'xong');
  return (
    <div className="xv-panel" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b>🧭 Lộ trình kênh · {xong}/{ds.length} xong</b>
        <span style={mono}>{h ? `đang ở ${h.ma} ${h.ten}` : 'đã tự vận hành'}{lt.cap_nhat ? ` · cập nhật ${lt.cap_nhat.slice(8, 10)}/${lt.cap_nhat.slice(5, 7)}` : ''}</span>
        {lt.plan && <a className="xv-lienket" href={`https://href.li/?${REPO}/${lt.plan}`} target="_blank" rel="noreferrer" style={{ ...mono, marginLeft: 'auto' }}>tệp kế hoạch ↗</a>}
      </div>
      {lt.muc_tieu && <div style={mono}>Đích: {lt.muc_tieu}</div>}
      {!!lt.playlist?.length && <details open>
        <summary style={tomTat}>📂 Playlist ({lt.playlist.length}) <span style={{ ...mono, fontWeight: 400 }}>· đề xuất chờ G0 chốt, mở đầu đứng trước</span></summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto minmax(0, 1fr)', gap: '4px 12px', alignItems: 'baseline', fontSize: 12, marginTop: 6 }}>
          {[...lt.playlist].sort((a, b) => Number(!!b.mo_dau) - Number(!!a.mo_dau)).map((p) => { const t = PL[p.trang_thai] ?? PL.sau;
            return [
              <span key={`${p.ma}-a`} style={{ color: t.mau, whiteSpace: 'nowrap' }}>{t.ic} {t.chu}{p.mo_dau ? ' · mở đầu' : p.khi ? ` · ${p.khi}` : ''}</span>,
              <b key={`${p.ma}-b`} style={{ whiteSpace: 'nowrap' }}>{p.ten}</b>,
              <span key={`${p.ma}-c`} style={mono}>{[p.noi_dung, p.ho_hinh && `hình ${p.ho_hinh}`, p.ngay && p.ngay !== '—' && `ngày ${p.ngay}`, p.trang_dich && `→ ${p.trang_dich}`, p.tien_to && `tiêu đề "${p.tien_to}"`].filter(Boolean).join(' · ')}</span>,
            ]; })}
        </div>
      </details>}
      <details open>
      <summary style={tomTat}>🧭 Giai đoạn ({xong}/{ds.length} xong)</summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto minmax(0, 1fr) auto', gap: '4px 12px', alignItems: 'baseline', fontSize: 12, marginTop: 6 }}>
        {ds.map((g) => { const t = TT[g.trang_thai] ?? TT.chua, dang = g === h;
          return [
            <span key={`${g.ma}-a`} style={{ color: t.mau, whiteSpace: 'nowrap', fontWeight: dang ? 700 : 400 }}>{t.ic} {t.chu}</span>,
            <b key={`${g.ma}-b`} style={{ whiteSpace: 'nowrap', opacity: g.trang_thai === 'chua' ? 0.6 : 1 }}>{g.ma} {g.ten}</b>,
            <span key={`${g.ma}-c`} style={{ ...mono, opacity: g.trang_thai === 'chua' ? 0.7 : 1 }}>{g.viec}</span>,
            <span key={`${g.ma}-d`} style={{ ...mono, whiteSpace: 'nowrap' }} title="anh làm gì ở giai đoạn này">{g.anh && g.anh !== 'không' ? `anh: ${g.anh}` : '—'}</span>,
          ]; })}
      </div>
      </details>
    </div>
  );
}
