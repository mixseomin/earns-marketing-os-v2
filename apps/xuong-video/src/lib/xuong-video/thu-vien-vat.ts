// THƯ VIỆN ĐẠO CỤ / VẬT DỤNG dùng chung mọi phim (anh 01/11/2026: "đạo cụ, đồ vật này phải cho vào thư viện để dùng cho nhiều dự án khác; sau này
// không phải nghĩ lại các phần như công năng — chỉ bổ sung nếu tìm thêm được cái mới"). Dữ liệu: scripts/du-lieu/thu-vien/vat-dung.json (thêm vật /
// công năng = thêm một dòng). Anchor của phim trỏ vào bằng xv_nhan_vat.thu_vien_vat → cây 🧩 Thành phần đánh dấu 📚 + nhánh 🧰 Công năng; máy sinh gag
// rút lời giải từ công năng (claude.ts › vietGag); Thư viện › 🧰 Đạo cụ & vật dụng để tìm. Thuần — client lẫn server dùng được.
import VD from '../../../scripts/du-lieu/thu-vien/vat-dung.json';

export type CongNang = { ten: string; mo_ta: string };
/** bộ phận của vật (ghế: mặt, chân…) — cong_nang = tên công năng của vật mà bộ phận này gánh */
export type BoPhan = { ten: string; mo_ta: string; cong_nang: string[] };
export type VatThuVien = { ma: string; ten: string; nhom: string; the: string[]; /** mô tả hình (tiếng Anh) — anchor mới lấy làm mo_ta */ mo_ta: string; cau_tao: string; cong_nang: CongNang[]; bo_phan?: BoPhan[]; nguon: string };
export const VAT_DUNG = VD.vat as VatThuVien[];
export const NHOM_VAT = VD.nhom as Record<string, string>;
/** CÔNG NĂNG PHỐI HỢP: dùng chung nhiều vật sinh ra công năng mới mà từng vật riêng không có (anh 01/11/2026). */
export type PhoiHop = { vat: string[]; ten: string; mo_ta: string };
export const PHOI_HOP = (VD.phoi_hop ?? []) as PhoiHop[];
/** Phối hợp có vật `ma`; truyền `co` (mã các vật phim đang có) thì chỉ giữ phối hợp đủ vật trong phim. */
export const phoiHopCua = (ma: string, co?: string[]): PhoiHop[] => PHOI_HOP.filter((p) => p.vat.includes(ma) && (!co || p.vat.every((x) => x === ma || co.includes(x))));
/** Khối dặn máy sinh gag: mọi phối hợp đủ vật trong phim. */
export const vanPhoiHop = (co: string[]): string => {
  const ds = PHOI_HOP.filter((p) => p.vat.every((x) => co.includes(x)));
  return ds.length ? `CÔNG NĂNG PHỐI HỢP (các vật phim đang có dùng chung — gag mạnh thường đến từ đây):\n${ds.map((p) => `- ${p.ten} (${p.vat.map((x) => KHO_VAT[x]?.ten ?? x).join(' + ')}): ${p.mo_ta}`).join('\n')}` : '';
};
/** Bản cũ gọi theo khoá → { ten, cau_tao, cong_nang } (máy sinh gag, sổ tay). Một nguồn với VAT_DUNG. */
export const KHO_VAT: Record<string, VatThuVien> = Object.fromEntries(VAT_DUNG.map((v) => [v.ma, v]));
export const vatThuVien = (ma: string | null | undefined): VatThuVien | null => (ma ? KHO_VAT[ma] ?? null : null);
/** Vật trong thư viện liên quan tới một nơi / chủ đề (khớp thẻ hoặc tên) — máy sinh gag kèm làm đạo cụ phụ của phố. */
export const vatTheoThe = (tu: string[]): VatThuVien[] => VAT_DUNG.filter((v) => tu.some((t) => v.the.some((x) => x.toLowerCase() === t.toLowerCase())));
export const vanKhoVat = (k: string | null | undefined): string => {
  const v = vatThuVien(k); if (!v) return '';
  return `KHO CÔNG NĂNG VẬT ĐẶC TRƯNG — ${v.ten} (${v.cau_tao}). Mỗi gag lấy lời giải từ MỘT công năng dưới đây (ghi tên công năng vào co_che), không dùng vật như cây gậy thông thường, mỗi công năng tối đa một gag:\n${v.cong_nang.map((c) => `- ${c.ten}: ${c.mo_ta}`).join('\n')}${v.bo_phan?.length ? `\nBộ phận: ${v.bo_phan.map((b) => `${b.ten} (${b.mo_ta}${b.cong_nang.length ? ` → ${b.cong_nang.join(', ')}` : ''})`).join('; ')}` : ''}`;
};
