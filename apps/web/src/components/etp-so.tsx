// SỐ ĐẾM etp (anh 02/11/2026 "Mọi số 0 đều phải để mờ" — luật YDNI): 0 / trống in màu mờ, số khác giữ màu chữ, chữ số đều cột.
// Một component cho mọi bảng etp (etp-view, etp-tong2-widget) — đừng in số đếm trần trong ô.
export const MO_SO = 'var(--fg-3)';
export function Dem({ v }: { v: number | null | undefined }) {
  return <span style={{ color: !v ? MO_SO : undefined, fontVariantNumeric: 'tabular-nums' }}>{v ?? '—'}</span>;
}
// CỘT TIỀN KIỂU KẾ TOÁN (anh 26/10/2026, luật YDNI): "$" dính mép trái ô, số dính mép phải, có dấu phẩy nghìn, số âm trong ngoặc (1.10) — cột thẳng hàng dấu thập phân; 0 thì mờ.
// Một component cho mọi bảng etp (etp-view, tab Sản xuất etp-dong #1517) — đừng in "$-0.25" trần.
export const mauLai = (v: number) => (v > 0 ? 'var(--neon-lime, #4ade80)' : 'var(--neon-red, #f87171)');
export function KeToan({ v, mau }: { v: number; mau?: string }) {
  const khong = Math.abs(v) < 0.005, so = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, width: '100%', paddingLeft: 12, boxSizing: 'border-box', color: khong ? MO_SO : mau, fontVariantNumeric: 'tabular-nums' }}><span style={{ opacity: 0.6 }}>$</span><span>{v < 0 && !khong ? `(${so})` : so}</span></span>;
}
// LOẠI CREATIVE (badge + bộ lọc Loại) — đọc SỔ DẠNG một nơi lib/etp-dang.json (anh 08/11/2026 "các thể loại mới mày cứ mỗi nơi làm 1 cái à"); máy Python đọc cùng tệp
// qua apps/etp/so_dang.py, lưới apps/etp/kiem-so-dang.mjs báo đỏ bảng dạng tự khai ở chỗ khác (dong-bo.py chạy mỗi lượt → cảnh báo Telegram). Thêm dạng = thêm một mục trong sổ.
export { DS_DANG, MAU_DANG, MA_DANG, DANG_DONG, dangTheoTen, tenGiong, type MucDang } from '@/lib/etp-dang';
import { tenGiong as tenGiong_ } from '@/lib/etp-dang';
import { MAU_DANG, MA_DANG } from '@/lib/etp-dang';
export const BadgeDangNgan = ({ d, ban, giong }: { d: string | null; ban?: string | null; giong?: string | null }) => (d ? <span title={`loại creative: ${d}${ban ? ` · bản ${ban}` : ''}${giong ? ` · giọng ${tenGiong_(giong)}` : ''}`} style={{ fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 4, marginLeft: 5, letterSpacing: '0.03em', color: MAU_DANG[d] ?? 'var(--fg-2)', border: `1px solid ${(MAU_DANG[d] ?? '#888')}66` }}>{ban ?? MA_DANG[d] ?? d.slice(0, 2).toUpperCase()}{giong ? <span style={{ fontWeight: 400, opacity: 0.85 }}> · {tenGiong_(giong)}</span> : null}</span> : null);
export const BadgeDang = ({ d, ngan, ban, giong }: { d: string | null; ngan?: boolean; ban?: string | null; giong?: string | null }) => (d ? <span title={`loại creative: ${d}${ban ? ` · bản ${ban}` : ''}${giong ? ` · giọng ${tenGiong_(giong)}` : ''}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9, whiteSpace: 'nowrap', color: MAU_DANG[d] ?? 'var(--fg-2)', border: `1px solid ${(MAU_DANG[d] ?? '#888')}66`, background: `${MAU_DANG[d] ?? '#888'}1a` }}>{ngan ? ban ?? MA_DANG[d] ?? d : ban ? `${d} ${ban}` : d}{giong ? <span style={{ opacity: 0.85 }}> · {tenGiong_(giong)}</span> : null}</span> : null);
