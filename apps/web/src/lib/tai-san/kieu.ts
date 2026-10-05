// Phần THUẦN của cây tài sản (kiểu + bảng trạng thái) — không import DB, để component 'use client' (tai-san-view.tsx) dùng được.
// Phần đọc dữ liệu (DB, Gumroad API, Directus) ở doc.ts; check-client-db.mjs chặn client kéo doc.ts.
// Vòng đời: dự kiến (mới lên kế hoạch) → đang làm → sẵn sàng (làm xong, chưa đăng lên sàn) → chờ duyệt → đang bán → ngừng.
// 'cho_anh' = dựng xong, chờ ANH duyệt bản xem trong MOS2 — khác 'cho_duyet' là SÀN đang duyệt (KDP review); hai việc hai người.
export type TrangThaiSp = 'du_kien' | 'dang_lam' | 'cho_anh' | 'san_sang' | 'cho_duyet' | 'dang_ban' | 'ngung';
export const TT_SP: { key: TrangThaiSp; chu: string; mau: string }[] = [
  { key: 'dang_ban', chu: 'đang bán', mau: 'var(--ok)' },
  { key: 'cho_anh', chu: 'chờ anh duyệt', mau: 'var(--accent)' },
  { key: 'cho_duyet', chu: 'sàn đang duyệt', mau: 'var(--warn)' },
  { key: 'san_sang', chu: 'sẵn sàng', mau: 'var(--ok)' },
  { key: 'dang_lam', chu: 'đang làm', mau: 'var(--fg-2)' },
  { key: 'du_kien', chu: 'dự kiến', mau: 'var(--fg-4)' },
  { key: 'ngung', chu: 'ngừng', mau: 'var(--fg-4)' },
];
/** Cửa sổ của số đơn/tiền: Gumroad API cộng dồn trọn đời; Directus product_stats và shop_don tính 30 ngày. */
export type Ky = 'tron_doi' | '30n';
export type SpNut = { khoa: string; ten: string; /** ảnh sản phẩm (thumbnail nền tảng / cover Directus / ảnh mặt tiền) */ anh: string | null;
  /** mã trên nền tảng (permalink Gumroad, listing id Etsy, sku/ISBN KDP…) */ ma: string | null; /** định dạng / sku (bìa mềm, bìa cứng, ebook…) */ phu: string | null; url: string | null;
  trangThai: TrangThaiSp; /** tiến độ quy trình sản xuất ('1/5'), máy ghi ở dòng đầu ghi chú: '▶ quy trình 1/5 · xong: … · kế: …' */ tienDo?: string; ke?: string; /** bản xem để anh duyệt NGAY TRONG MOS2 (listing_config.xem, scripts/xem.mjs ghi) */ xem?: XemDuyet | null; /** ngày anh duyệt (listing_config.duyet) */ duyet?: string | null; /** id dòng Directus products (để bấm Duyệt) */ idSo?: string; gia: number | null; /** mã tiền của giá (USD mặc định; Etsy FrontPorchZ niêm yết VND) — hiện đúng tiền, không tự quy đổi */ tienTe?: string; views7d: number | null; don: number | null; tien: number | null; ky: Ky; canhBao: string | null; ghiChu: string | null };
/** Tài khoản vault đứng sau shop — để biết đăng nhập bằng gì, mở drawer tài khoản. */
/** nguon: kho nào giữ tài khoản — 'mos2' (platform_accounts, mở drawer EntityRef) hay 'directus' (earns.accounts trên as.on.tc,
 *  id là uuid). Tab Tài sản đọc CẢ HAI: tài khoản chỉ nằm ở Directus trước đây hiện "—" (#1113, 05/10/2026). */
export type TaiKhoan = { id: number | string; nguon: 'mos2' | 'directus'; /** link bản ghi ở kho Directus (máy chủ dựng từ DIRECTUS_URL) */ url?: string; handle: string; email: string | null; status: string };

/** Một nền tảng nhiều tên khoá giữa các kho (MOS2 'mql5', Directus 'mql5-com', sổ sản phẩm 'mql5-market') → một khoá chuẩn. */
export const NEN_GOP: Record<string, string> = { mql5: 'mql5-market', 'mql5-com': 'mql5-market' };
export const nenChuan = (k: string) => { const x = k.toLowerCase(); return NEN_GOP[x] ?? x; };
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


