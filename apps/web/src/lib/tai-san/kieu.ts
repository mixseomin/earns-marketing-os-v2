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
/** Một tập trong bộ sách: tên bộ + số tập (null = chưa đánh số). */
export type BoSach = { ten: string; so: number | null };
/** Gộp các tập cùng bộ thành MỘT dòng bảng (khoa 'bo:<tên>') — bảng sản phẩm của shop hiện bộ như một mục, bấm bung ra các tập;
 *  sách lẻ giữ nguyên. Dòng bộ mang số gộp (đơn/thu/views cộng; ngày đăng = ngày sớm nhất chưa bán; trạng thái = việc cần làm gấp nhất). */
const GAP: TrangThaiSp[] = ['cho_anh', 'san_sang', 'dang_lam', 'cho_duyet', 'du_kien', 'dang_ban', 'ngung'];
const cong = (xs: (number | null)[]) => (xs.some((x) => x != null) ? xs.reduce<number>((t, x) => t + (x ?? 0), 0) : null);
export const tenTrongBo = (x: { ten: string; series?: BoSach | null }) =>
  (x.series ? x.ten.replace(new RegExp(`^${x.series.ten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-–]\\s*`, 'i'), '') || x.ten : x.ten);
export function gopBo(sp: SpNut[]): { dong: SpNut[]; con: Map<string, SpNut[]> } {
  const con = new Map<string, SpNut[]>(), dong: SpNut[] = [];
  for (const x of sp) {
    if (!x.series) { dong.push(x); continue; }
    const k = `bo:${x.series.ten}`;
    if (!con.has(k)) { con.set(k, []); dong.push({ khoa: k } as SpNut); }   // giữ chỗ đúng vị trí tập đầu tiên gặp
    con.get(k)!.push(x);
  }
  for (const [k, ds] of con) {
    ds.sort((a, b) => (a.series!.so ?? 999) - (b.series!.so ?? 999) || (a.phu ?? '').localeCompare(b.phu ?? ''));
    const tap = new Set(ds.map((x) => x.series!.so)).size, dem = new Map<TrangThaiSp, number>();
    for (const x of ds) dem.set(x.trangThai, (dem.get(x.trangThai) ?? 0) + 1);
    const cho = ds.filter((x) => x.trangThai !== 'dang_ban' && x.dangDuKien).map((x) => x.dangDuKien!).sort()[0] ?? null;
    const i = dong.findIndex((x) => x.khoa === k);
    dong[i] = { khoa: k, ten: k.slice(3), anh: ds.find((x) => x.anh)?.anh ?? null, ma: null, phu: `${tap} tập · ${ds.length} bản`, url: null,
      trangThai: GAP.find((t) => dem.has(t))!, dangDuKien: cho, gia: null, views7d: cong(ds.map((x) => x.views7d)), don: cong(ds.map((x) => x.don)),
      tien: cong(ds.map((x) => x.tien)), ky: ds[0]!.ky, canhBao: ds.find((x) => x.canhBao)?.canhBao ?? null,
      ghiChu: TT_SP.filter((t) => dem.has(t.key)).map((t) => `${dem.get(t.key)} ${t.chu}`).join(' · ') };
  }
  return { dong, con };
}
export type SpNut = { khoa: string; ten: string; /** ảnh sản phẩm (thumbnail nền tảng / cover Directus / ảnh mặt tiền) */ anh: string | null;
  /** mã trên nền tảng (permalink Gumroad, listing id Etsy, sku/ISBN KDP…) */ ma: string | null; /** định dạng / sku (bìa mềm, bìa cứng, ebook…) */ phu: string | null; url: string | null;
  trangThai: TrangThaiSp; /** tiến độ quy trình sản xuất ('1/5'), máy ghi ở dòng đầu ghi chú: '▶ quy trình 1/5 · xong: … · kế: …' */ tienDo?: string; ke?: string; /** bản xem để anh duyệt NGAY TRONG MOS2 (listing_config.xem, scripts/xem.mjs ghi) */ xem?: XemDuyet | null; /** ngày anh duyệt (listing_config.duyet) */ duyet?: string | null; /** dấu vân tay bản xem lúc anh duyệt */ duyetBam?: string | null; /** ngày đăng dự kiến (YYYY-MM-DD) theo lịch đăng */ dangDuKien?: string | null; /** bộ sách (listing_config.series) */ series?: BoSach | null; /** id dòng Directus products (để bấm Duyệt) */ idSo?: string; gia: number | null; /** mã tiền của giá (USD mặc định; Etsy FrontPorchZ niêm yết VND) — hiện đúng tiền, không tự quy đổi */ tienTe?: string; views7d: number | null; don: number | null; tien: number | null; ky: Ky; canhBao: string | null; ghiChu: string | null };
/** Tài khoản vault đứng sau shop — để biết đăng nhập bằng gì, mở drawer tài khoản. */
/** nguon: kho nào giữ tài khoản — 'mos2' (platform_accounts, mở drawer EntityRef) hay 'directus' (earns.accounts trên as.on.tc,
 *  id là uuid). Tab Tài sản đọc CẢ HAI: tài khoản chỉ nằm ở Directus trước đây hiện "—" (#1113, 05/10/2026). */
