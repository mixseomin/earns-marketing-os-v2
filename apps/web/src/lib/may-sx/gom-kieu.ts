import type { ShopNut, SpNut } from '@/lib/tai-san/doc';
import type { StLuoiO } from '@/lib/social-traffic';
import type { Nhip } from '@/components/ui/chuoi-nhip';
// KIỂU + TÊN NGUỒN của Máy SX — tách khỏi gom.ts (gom.ts đọc DB, chỉ chạy ở máy chủ) để trang và ngăn phía trình duyệt import được giá trị TEN_NGUON.
export type NguonSx = 'social' | 'kenh' | 'etp' | 'puzzle';
export const TEN_NGUON: Record<NguonSx, string> = { social: 'Social / Page', kenh: 'Kênh nội dung', etp: 'Ethopex', puzzle: 'Puzzle / Tài sản' };
export type ViecSx = {
  nguon: NguonSx; khoa: string; ten: string; /** dự án / kênh / máy */ cua: string | null;
  buoc: string; so?: number | null; tong?: number | null; /** bắt đầu / cập nhật gần nhất (ISO) */ luc?: string | null;
  loi?: string | null; ghi?: string | null;
  /** NHỊP SẢN XUẤT (anh 12/11/2026): chuỗi ô bước vẽ bằng ChuoiNhip dùng chung. Ethopex dùng `etp` → ChuoiBuoc của bảng Sản xuất. */
  nhip?: Nhip[]; etp?: { loai: string; buoc: { buoc: string; trang_thai: string; ghi?: string | null; ket_qua?: unknown }[] };
  /** NGĂN SẴN CÓ của chính nguồn đó (anh 12/11/2026: "các kiểu drawer này phải chính là drawer của sản phẩm đó — cấm tự bịa drawer mới nếu đã có"):
   *  ed = ngăn trên EntityDrawerHost (Ethopex: Sản xuất phim) · sp = ngăn sản phẩm tab Tài sản (ChiTietSp, ?sp=sp&spId=) ·
   *  kenh = ngăn hồ sơ kênh tab Kênh nội dung (KenhNgan, ?kn=kenh&knId=) · bai = ngăn bài của lịch Social Traffic (ChiTietBai, ?ob=o-lich&obId=) */
  mo: { ed: string; id: string } | { sp: { s: ShopNut; x: SpNut } } | { kenh: string } | { bai: StLuoiO };
};

