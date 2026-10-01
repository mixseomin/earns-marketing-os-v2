// HẠ TẦNG QUẢNG CÁO CỦA SHOP — kiểu + luật kiểm, THUẦN (không DB, không mạng): dùng chung cho tab /shop › Hạ tầng QC và lệnh
// dòng lệnh. Anh 02/10/2026: chạy Meta cho shop MOS (mellowstep) "không liên quan gì đến dự án khác, một chút dấu vết nào" —
// Meta nối các tài khoản qua NGƯỜI quản trị, THẺ, PROXY/thiết bị, TRANG, PIXEL, BM, TK QC dùng chung. Sổ 0210 giữ từng mảnh;
// tệp này nói mảnh nào đang để lộ đường nối (đỏ = dùng chung với nơi khác, vàng = thiếu / yếu) và còn thiếu gì để chạy.
// Kiểm: node_modules/.bin/tsx apps/web/src/lib/shop/qc-ha-tang.test.mts

export const TRANG_THAI_QC = { song: 'Đang dùng', han_che: 'Bị hạn chế', khoa: 'Bị khoá', mat: 'Mất', bo: 'Thôi dùng' } as const;
export const VAI_TRO_QC = { cam_chinh: 'Người cầm chính', quan_tri_phu: 'Quản trị phụ', nhan_vien: 'Nhân viên' } as const;
export const NGUON_NGUOI = { cua_minh: 'Tài khoản của mình', clone_mua: 'Clone mua', via_mua: 'Via mua', khac: 'Khác' } as const;
export const NGUON_TS = { tu_tao: 'Tự tạo', mua: 'Mua' } as const;
export const LOAI_THE = { ao: 'Thẻ ảo', ghi_no: 'Ghi nợ', tin_dung: 'Tín dụng', tra_truoc: 'Trả trước' } as const;
export const TRANG_THAI_THE = { song: 'Đang dùng', khoa: 'Bị khoá', het_han: 'Hết hạn', bo: 'Thôi dùng' } as const;

type Chung = { id: number; cuaHangId: number; ghiChu: string | null; trangThai: string };
export type QcBm = Chung & { extId: string | null; ten: string; nguon: string; noiMua: string | null; maDon: string | null; giaMua: number | null;
  ngayMua: string | null; baoHanhDen: string | null; xacMinh: boolean; daGoNguoiBan: boolean; coToken: boolean; tokenQuyen: string | null; tokenLuc: string | null };
export type QcThe = Chung & { nhan: string; soCuoi: string; nhaPhatHanh: string | null; loai: string; chuThe: string | null; hetHan: string | null };
export type QcTk = Chung & { bmId: number | null; extId: string | null; ten: string; tienTe: string; muiGio: string | null; hanMuc: number | null;
  theId: number | null; nguon: string; noiMua: string | null; maDon: string | null; giaMua: number | null; baoHanhDen: string | null };
/** Người: tài khoản cá nhân trong kho (platform_accounts) — thiết bị (proxy + browser profile) đọc từ kho, không nhập lại. */
export type QcNguoi = Chung & { accountId: number | null; ten: string; bmId: number | null; vaiTro: string; nguon: string;
  acc: { handle: string | null; email: string | null; platform: string; proxyId: number | null; proxy: string | null; proxyNoi: string | null;
    profileId: number | null; profile: string | null } | null };
export type QcTrang = Chung & { accountId: number | null; bmId: number | null; extId: string | null; ten: string; nguon: string };
export type QcPixel = Chung & { bmId: number | null; extId: string | null; ten: string; tenMien: string | null; xacMinhMien: boolean; capi: boolean };

export type HaTang = { cuaHangId: number; khoa: string; domain: string; pixelSite: string | null;
  bm: QcBm[]; the: QcThe[]; tk: QcTk[]; nguoi: QcNguoi[]; trang: QcTrang[]; pixel: QcPixel[] };