// Kênh kéo khách (bảng kenh_sp) — phần thuần cho panel client; đọc DB ở kenh.ts.
/** Các khâu của từng kênh, theo thứ tự; kenh_sp.muc là chỉ số trong mảng. Kênh mới = thêm một dòng ở đây. */
/** moTa: kênh này LÀ gì (#1111). */
/** noi: kênh ĐĂNG Ở ĐÂU (#1116) — tài khoản vault (id platform_accounts) và/hoặc trang; chưa có thì để trống, không bịa.
 *  moTa hiện khi rê chuột vào tên kênh (#1116: hiện cả đoạn là chật). */
export const KHAU: Record<string, { nhan: string; moTa: string; noi: { tk: { id: number; nhan: string }[]; url?: string }; khau: string[] }> = {
  pinterest: { nhan: 'Pinterest', moTa: 'Ghim ảnh sản phẩm lên Pinterest, hẹn lịch đăng dần; mỗi ghim có link về trang bán.',
    noi: { tk: [{ id: 503, nhan: 'Pinterest' }] },
    khau: ['chưa làm', 'dựng ảnh ghim', 'đã hẹn lịch', 'đang lên', 'lên hết'] },
  shorts: { nhan: 'Video ngắn', moTa: 'Video ngắn giới thiệu sách đăng YouTube Shorts / Instagram / TikTok, có link về trang bán.',
    noi: { tk: [{ id: 506, nhan: 'YouTube' }, { id: 508, nhan: 'Instagram' }, { id: 509, nhan: 'TikTok' }] },
    khau: ['chưa làm', 'dựng video', 'đăng một phần', 'đăng hết'] },
  printables: { nhan: 'Trang tặng miễn phí', moTa: 'Trang tải miễn phí vài trang mẫu trên site nhà — khách tìm thấy qua Google, từ đó dẫn sang trang bán.',
    noi: { tk: [], url: 'https://pickjot.com/printables/' },
    khau: ['chưa làm', 'dựng trang', 'đang live', 'đã nộp sitemap'] },
};

export type KenhO = { kenh: string; muc: number; xong: number | null; tong: number | null; dich: string | null; canhBao: string | null;
  the: { id: number; project: string | null; ten: string; trangThai: string } | null; capNhat: string };
export type KenhSp = { sanPham: string; ten: string; khop: string | null; o: Record<string, KenhO> };

/** Bản xem một sản phẩm đang làm — ảnh nằm trên Directus của MOS2 (assets/<id>), không link ra ngoài. */
export type XemDuyet = { ngay: string; anh: { id: string; chu: string }[]; trang?: number;
  mau?: { t: string; story: string; ask: string[]; w: string[] }[]; chuDe?: string[]; moTa?: string };

/** Đã duyệt BẢN HIỆN TẠI chưa: lúc duyệt không trước lúc dựng bản xem (dựng lại sau khi duyệt → phải duyệt lại). So THỜI ĐIỂM,
 *  không so chuỗi: duyệt cũ chỉ ghi ngày ('2026-10-06') → coi là cuối ngày đó; bản xem có thể ghi ngày hoặc ISO. Cùng luật với
 *  drawer bản xem (tai-san-ban-xem.tsx `cuHon`) — hai nơi phải gọi CHUNG hàm này, đừng tự tính lại. */
const lucCuaNgay = (s: string, cuoiNgay: boolean) => new Date(s.length > 10 ? s : `${s}T${cuoiNgay ? '23:59:59' : '00:00:00'}`).getTime();
export const daDuyetBanNay = (duyet: string | null | undefined, xemNgay: string | null | undefined) =>
  !!duyet && (!xemNgay || lucCuaNgay(duyet, true) >= lucCuaNgay(xemNgay, false));

/** Ảnh đại diện lấy từ BẢN XEM khi sổ chưa có cover (#1119: sản phẩm chưa đăng vẫn phải thấy bìa dự định): ảnh bán đầu tiên
 *  (bìa trước) — không lấy bìa giấy trải phẳng (mặt sau · gáy · mặt trước). Không có thì ảnh đầu. */
export const anhBiaXem = (xem: XemDuyet | null | undefined): string | null =>
  xem?.anh.find((a) => /^Ảnh bán 1/i.test(a.chu))?.id ?? xem?.anh[0]?.id ?? null;
