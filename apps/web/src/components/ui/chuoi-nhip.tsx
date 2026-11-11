// CHUỖI NHỊP SẢN XUẤT — một hàng ô bước, mỗi ô một trạng thái (✓ xong · ▶ đang · ! lỗi · ⏸ dừng · chờ · – bỏ qua), có tên bước phía trên.
// Gom từ etp-dong (ChuoiBuoc, ô O): anh 12/11/2026 hỏi tab Máy SX "làm sao chia thành các nhịp rõ ràng thế này" chỉ vào bảng Sản xuất Ethopex —
// cùng MỘT bảng màu + ký hiệu cho mọi nguồn (Ethopex, Kênh nội dung, Social, Puzzle), không chép lại lần hai.
import type { CSSProperties } from 'react';

export type TtNhip = 'xong' | 'dang' | 'chay' | 'loi' | 'dung' | 'cho' | 'bo_qua';
export type Nhip = { ten: string; tt: TtNhip | string; /** chữ ngắn trong ô (vd "7h05", "3 đoạn") */ chu?: string | null; /** rê chuột */ ghi?: string | null };

export const NEN_NHIP: Record<string, string> = { xong: '#14532d', dang: '#1e3a8a', chay: '#1e3a8a', dung: '#78350f', loi: '#7f1d1d', cho: 'transparent', bo_qua: 'transparent' };
export const CHU_NHIP: Record<string, string> = { xong: '#86efac', dang: '#bfdbfe', chay: '#bfdbfe', dung: '#fcd34d', loi: '#fca5a5', cho: 'var(--fg-3)', bo_qua: 'var(--fg-3)' };
export const VIEN_NHIP: Record<string, string> = { xong: '#22c55e', dang: '#3b82f6', chay: '#3b82f6', dung: '#f59e0b', loi: '#ef4444', cho: 'var(--line)', bo_qua: 'var(--line)' };
export const KY_NHIP: Record<string, string> = { xong: '✓', dang: '▶', chay: '▶', dung: '⏸', loi: '!', cho: '·', bo_qua: '–' };

/** Một ô bước, khuôn viên nhạt (cấp 2 của bảng Sản xuất Ethopex). */
export function ONhip({ tt, chu, ghi, style }: { tt: string; chu?: string | null; ghi?: string | null; style?: CSSProperties }) {
  const rong = tt === 'cho' || tt === 'bo_qua';
  return <span title={ghi ?? undefined} style={{ minWidth: 0, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '0 6px', borderRadius: 11, fontSize: 9.5, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', background: rong ? 'transparent' : NEN_NHIP[tt], color: CHU_NHIP[tt] ?? 'var(--fg-3)', border: `1px ${rong ? 'dashed' : 'solid'} ${VIEN_NHIP[tt] ?? 'var(--line)'}`,
    animation: tt === 'dang' ? 'etpNhip 1.4s ease-in-out infinite' : undefined, ...style }}>{KY_NHIP[tt] ?? ''}{chu ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{chu}</span> : null}</span>;
}

/** Cả chuỗi: tên bước trên, ô dưới, chia đều cột. `cot` = số cột cố định (để các dòng cùng nguồn thẳng hàng) — mặc định = số nhịp. */
export function ChuoiNhip({ nhip, cot, rongO }: { nhip: Nhip[]; cot?: number; /** px mỗi ô; bỏ trống = chia đều bề rộng */ rongO?: number }) {
  const n = cot ?? nhip.length;
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, ${rongO ? `${rongO}px` : 'minmax(0, 1fr)'})`, gap: 2 }}>
    {nhip.map((x, i) => <span key={`t${i}`} style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={x.ten}>{x.ten}</span>)}
    {Array.from({ length: n - nhip.length }, (_, i) => <span key={`tt${i}`} />)}
    {nhip.map((x, i) => <ONhip key={`o${i}`} tt={x.tt} chu={x.chu} ghi={x.ghi ? `${x.ten}: ${x.ghi}` : x.ten} />)}
  </div>;
}