/** Đường nối RA NGOÀI shop, do máy chủ đếm trên toàn kho (qc-doc.ts) — mỗi khoá → các nơi khác đang dùng cùng thứ đó. */
export type DungChung = {
  /** account_id người → các shop khác có người đó */ nguoi: Record<number, string[]>;
  /** proxy_id → tài khoản kho khác (ngoài người của shop này) đang dùng proxy đó */ proxy: Record<number, string[]>;
  /** browser_profile_id → tài khoản kho khác trong cùng profile */ profile: Record<number, string[]>;
  /** "nhaPhatHanh|soCuoi" thẻ → shop khác */ the: Record<string, string[]>;
  /** mã BM / TK / Trang / pixel → shop khác */ ma: Record<string, string[]>;
};

export type Muc = 'do' | 'vang';
export type PhatHien = { muc: Muc; ma: string; chu: string };

const dang = <T extends { trangThai: string }>(ds: T[]) => ds.filter((x) => x.trangThai !== 'bo');
const ngayCon = (ngay: string | null, homNay: string) => (ngay ? Math.round((Date.parse(ngay) - Date.parse(homNay)) / 86400000) : null);
export const khoaThe = (t: Pick<QcThe, 'nhaPhatHanh' | 'soCuoi'>) => `${(t.nhaPhatHanh ?? '').trim().toLowerCase()}|${t.soCuoi}`;