export type TaiKhoan = { id: number | string; nguon: 'mos2' | 'directus'; /** link bản ghi ở kho Directus (máy chủ dựng từ DIRECTUS_URL) */ url?: string; handle: string; email: string | null; status: string };

/** Một nền tảng nhiều tên khoá giữa các kho (MOS2 'mql5', Directus 'mql5-com', sổ sản phẩm 'mql5-market') → một khoá chuẩn. */
// apple-developer = khoá vault của tài khoản nhà phát triển (#470) → gộp về nền app-store để shop App Store tra ra tài khoản
// paddle = cổng thu (Merchant of Record) của astrolas.com — shop Astrolas tra ra tài khoản Paddle; site khác dùng Paddle thì tách khoá theo handle.
export const NEN_GOP: Record<string, string> = { mql5: 'mql5-market', 'mql5-com': 'mql5-market', 'apple-developer': 'app-store', paddle: 'astrolas' };
export const nenChuan = (k: string) => { const x = k.toLowerCase(); return NEN_GOP[x] ?? x; };
export type ShopNut = { khoa: string; ten: string; loai: 'gumroad' | 'kdp' | 'etsy' | 'mos' | 'san'; url: string | null; sp: SpNut[]; tk?: TaiKhoan | null;
  tien: number | null; ky: Ky; loi: string | null; ghiChu: string | null };
export type TaiSanBan = { shops: ShopNut[]; loi: string[]; viewsToi: string | null };

// Trạng thái vault coi là CHẾT (tài khoản không bán được nữa). Tự kiểm: node_modules/.bin/tsx apps/web/src/lib/tai-san/kieu.test.mts
const CHET = new Set(['banned', 'blocked', 'closed', 'suspended']);
/** Shop có tài khoản trong vault mà MỌI tài khoản khớp đều chết → trạng thái chết đó; còn một cái sống hoặc không có hồ sơ → null. */
export const khopTk = <T extends { nen: string; handle: string }>(nen: string, store: string | null, tk: T[]): T[] =>
  tk.filter((t) => (t.nen === nen || t.nen.startsWith(`${nen}-`)) && (!store || t.handle === store.toLowerCase()));
export function shopChet(nen: string, store: string | null, tk: { nen: string; handle: string; status: string; nguon?: 'mos2' | 'directus' }[]): string | null {
  const khop = khopTk(nen, store, tk);
  // Vault MOS2 là nơi anh ghi trạng thái; sổ Directus accounts mặc định 'active' và không ai cập nhật (Udemy #158 banned 08/2026 mà
  // Directus vẫn 'active' ×2 + một handle khác 'active' → phủ quyết, card #1130). Có hồ sơ vault thì CHỈ vault quyết; Directus chỉ khi vault trống.
  const vault = khop.filter((t) => t.nguon !== 'directus');
  const xet = vault.length ? vault : khop;
  return xet.length && xet.every((t) => CHET.has(t.status)) ? xet[0]!.status : null;
}


// Kênh kéo khách (bảng kenh_sp) + thư viện phương pháp (bảng phuong_phap, migration 0220) — phần thuần cho panel client; đọc DB ở kenh.ts.
/** Một phương pháp kéo khách trong THƯ VIỆN (sửa được trên MOS2, không phải hằng trong mã). nham: khoá shop / nền / '*'.
 *  buoc[0] = "chưa làm"; kenh_sp.muc là chỉ số trong mảng. nguong để trống tới khi có số thật. */
export type PhuongPhap = { key: string; nhan: string; moTa: string; nham: string[]; buoc: string[];
  noi: { tk: { id: number; nhan: string }[]; url?: string }; may: string | null; nguong: Record<string, unknown> | null; thuTu: number; bat: boolean };

/** Một ô sản phẩm × phương pháp. `ao` = chưa có dòng sổ (mọi số null — chưa đo, không phải 0). */
export type KenhO = { kenh: string; muc: number; xong: number | null; tong: number | null; dich: string | null; canhBao: string | null;
  the: { id: number; project: string | null; ten: string; trangThai: string } | null; capNhat: string | null; ngayDang: string | null; ao?: true;
  /** lượt 7 ngày từ nguồn đo của phương pháp (ap-dung NGUON_DO); undefined = phương pháp chưa có nguồn đo, null = có nguồn mà chưa có số */ luot7?: number | null;
  /** số đo tại nguồn, dòng mới nhất của kenh_so_ngay (tổng cửa sổ nguồn — Pinterest 30 ngày — tới `ngay`); thiếu = chưa đọc lần nào */ so?: KenhSo };
export type KenhSo = { ngay: string; hien: number; tuongTac: number; click: number; soMuc: number };
export type KenhSp = { sanPham: string; ten: string; khop: string | null; /** project của máy ghi (kenh.mjs); null = dòng sửa tay */ project?: string | null; o: Record<string, KenhO> };

/** Bản xem một sản phẩm đang làm — ảnh nằm trên Directus của MOS2 (assets/<id>), không link ra ngoài. */
export type XemDuyet = { /** dấu vân tay nội dung (puzzle-books bam-xem.mjs) */ bam?: string; ngay: string; anh: { id: string; chu: string }[]; trang?: number;
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
