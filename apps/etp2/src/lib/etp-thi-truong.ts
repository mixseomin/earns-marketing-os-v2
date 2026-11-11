// THỊ TRƯỜNG — CPM / CPC / ROI theo ngày Ethopex (UTC) + DỰ ĐOÁN ngày chưa tới (anh 11/11/2026: "Template Tổng quát: Thị trường để có được bảng CPM
// kia trong 30 ngày gần nhất… hoặc show theo kiểu lịch tháng. Ngày chưa đến thì dự đoán. Dùng màu sắc, số, gradient… để mô tả trực quan").
// Số thật: etp.cau_hinh.cpm_ngay (apps/etp/dong-bo.py ghi mỗi lượt từ báo cáo Ethopex của nhà).
// DỰ ĐOÁN = CPM nền × hệ số mùa ngày đó. NỀN = CPM HÔM QUA (ngày đã khép gần nhất) đã bỏ hệ số mùa của chính nó — đo 11/11/2026 trên 20 ngày số nhà
// (anh "có cái nào thêm hỗ trợ cho thông tin đúng hơn ko"): đoán 1 / 3 / 7 ngày tới sai TB 7 / 16 / 31% với nền hôm qua, 10 / 19 / 34% với TB 3 ngày,
// 18% (1 ngày) với TB 7 ngày → nền hôm qua. BIÊN SAI mỗi ô (±%) = sai số TB máy tự đo lại trên số thật mỗi lần tải (saiSo), không gõ tay.
// HỆ SỐ MÙA — ngày lễ chính chỉnh theo số công khai BFCM 2025 của Meta (cửa hàng TMĐT Mỹ, khác ngành nhà nhưng cùng phiên đấu giá):
//   Lebesgue (so tháng 9): Black Friday +84%, Cyber Monday +71%, thứ 3 sau +48%, thứ 4 sau +20% · Biddyco (so tháng 10): BF ~×2, CM +41% · AdScale: tuần 9/11 +4%.
//   Các khoảng khác (tuần trước lễ, tháng 12, sau Giáng sinh) là GIẢ ĐỊNH, chưa có nguồn — ô vẫn ghi biên sai đo được. ROI không dự đoán.
export type SoNuoc = { chi: number; cpm: number | null; roi: number | null };
export type SoNgay = { chi: number; cpm: number; cpc: number; roi: number | null; nuoc?: Record<string, SoNuoc> };   // nuoc: 8 nước chi nhiều nhất (dong-bo.py cpm_nuoc)
/** nhật ký dự đoán (etp.cau_hinh.cpm_du_doan, du_doan_cpm.py chụp 13:00 VN mỗi ngày): ngày làm → ngày đích → {cpm đoán, hệ số, dựng lại?} */
export type NhatKyDuDoan = Record<string, Record<string, { cpm: number; h: number; dl?: boolean }>>;
export type OThiTruong = { d: string; du: boolean; chi: number | null; cpm: number | null; cpc: number | null; roi: number | null; heSo: number; le: string | null; sai: number | null };

import SO_MUA from './etp-mua.json';
// hệ số mùa: MỘT NGUỒN etp-mua.json — máy chụp dự đoán hằng ngày apps/etp/du_doan_cpm.py đọc cùng tệp (nhật ký dự đoán ↔ thực tế)
const MUA = SO_MUA.mua as [string, string, number, string | null, boolean][];
export function heSo(d: string): { h: number; le: string | null; nguon: boolean } {
  const m = MUA.find(([a, b]) => a <= d && d <= b);
  return { h: m ? m[2] : 1, le: m && m[3] && d === m[0] ? m[3] : null, nguon: !m || m[4] };   // tên lễ chỉ ghi ở ngày đầu khoảng · ngoài mùa = ×1, không cần nguồn
}
export const congNgay = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const daKhep = (so: Record<string, SoNgay>, nay: string) => Object.entries(so).filter(([d, v]) => d < nay && v.cpm > 0).sort(([a], [b]) => (a < b ? -1 : 1));

/** nền = ngày đã khép gần nhất trước `nay`, đã bỏ hệ số mùa */
export function nen(so: Record<string, SoNgay>, nay: string): { cpm: number; cpc: number; roi: number | null; d: string } | null {
  const x = daKhep(so, nay).at(-1); if (!x) return null;
  const [d, v] = x, h = heSo(d).h;
  return { cpm: v.cpm / h, cpc: v.cpc / h, roi: v.roi, d };
}

/** mốc màu = CPM TB các ngày đã khép trong 30 ngày (ổn định — nền một ngày nhảy theo ngày, không dùng để tô màu) */
export function mocMau(so: Record<string, SoNgay>, nay: string): number | null {
  const ds = daKhep(so, nay).filter(([d]) => d >= congNgay(nay, -30));
  return ds.length ? ds.reduce((a, [, v]) => a + v.cpm, 0) / ds.length : null;
}

/** SAI SỐ ĐO TRÊN SỐ THẬT: đoán h ngày tới bằng đúng cách trên (nền ngày trước × hệ số mùa) → % lệch TB, theo h = 1 · 3 · 7. null = chưa đủ mẫu (< 5 lần) */
export function saiSo(so: Record<string, SoNgay>, nay: string): Record<1 | 3 | 7, number | null> {
  const ds = daKhep(so, nay), ra = { 1: null, 3: null, 7: null } as Record<1 | 3 | 7, number | null>;
  for (const h of [1, 3, 7] as const) {
    const e: number[] = [];
    for (let i = 1; i + h - 1 < ds.length; i++) {
      const [dn, vn] = ds[i - 1]!, [d, v] = ds[i + h - 1]!;
      e.push(Math.abs((vn.cpm / heSo(dn).h) * heSo(d).h - v.cpm) / v.cpm * 100);
    }
    ra[h] = e.length >= 5 ? e.reduce((a, b) => a + b, 0) / e.length : null;
  }
  return ra;
}

