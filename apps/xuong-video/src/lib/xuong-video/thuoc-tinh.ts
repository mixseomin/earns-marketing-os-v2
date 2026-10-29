// 🧬 THUỘC TÍNH NGUYÊN TỬ + TỪ KHÓA CHUẨN cho đối chiếu KHÔNG-THỂ-HIỂU-LẦM (anh 30/10/2026 "làm triệt để, không tin model phán").
// Mỗi đối tượng (nhân vật / đạo cụ) ở mỗi khung (đầu/cuối) được mô tả bằng một BỘ LÁ nguyên tử — mỗi lá MỘT sự thật, giá trị theo enum nơi có thể.
// Dự kiến (từ DB) và Thực tế (bóc từ ảnh) cùng điền ĐÚNG bộ lá này → chấm = SO BẰNG từng lá (enum), model chỉ còn việc ĐỌC ảnh vào enum, không phán khớp/lệch.

/** Vị trí trên màn (trục ngang). */
export const VI_TRI_MAN = ['trái', 'giữa', 'phải', 'ngoài khung'] as const;
export type ViTriMan = typeof VI_TRI_MAN[number];

/** Hướng mặt/ánh nhìn so với màn. */
export const HUONG_NHIN = ['trái', 'phải', 'thẳng (vào máy)', 'lên', 'xuống', 'xuống-trái', 'xuống-phải', 'quay lưng'] as const;
export type HuongNhin = typeof HUONG_NHIN[number];

/** Kiểu tóc (khớp với tocGlyph của sơ đồ). */
export const TOC_KIEU = ['búi thấp', 'búi cao', 'đuôi ngựa', 'xõa dài', 'xõa ngắn', 'tóc ngắn', 'tết', 'cạo/hói'] as const;
export type TocKieu = typeof TOC_KIEU[number];

/** Cách một đạo cụ được giữ. */
export const CACH_GIU = ['đeo trên cổ', 'đeo trên người', 'cầm tay phải', 'cầm tay trái', 'hai tay ôm', 'để trên bàn/kệ', 'đặt dưới sàn', 'trong túi/hộp', 'không xác định'] as const;
export type CachGiu = typeof CACH_GIU[number];

/** Có/không một đặc điểm (vết ố, badge, rách…). */
export const CO_KHONG = ['có', 'không', 'không rõ'] as const;
export type CoKhong = typeof CO_KHONG[number];

/** Một LÁ nguyên tử: khóa máy + tên hiển thị + bộ enum (null = tự do, model/DB điền chuỗi ngắn). */
export type La = { key: string; ten: string; enum: readonly string[] | null };

/** Lá của một NHÂN VẬT trong một khung. */
export const LA_NHAN_VAT: readonly La[] = [
  { key: 'vi_tri_man', ten: 'Vị trí màn', enum: VI_TRI_MAN },
  { key: 'huong_nhin', ten: 'Hướng nhìn', enum: HUONG_NHIN },
  { key: 'toc_kieu', ten: 'Kiểu tóc', enum: TOC_KIEU },
  { key: 'ao_mon', ten: 'Trang phục', enum: null },          // tên bộ đồ (vd "đầm ôm đỏ burgundy tay lỡ")
  { key: 'ao_mau', ten: 'Màu chủ đạo', enum: null },
  { key: 'ao_vet', ten: 'Vết/đặc điểm riêng', enum: null },  // vd "vết cà phê ngực trái" — hoặc "không"
  { key: 'bieu_cam', ten: 'Biểu cảm', enum: null },          // mã/nhãn cảm xúc
  { key: 'dang', ten: 'Dáng/động tác', enum: null },
] as const;

/** Lá của một ĐẠO CỤ trong một khung. */
export const LA_DAO_CU: readonly La[] = [
  { key: 'nguoi_giu', ten: 'Người giữ', enum: null },        // TÊN nhân vật, hoặc "không ai"
  { key: 'cach_giu', ten: 'Cách giữ', enum: CACH_GIU },
  { key: 'vi_tri_man', ten: 'Vị trí màn', enum: VI_TRI_MAN },
  { key: 'trang_thai', ten: 'Trạng thái', enum: null },      // vd "nguyên", "dây đứt"
] as const;

/** Giá trị một lá của một đối tượng ở một khung — dùng cho CẢ dự kiến lẫn thực tế. */
export type GiaTriLa = { doi_tuong: string; loai: 'nhan_vat' | 'dao_cu'; key: string; gia_tri: string };

/** Chuẩn hóa trị enum (bỏ dấu cách thừa, so chữ thường) để SO BẰNG không lệ thuộc hoa/thường/khoảng trắng. */
export function chuanEnum(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** So BẰNG hai trị của một lá enum → khớp/lệch dứt khoát (không cần model). Trả null nếu lá tự do (phải so bằng model/text). */
export function soLaEnum(la: La, duKien: string, thucTe: string): 'khớp' | 'lệch' | null {
  if (!la.enum) return null;
  const dk = chuanEnum(duKien), tt = chuanEnum(thucTe);
  if (!dk || dk === 'không khai' || !tt) return null;   // thiếu dữ liệu → để tầng trên xử
  return dk === tt ? 'khớp' : 'lệch';
}
