// THỊ TRƯỜNG — CPM / CPC / ROI theo ngày Ethopex (UTC) + DỰ ĐOÁN ngày chưa tới (anh 11/11/2026: "Template Tổng quát: Thị trường để có được bảng CPM
// kia trong 30 ngày gần nhất… hoặc show theo kiểu lịch tháng. Ngày chưa đến thì dự đoán. Dùng màu sắc, số, gradient… để mô tả trực quan").
// Số thật: etp.cau_hinh.cpm_ngay (apps/etp/dong-bo.py ghi mỗi lượt từ báo cáo Ethopex của nhà). Dự đoán = CPM nền × hệ số mùa của ngày đó, trong đó
// CPM nền = TB 7 ngày đã khép gần nhất ĐÃ BỎ hệ số mùa của chính các ngày đó. HỆ SỐ MÙA LÀ GIẢ ĐỊNH (lịch bán lẻ Mỹ 2026: Lễ Tạ ơn 26/11, Black Friday 27/11,
// Cyber Monday 30/11, Giáng sinh) — chưa đo trên số nhà; khi có số thật ngày đó thì ô hiện số thật. ROI không dự đoán (không có mô hình đủ tin).
export type SoNgay = { chi: number; cpm: number; cpc: number; roi: number | null };
export type OThiTruong = { d: string; du: boolean; chi: number | null; cpm: number | null; cpc: number | null; roi: number | null; heSo: number; le: string | null };

const MUA: [string, string, number, string | null][] = [   // [từ, đến (gồm), hệ số, tên ngày lễ]
  ['2026-11-11', '2026-11-11', 1.0, '11/11'],
  ['2026-11-16', '2026-11-22', 1.1, null],
  ['2026-11-23', '2026-11-25', 1.25, null],
  ['2026-11-26', '2026-11-26', 1.4, 'Tạ ơn'],
  ['2026-11-27', '2026-11-27', 1.6, 'Black Friday'],
  ['2026-11-28', '2026-11-29', 1.45, null],
  ['2026-11-30', '2026-11-30', 1.55, 'Cyber Monday'],
  ['2026-12-01', '2026-12-01', 1.35, null],
  ['2026-12-02', '2026-12-13', 1.2, null],
  ['2026-12-14', '2026-12-20', 1.3, null],
  ['2026-12-21', '2026-12-24', 1.35, null],
  ['2026-12-25', '2026-12-25', 1.05, 'Giáng sinh'],
  ['2026-12-26', '2026-12-31', 0.85, null],
  ['2027-01-01', '2027-01-05', 0.8, 'Năm mới'],
];
export function heSo(d: string): { h: number; le: string | null } {
  const m = MUA.find(([a, b]) => a <= d && d <= b);
  return { h: m ? m[2] : 1, le: m && m[3] && d === m[0] ? m[3] : null };   // tên lễ chỉ ghi ở ngày đầu khoảng
}
export const congNgay = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** nền đã bỏ mùa: TB 7 ngày đã khép gần nhất (trước `nay`, có CPM) chia hệ số mùa từng ngày */
export function nen(so: Record<string, SoNgay>, nay: string): { cpm: number; cpc: number; roi: number | null; n: number } | null {
  const ds = Object.entries(so).filter(([d, v]) => d < nay && v.cpm > 0).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 7);
  if (ds.length < 3) return null;
  const tb = (f: (v: SoNgay, d: string) => number) => ds.reduce((a, [d, v]) => a + f(v, d), 0) / ds.length;
  const rs = ds.map(([, v]) => v.roi).filter((r): r is number => r != null);
  return { cpm: tb((v, d) => v.cpm / heSo(d).h), cpc: tb((v, d) => v.cpc / heSo(d).h), roi: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null, n: ds.length };
}

/** các ngày [tu, den]: ngày có số thật → số thật; ngày sau `nay` (chưa tới) → dự đoán; ngày cũ không có số → trống */
export function ngayThiTruong(so: Record<string, SoNgay>, nay: string, tu: string, den: string): OThiTruong[] {
  const n = nen(so, nay), ra: OThiTruong[] = [];
  for (let d = tu; d <= den; d = congNgay(d, 1)) {
    const v = so[d], { h, le } = heSo(d);
    if (v && v.cpm > 0) ra.push({ d, du: false, chi: v.chi, cpm: v.cpm, cpc: v.cpc, roi: v.roi, heSo: h, le });
    else if (d > nay && n) ra.push({ d, du: true, chi: null, cpm: n.cpm * h, cpc: n.cpc * h, roi: null, heSo: h, le });
    else ra.push({ d, du: false, chi: null, cpm: null, cpc: null, roi: null, heSo: h, le });
  }
  return ra;
}

/** màu ô theo CPM / nền: ≤ 0,8 xanh (rẻ) → 1,0 vàng → ≥ 1,6 đỏ (đắt) */
export function mauCpm(cpm: number | null, nenCpm: number | null, alpha = 0.42): string {
  if (cpm == null || !nenCpm) return 'transparent';
  const t = Math.max(0, Math.min(1, (cpm / nenCpm - 0.8) / 0.8));
  return `hsla(${Math.round(140 * (1 - t))}, 75%, 45%, ${alpha})`;
}