/** Kiểm cô lập + độ đủ của bộ hạ tầng. Đỏ trước, vàng sau. */
export function kiemHaTang(h: HaTang, ngoai: DungChung, homNay: string): PhatHien[] {
  const ra: PhatHien[] = [];
  const bao = (muc: Muc, ma: string, chu: string) => ra.push({ muc, ma, chu });
  const nguoi = dang(h.nguoi), bm = dang(h.bm), tk = dang(h.tk), the = dang(h.the), trang = dang(h.trang), pixel = dang(h.pixel);

  /* ĐỎ — dùng chung với nơi khác: đúng loại dấu vết Meta dùng để gom tài khoản vào một cụm. */
  for (const n of nguoi) {
    if (n.accountId != null && ngoai.nguoi[n.accountId]?.length) bao('do', `nguoi-${n.id}`, `Người "${n.ten}" cũng đang ở shop ${ngoai.nguoi[n.accountId]!.join(', ')}`);
    if (n.acc?.proxyId != null && ngoai.proxy[n.acc.proxyId]?.length)
      bao('do', `proxy-${n.id}`, `Proxy của "${n.ten}" (${n.acc.proxy}) còn dùng cho: ${ngoai.proxy[n.acc.proxyId]!.slice(0, 4).join(', ')}`);
    if (n.acc?.profileId != null && ngoai.profile[n.acc.profileId]?.length)
      bao('do', `profile-${n.id}`, `Browser profile của "${n.ten}" (${n.acc.profile}) còn chứa: ${ngoai.profile[n.acc.profileId]!.slice(0, 4).join(', ')}`);
  }
  for (const t of the) if (ngoai.the[khoaThe(t)]?.length) bao('do', `the-${t.id}`, `Thẻ "${t.nhan}" (…${t.soCuoi}) cũng gắn ở shop ${ngoai.the[khoaThe(t)]!.join(', ')}`);
  const ma = (loai: string, ten: string, ext: string | null, id: number) => {
    if (ext && ngoai.ma[ext]?.length) bao('do', `${loai}-${id}`, `${ten} (${ext}) cũng có ở shop ${ngoai.ma[ext]!.join(', ')}`);
  };
  for (const x of bm) ma('bm', `BM "${x.ten}"`, x.extId, x.id);
  for (const x of tk) ma('tk', `TK QC "${x.ten}"`, x.extId, x.id);
  for (const x of trang) ma('trang', `Trang "${x.ten}"`, x.extId, x.id);
  for (const x of pixel) ma('pixel', `Pixel "${x.ten}"`, x.extId, x.id);
  /* trong shop: một thẻ cho nhiều TK QC = các TK đó nối nhau */
  for (const t of the) {
    const dung = tk.filter((k) => k.theId === t.id);
    if (dung.length > 1) bao('vang', `the-nhieu-${t.id}`, `Thẻ "${t.nhan}" đang gắn ${dung.length} TK QC (${dung.map((k) => k.ten).join(', ')}) — mỗi TK một thẻ`);
  }

  /* VÀNG — thiếu / yếu */
  for (const n of nguoi) {
    if (n.accountId == null) bao('vang', `nguoi-kho-${n.id}`, `Người "${n.ten}" chưa nối tài khoản trong kho — không biết proxy / browser profile của họ`);
    else if (n.acc?.proxyId == null) bao('vang', `nguoi-proxy-${n.id}`, `Người "${n.ten}" chưa gắn proxy — mở trình duyệt là đi IP nhà, chung với mọi tài khoản khác`);
    if (n.accountId != null && n.acc?.profileId == null) bao('vang', `nguoi-profile-${n.id}`, `Người "${n.ten}" chưa gắn browser profile riêng`);
    if (n.trangThai !== 'song') bao('vang', `nguoi-tt-${n.id}`, `Người "${n.ten}": ${TRANG_THAI_QC[n.trangThai as keyof typeof TRANG_THAI_QC] ?? n.trangThai}`);
  }
  for (const b of bm) {
    const qt = nguoi.filter((n) => n.bmId === b.id && n.trangThai === 'song' && n.vaiTro !== 'nhan_vien');
    if (qt.length < 2) bao('vang', `bm-qt-${b.id}`, `BM "${b.ten}" có ${qt.length} quản trị — cần ≥ 2 (một người gặp chuyện vẫn còn người vào được)`);
    if (b.nguon === 'mua' && !b.daGoNguoiBan) bao('vang', `bm-ban-${b.id}`, `BM "${b.ten}" mua về chưa gỡ tài khoản người bán`);
    if (!b.coToken) bao('vang', `bm-token-${b.id}`, `BM "${b.ten}" chưa có token người dùng hệ thống — máy chưa đọc được số chi`);
    const c = ngayCon(b.baoHanhDen, homNay);
    if (c != null && c >= 0 && c <= 3) bao('vang', `bm-bh-${b.id}`, `BM "${b.ten}" còn ${c} ngày bảo hành (tới ${b.baoHanhDen})`);
    if (b.trangThai !== 'song') bao('vang', `bm-tt-${b.id}`, `BM "${b.ten}": ${TRANG_THAI_QC[b.trangThai as keyof typeof TRANG_THAI_QC] ?? b.trangThai}`);
  }
  for (const k of tk) {
    if (k.theId == null) bao('vang', `tk-the-${k.id}`, `TK QC "${k.ten}" chưa ghi thẻ đang gắn`);
    else if (!the.some((t) => t.id === k.theId)) bao('vang', `tk-the-bo-${k.id}`, `TK QC "${k.ten}" đang ghi một thẻ đã thôi dùng`);
    if (k.bmId == null) bao('vang', `tk-bm-${k.id}`, `TK QC "${k.ten}" chưa nằm trong BM nào của shop`);
    const c = ngayCon(k.baoHanhDen, homNay);
    if (c != null && c >= 0 && c <= 3) bao('vang', `tk-bh-${k.id}`, `TK QC "${k.ten}" còn ${c} ngày bảo hành (tới ${k.baoHanhDen})`);
    if (k.trangThai !== 'song') bao('vang', `tk-tt-${k.id}`, `TK QC "${k.ten}": ${TRANG_THAI_QC[k.trangThai as keyof typeof TRANG_THAI_QC] ?? k.trangThai}`);
  }
  for (const p of pixel) {
    if (!p.xacMinhMien) bao('vang', `px-mien-${p.id}`, `Pixel "${p.ten}" chưa xác minh tên miền ${p.tenMien ?? h.domain}`);
    if (!p.capi) bao('vang', `px-capi-${p.id}`, `Pixel "${p.ten}" chưa gửi sự kiện từ máy chủ (CAPI)`);
  }
  /* pixel gắn trên site (cửa hàng › Cấu hình › đo) phải là pixel của bộ này — khác là site đang bắn vào pixel của nơi khác */
  if (h.pixelSite && !pixel.some((p) => p.extId === h.pixelSite))
    bao('do', 'px-site', `Site đang gắn pixel ${h.pixelSite} — không phải pixel nào trong bộ hạ tầng của shop`);
  return ra.sort((a, b) => (a.muc === b.muc ? 0 : a.muc === 'do' ? -1 : 1));
}

