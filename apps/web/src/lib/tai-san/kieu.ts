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
export type SpNut = { khoa: string; ten: string; /** ảnh sản phẩm (thumbnail nền tảng / cover Directus / ảnh mặt tiền) */ anh: string | null;
  /** mã trên nền tảng (permalink Gumroad, listing id Etsy, sku/ISBN KDP…) */ ma: string | null; /** định dạng / sku (bìa mềm, bìa cứng, ebook…) */ phu: string | null; url: string | null;
  trangThai: TrangThaiSp; gia: number | null; /** mã tiền của giá (USD mặc định; Etsy FrontPorchZ niêm yết VND) — hiện đúng tiền, không tự quy đổi */ tienTe?: string; views7d: number | null; don: number | null; tien: number | null; ky: Ky; canhBao: string | null; ghiChu: string | null };
/** Tài khoản vault đứng sau shop — để biết đăng nhập bằng gì, mở drawer tài khoản. */
export type TaiKhoan = { id: number; handle: string; email: string | null; status: string };
export type ShopNut = { khoa: string; ten: string; loai: 'gumroad' | 'kdp' | 'etsy' | 'mos' | 'san'; url: string | null; sp: SpNut[]; tk?: TaiKhoan | null;
  tien: number | null; ky: Ky; loi: string | null; ghiChu: string | null };
export type TaiSanBan = { shops: ShopNut[]; loi: string[]; viewsToi: string | null };

// Trạng thái vault coi là CHẾT (tài khoản không bán được nữa). Tự kiểm: node_modules/.bin/tsx apps/web/src/lib/tai-san/kieu.test.mts
const CHET = new Set(['banned', 'blocked', 'closed', 'suspended']);
/** Shop có tài khoản trong vault mà MỌI tài khoản khớp đều chết → trạng thái chết đó; còn một cái sống hoặc không có hồ sơ → null. */
export const khopTk = <T extends { nen: string; handle: string }>(nen: string, store: string | null, tk: T[]): T[] =>
  tk.filter((t) => (t.nen === nen || t.nen.startsWith(`${nen}-`)) && (!store || t.handle === store.toLowerCase()));
export function shopChet(nen: string, store: string | null, tk: { nen: string; handle: string; status: string }[]): string | null {
  const khop = khopTk(nen, store, tk);
  return khop.length && khop.every((t) => CHET.has(t.status)) ? khop[0]!.status : null;
}

