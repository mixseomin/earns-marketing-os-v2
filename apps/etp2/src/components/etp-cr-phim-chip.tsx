'use client';
// CHIP "🎬 N · ＋" trên hàng tên phim của bảng Camp (anh 23/11/2026): N = creative đã có (+ bản đang soạn) → mở ngăn creative của phim; ＋ = mở thẳng bản soạn mới.
// Đếm đọc riêng một lượt cho cả trang (demCrPhim), không nhồi vào etp-doc; ngăn kéo báo 'etp-cr-phim' khi đổi gì → đếm lại.
import { useEffect, useState } from 'react';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { demCrPhim } from '@/lib/actions/etp-cr-phim';

export type DemCr = Record<number, { cr: number; soan: number }>;

/** đếm creative + bản soạn của các phim đang hiện; khoá theo danh sách mã để không đọc lại mỗi lần vẽ */
export function useDemCrPhim(ids: number[]): DemCr {
  const khoa = [...new Set(ids.filter((x) => x > 0))].sort((a, b) => a - b).join(',');
  const [dem, setDem] = useState<DemCr>({});
  useEffect(() => {
    if (!khoa) return;
    let song = true;
    const doc = () => { demCrPhim(khoa.split(',').map(Number)).then((r) => { if (song) setDem(r); }).catch(() => { /* chip chỉ là số đếm phụ: lỗi thì giữ số cũ, ngăn kéo tự báo lỗi khi mở */ }); };
    doc(); window.addEventListener('etp-cr-phim', doc);
    return () => { song = false; window.removeEventListener('etp-cr-phim', doc); };
  }, [khoa]);
  return dem;
}

const NUT = { all: 'unset', cursor: 'pointer', padding: '0 6px', fontSize: 11, lineHeight: '18px' } as const;

export function ChipCrPhim({ cid, dem }: { cid: number; dem?: { cr: number; soan: number } }) {
  if (!(cid > 0)) return null;
  const cr = dem?.cr ?? 0, soan = dem?.soan ?? 0;
  const chan = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
  return <span onClick={chan} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 10, fontWeight: 400, flexShrink: 0 }}>
    <button type="button" style={NUT} title={`creative của phim: ${cr} đã có${soan ? ` · ${soan} bản đang soạn` : ''} — bấm xem, sửa, lên camp`}
      onClick={(e) => { chan(e); openEntityDrawer('etp-cr-phim', String(cid)); }}>🎬 {cr}</button>
    {soan ? <><span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
      <button type="button" style={{ ...NUT, color: '#fbbf24' }} title={`${soan} bản nháp / đang dựng — bấm mở bản nháp`} onClick={(e) => { chan(e); openEntityDrawer('etp-cr-phim', `${cid}:nhap`); }}>✎ {soan}</button></> : null}
    <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
    <button type="button" style={NUT} title="soạn creative mới cho phim này" onClick={(e) => { chan(e); openEntityDrawer('etp-cr-phim', `${cid}:moi`); }}>＋</button>
  </span>;
}