export type BuocChuan = { ma: string; nhan: string; xong: boolean; chu: string };
/** CHECKLIST CHUẨN BỊ CHẠY — máy tự đánh dấu từ sổ (danh sách đã bàn 02/10/2026). Creative riêng không đọc được từ sổ nên không có ở đây. */
export function checklist(h: HaTang): BuocChuan[] {
  const nguoi = dang(h.nguoi).filter((n) => n.trangThai === 'song'), bm = dang(h.bm).filter((b) => b.trangThai === 'song');
  const tk = dang(h.tk).filter((k) => k.trangThai === 'song'), the = dang(h.the), trang = dang(h.trang).filter((t) => t.trangThai === 'song');
  const pixel = dang(h.pixel).filter((p) => p.trangThai === 'song');
  const cam = nguoi.filter((n) => n.vaiTro === 'cam_chinh');
  const coTb = (n: QcNguoi) => n.acc?.proxyId != null && n.acc?.profileId != null;
  return [
    { ma: 'cam', nhan: 'Người cầm chính', xong: cam.length > 0 && cam.every((n) => n.accountId != null), chu: cam.length ? cam.map((n) => n.ten).join(', ') : 'chưa có' },
    { ma: 'phu', nhan: 'Quản trị phụ', xong: nguoi.some((n) => n.vaiTro === 'quan_tri_phu'), chu: `${nguoi.filter((n) => n.vaiTro === 'quan_tri_phu').length} người` },
    { ma: 'thiet_bi', nhan: 'Mỗi người một browser profile + proxy riêng', xong: nguoi.length > 0 && nguoi.every(coTb), chu: `${nguoi.filter(coTb).length}/${nguoi.length} người đủ` },
    { ma: 'bm', nhan: 'BM', xong: bm.length > 0, chu: bm.length ? bm.map((b) => b.ten).join(', ') : 'chưa có' },
    { ma: 'tk', nhan: 'TK QC có thẻ riêng', xong: tk.length > 0 && tk.every((k) => k.theId != null && the.some((t) => t.id === k.theId)),
      chu: `${tk.filter((k) => k.theId != null).length}/${tk.length} TK có thẻ` },
    { ma: 'trang', nhan: 'Trang Facebook', xong: trang.length > 0, chu: trang.length ? trang.map((t) => t.ten).join(', ') : 'chưa có' },
    { ma: 'pixel', nhan: 'Pixel + xác minh tên miền + CAPI', xong: pixel.some((p) => p.xacMinhMien && p.capi),
      chu: pixel.length ? pixel.map((p) => `${p.ten}${p.xacMinhMien ? ' · đã xác minh miền' : ''}${p.capi ? ' · CAPI' : ''}`).join(', ') : 'chưa có' },
    { ma: 'token', nhan: 'Token cho máy báo cáo', xong: bm.some((b) => b.coToken), chu: bm.some((b) => b.coToken) ? 'có' : 'chưa có' },
    { ma: 'site', nhan: 'Site gắn đúng pixel của bộ này', xong: !!h.pixelSite && pixel.some((p) => p.extId === h.pixelSite),
      chu: h.pixelSite ? `site đang gắn ${h.pixelSite}` : 'site chưa gắn pixel (Cửa hàng › Cấu hình › đo)' },
  ];
}
