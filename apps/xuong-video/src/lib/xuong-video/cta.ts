// THƯ VIỆN CTA (anh 15/10/2026: "CTA text phải có màu ấn tượng hơn — xem mẫu đối thủ ở thư viện" → "tạo thành thư viện CTA để dùng đa dạng").
// Dữ liệu: mau/cta.json — mỗi kiểu chữ học từ một QC đang thắng (nguồn ghi kèm). Áp lên MỌI shot ưu đãi / CTA / end card của phim (kieu_chu shot);
// chữ CTA vẫn lấy từ ô template có nguồn (tham-khao.ts). Phim mới tự chọn kiểu ÍT DÙNG NHẤT cho cùng sản phẩm → các video không trùng CTA.
// Thuần — dùng cho template (dung-template), chép phim (cta-db.ts), panel shot. Tự kiểm: cta.test.mts
import THU_VIEN from '../../../mau/cta.json';
import type { KieuChu, LoaiShotMau } from './kieu';
import type { NguonThamKhao } from './tham-khao';

export type KieuCta = { key: string; ten: string; mo_ta: string; kieu: KieuChu; nguon: NguonThamKhao[] };
export const THU_VIEN_CTA = (THU_VIEN as { ds: KieuCta[] }).ds;
/** Loại shot mang chữ ưu đãi / kêu gọi — nhận kiểu CTA. */
export const LOAI_CTA: LoaiShotMau[] = ['uu_dai', 'cta', 'end_card'];
export const laShotCta = (loai: string): boolean => (LOAI_CTA as string[]).includes(loai);
export const ctaTheoKey = (key?: string | null): KieuCta | undefined => THU_VIEN_CTA.find((c) => c.key === key);
/** Kiểu mặc định (đầu thư viện) — template dựng sẵn với kiểu này. */
export const CTA_MAC_DINH = THU_VIEN_CTA[0]!;
/** dem = số phim cùng sản phẩm đang dùng mỗi kiểu → kiểu ít dùng nhất (hoà thì theo thứ tự thư viện). */
export function chonCta(dem: Record<string, number>): KieuCta {
  return THU_VIEN_CTA.reduce((a, c) => ((dem[c.key] ?? 0) < (dem[a.key] ?? 0) ? c : a), THU_VIEN_CTA[0]!);
}
/** Kiểu chữ shot sau khi áp CTA: shot CTA nhận đúng kiểu thư viện; shot khác giữ nguyên. */
export const kieuShotSauCta = (loai: string, cu: KieuChu | null | undefined, cta: KieuCta): KieuChu => (laShotCta(loai) ? { ...cta.kieu } : (cu ?? {}));