/** TỰ HIỆU CHỈNH HỆ SỐ MÙA (anh 11/11/2026 "thông tin đúng hơn"): mỗi ngày mùa (hệ số > 1) đã khép → phần tăng THẬT so với nền ngày trước ÷ phần tăng hệ số giả định.
 *  k = TB các tỉ số đó (≥ 2 ngày mùa đã khép, kẹp 0,3–2) → mọi ngày mùa CHƯA tới dùng hệ số 1 + (h − 1) × k. Chưa đủ 2 ngày mùa → null, dùng hệ số gốc. */
export function hieuChinh(so: Record<string, SoNgay>, nay: string): { k: number; n: number } | null {
  const ds = daKhep(so, nay), r: number[] = [];
  for (let i = 1; i < ds.length; i++) {
    const [d, v] = ds[i]!, [dn, vn] = ds[i - 1]!, h = heSo(d).h;
    if (h > 1.0001) r.push((v.cpm / (vn.cpm / heSo(dn).h) - 1) / (h - 1));
  }
  return r.length >= 2 ? { k: Math.max(0.3, Math.min(2, r.reduce((a, b) => a + b, 0) / r.length)), n: r.length } : null;
}

/** các ngày [tu, den]: ngày có số thật → số thật; ngày sau `nay` (chưa tới) → dự đoán + biên sai theo khoảng cách; ngày cũ không có số → trống */
export function ngayThiTruong(so: Record<string, SoNgay>, nay: string, tu: string, den: string): OThiTruong[] {
  const n = nen(so, nay), s = saiSo(so, nay), hc = hieuChinh(so, nay), ra: OThiTruong[] = [];
  for (let d = tu; d <= den; d = congNgay(d, 1)) {
    const v = so[d], { h, le } = heSo(d);
    if (v && v.cpm > 0) ra.push({ d, du: false, chi: v.chi, cpm: v.cpm, cpc: v.cpc, roi: v.roi, heSo: h, le, sai: null });
    else if (d > nay && n) {
      const xa = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${n.d}T00:00:00Z`)) / 86_400_000);   // khoảng cách tới ngày nền
      const hh = hc && h > 1 ? 1 + (h - 1) * hc.k : h;   // hệ số đã hiệu chỉnh theo các ngày mùa đã qua
      ra.push({ d, du: true, chi: null, cpm: n.cpm * hh, cpc: n.cpc * hh, roi: null, heSo: Math.round(hh * 100) / 100, le, sai: xa <= 1 ? s[1] : xa <= 3 ? s[3] : s[7] });
    } else ra.push({ d, du: false, chi: null, cpm: null, cpc: null, roi: null, heSo: h, le, sai: null });
  }
  return ra;
}

/** màu ô theo CPM / mốc: ≤ 0,8 xanh (rẻ) → 1,0 vàng → ≥ 1,6 đỏ (đắt) */
export function mauCpm(cpm: number | null, moc: number | null, alpha = 0.42): string {
  if (cpm == null || !moc) return 'transparent';
  const t = Math.max(0, Math.min(1, (cpm / moc - 0.8) / 0.8));
  return `hsla(${Math.round(140 * (1 - t))}, 75%, 45%, ${alpha})`;
}

/** DỰ ĐOÁN ↔ THỰC TẾ (anh 11/11/2026 "có log cụ thể xem dự đoán so với thực tế"): mỗi ngày đã khép có trong nhật ký → CPM thật + dự đoán làm trước 1 / 3 / 7 ngày
 *  + % lệch; dl = bản DỰNG LẠI (ngày trước khi máy bắt đầu chụp 11/11/2026 — đoán lại bằng đúng cách hiện tại trên số cũ), ghi rõ trên bảng. */
export type DongDoi = { d: string; that: number; doan: Record<1 | 3 | 7, { cpm: number; lech: number; dl: boolean } | null> };
export function doiChieu(so: Record<string, SoNgay>, nk: NhatKyDuDoan, nay: string, soNgay = 21): { dong: DongDoi[]; tb: Record<1 | 3 | 7, number | null> } {
  const dong: DongDoi[] = [];
  for (const [d, v] of daKhep(so, nay).slice(-soNgay).reverse()) {
    const doan = { 1: null, 3: null, 7: null } as DongDoi['doan'];
    for (const h of [1, 3, 7] as const) {
      const x = nk[congNgay(d, -h)]?.[d];
      if (x) doan[h] = { cpm: x.cpm, lech: ((x.cpm - v.cpm) / v.cpm) * 100, dl: !!x.dl };
    }
    if (doan[1] || doan[3] || doan[7]) dong.push({ d, that: v.cpm, doan });
  }
  const tb = { 1: null, 3: null, 7: null } as Record<1 | 3 | 7, number | null>;
  for (const h of [1, 3, 7] as const) { const e = dong.map((r) => r.doan[h]).filter((x): x is NonNullable<typeof x> => !!x).map((x) => Math.abs(x.lech)); tb[h] = e.length ? e.reduce((a, b) => a + b, 0) / e.length : null; }
  return { dong, tb };
}
