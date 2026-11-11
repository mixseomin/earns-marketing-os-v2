// KIỂU + TÊN NGUỒN của Máy SX — tách khỏi gom.ts (gom.ts đọc DB, chỉ chạy ở máy chủ) để trang và ngăn phía trình duyệt import được giá trị TEN_NGUON.
export type NguonSx = 'social' | 'kenh' | 'etp' | 'puzzle';
export const TEN_NGUON: Record<NguonSx, string> = { social: 'Social / Page', kenh: 'Kênh nội dung', etp: 'Ethopex', puzzle: 'Puzzle / Tài sản' };
export type ViecSx = {
  nguon: NguonSx; khoa: string; ten: string; /** dự án / kênh / máy */ cua: string | null;
  buoc: string; so?: number | null; tong?: number | null; /** bắt đầu / cập nhật gần nhất (ISO) */ luc?: string | null;
  loi?: string | null; ghi?: string | null;
  mo: { url: string } | { ed: string; id: string };
};

