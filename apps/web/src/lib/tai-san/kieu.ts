// Phần THUẦN của cây tài sản (kiểu + bảng trạng thái) — không import DB, để component 'use client' (tai-san-view.tsx) dùng được.
// Phần đọc dữ liệu (DB, Gumroad API, Directus) ở doc.ts; check-client-db.mjs chặn client kéo doc.ts.
export type TrangThaiSp = 'dang_lam' | 'cho_duyet' | 'dang_ban' | 'ngung';
export const TT_SP: { key: TrangThaiSp; chu: string; mau: string }[] = [
  { key: 'dang_ban', chu: 'đang bán', mau: 'var(--ok)' },
  { key: 'cho_duyet', chu: 'chờ duyệt', mau: 'var(--warn)' },
  { key: 'dang_lam', chu: 'đang làm', mau: 'var(--fg-2)' },
  { key: 'ngung', chu: 'ngừng', mau: 'var(--fg-4)' },
];
/** Cửa sổ của số đơn/tiền: Gumroad API cộng dồn trọn đời; Directus product_stats và shop_don tính 30 ngày. */
export type Ky = 'tron_doi' | '30n';
export type SpNut = { khoa: string; ten: string; /** định dạng / sku (bìa mềm, bìa cứng, ebook…) */ phu: string | null; url: string | null;
  trangThai: TrangThaiSp; gia: number | null; views7d: number | null; don: number | null; tien: number | null; ky: Ky; canhBao: string | null; ghiChu: string | null };
export type ShopNut = { khoa: string; ten: string; loai: 'gumroad' | 'kdp' | 'etsy' | 'mos' | 'san'; url: string | null; sp: SpNut[];
  tien: number | null; ky: Ky; loi: string | null; ghiChu: string | null };
export type TaiSanBan = { shops: ShopNut[]; loi: string[]; viewsToi: string | null };
