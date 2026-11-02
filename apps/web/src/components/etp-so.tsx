// SỐ ĐẾM etp (anh 02/11/2026 "Mọi số 0 đều phải để mờ" — luật YDNI): 0 / trống in màu mờ, số khác giữ màu chữ, chữ số đều cột.
// Một component cho mọi bảng etp (etp-view, etp-tong2-widget) — đừng in số đếm trần trong ô.
export const MO_SO = 'var(--fg-3)';
export function Dem({ v }: { v: number | null | undefined }) {
  return <span style={{ color: !v ? MO_SO : undefined, fontVariantNumeric: 'tabular-nums' }}>{v ?? '—'}</span>;
}
