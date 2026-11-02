'use client';
// 🧭 LỘ TRÌNH KÊNH trong tab 📖 Phim của phim kênh (anh 02/11/2026: "dựng phần kênh nội dung và Studio để còn follow theo").
// Nguồn: scripts/lich-su/lo-trinh.json theo mã máy (kinh_thanh.may) — mos2 › Tài sản › 📺 Kênh nội dung đọc CÙNG tệp. Chỉ hiển thị; đổi giai đoạn = sửa tệp + commit.
import LT from '../../scripts/lich-su/lo-trinh.json';
import { mono } from './ui';

type TrangThai = 'cho_anh' | 'dang' | 'chua' | 'xong';
type GiaiDoan = { ma: string; ten: string; viec: string; anh: string; trang_thai: TrangThai };
type LoTrinh = { ten?: string; plan?: string; muc_tieu?: string; cap_nhat?: string; giai_doan: GiaiDoan[] };
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
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto minmax(0, 1fr) auto', gap: '4px 12px', alignItems: 'baseline', fontSize: 12 }}>
        {ds.map((g) => { const t = TT[g.trang_thai] ?? TT.chua, dang = g === h;
          return [
            <span key={`${g.ma}-a`} style={{ color: t.mau, whiteSpace: 'nowrap', fontWeight: dang ? 700 : 400 }}>{t.ic} {t.chu}</span>,
            <b key={`${g.ma}-b`} style={{ whiteSpace: 'nowrap', opacity: g.trang_thai === 'chua' ? 0.6 : 1 }}>{g.ma} {g.ten}</b>,
            <span key={`${g.ma}-c`} style={{ ...mono, opacity: g.trang_thai === 'chua' ? 0.7 : 1 }}>{g.viec}</span>,
            <span key={`${g.ma}-d`} style={{ ...mono, whiteSpace: 'nowrap' }} title="anh làm gì ở giai đoạn này">{g.anh && g.anh !== 'không' ? `anh: ${g.anh}` : '—'}</span>,
          ]; })}
      </div>
    </div>
  );
}
