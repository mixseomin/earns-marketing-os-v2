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
// LOẠI CREATIVE (badge) — MỘT sổ cho cây camp (etp-view) và tab Sản xuất (etp-dong, #1518)
// LOẠI CREATIVE dạng badge (anh 27/10/2026 "loại creative: kể chuyện, cảnh thật… dạng badge") — giá trị etp.creative.dang
export const MAU_DANG: Record<string, string> = { 'tập nguyên': '#fb7185', 'cảnh cuối': '#60a5fa', 'cảnh thật': '#4ade80', 'kể chuyện': '#c084fc', 'phim dài': '#f59e0b', 'làm mới': '#22d3ee',
  // năm kiểu dựng 0đ không theo góc spy (kieu-moi.py, anh 29/10/2026 "đa dạng cách tạo nội dung")
  'chọn phe': '#f472b6', 'bình luận': '#a3e635', 'ba khoảnh khắc': '#fbbf24', 'trước sau': '#34d399', 'tin nhắn': '#38bdf8' };
// MÃ NGẮN loại creative (anh 27/10/2026 "thêm loại creative badge như KT, CC") — một sổ cho badge cạnh số camp + bộ lọc Loại
export const MA_DANG: Record<string, string> = { 'tập nguyên': 'TN', 'kể chuyện': 'KT', 'cảnh cuối': 'CC', 'cảnh thật': 'CT', 'phim dài': 'PD', 'làm mới': 'LM', 'chọn phe': 'CP', 'bình luận': 'BL', 'ba khoảnh khắc': 'BK', 'trước sau': 'TS', 'tin nhắn': 'TI' };
export const BadgeDangNgan = ({ d }: { d: string | null }) => (d ? <span title={`loại creative: ${d}`} style={{ fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 4, marginLeft: 5, letterSpacing: '0.03em', color: MAU_DANG[d] ?? 'var(--fg-2)', border: `1px solid ${(MAU_DANG[d] ?? '#888')}66` }}>{MA_DANG[d] ?? d.slice(0, 2).toUpperCase()}</span> : null);
export const BadgeDang = ({ d, ngan }: { d: string | null; ngan?: boolean }) => (d ? <span title={`loại creative: ${d}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9, whiteSpace: 'nowrap', color: MAU_DANG[d] ?? 'var(--fg-2)', border: `1px solid ${(MAU_DANG[d] ?? '#888')}66`, background: `${MAU_DANG[d] ?? '#888'}1a` }}>{ngan ? MA_DANG[d] ?? d : d}</span> : null);
