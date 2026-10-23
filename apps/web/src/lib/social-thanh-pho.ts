// THÀNH PHỐ HỆ SINH THÁI (anh 22/10/2026 — bắt đầu ở tab Social › 🏙 Thành phố, đích là màn hình chính cho mọi thứ đang diễn ra):
// biến số thật thành mô hình thành phố 3D. Tính thuần ở đây (tự kiểm: social-thanh-pho.test.mts); vẽ ở components/social-thanh-pho-canh.ts.
//   ĐÍCH = site (mọi site có mã theo dõi + site tài khoản trỏ tới) và SẢN PHẨM (App Store, Microsoft Store, Gumroad, Etsy, KDP, Udemy… — kho products).
//   NGUỒN đứng quanh đích của nó: máy tìm kiếm (mỗi máy một toà cạnh site, khách 30 ngày) + tài khoản social (bài, lịch, lượt xem, khách về site).
//   DỰ ÁN = một khu gom các đích của nó, có toà DỰ ÁN riêng; site không thuộc dự án nào tự đứng như một dự án; dự án ngừng → khu ở rìa thành phố.
//   ĐÃ ĐĂNG = bài đã lên (StKenh.video) · SẮP ĐĂNG = lượt dự kiến 7 ngày của máy đăng · HỎNG = sự cố 'bad' / tài khoản khoá, dính cờ · DỪNG = đã cắt.
import type { SocialLive } from './social-traffic';
import { siteOf } from './host';

/** MÁY TÌM KIẾM của thành phố Social (anh 22/10/2026: "thêm nguồn từ Bing, Google Search, Yandex… mỗi cái một thực thể"): nguồn phiên (referrer
 *  host hoặc utm "<nguồn> / organic") → máy tìm kiếm. Quảng cáo (/ cpc, / paid) không phải tìm kiếm tự nhiên → không tính. Dùng chung máy chủ
 *  (social-truc-tiep › docNguonSite) và trình duyệt (cảnh thành phố) nên nằm ở module thuần này. */
export const MAY_TIM: { khoa: string; ten: string; host: string; mau: string; re: RegExp }[] = [
  { khoa: 'google', ten: 'Google', host: 'google.com', mau: '#4285f4', re: /^(www\.)?google\.[a-z.]+$|^google \/ organic$/ },
  { khoa: 'bing', ten: 'Bing', host: 'bing.com', mau: '#008373', re: /(^|\.)bing\.com$|^bing \/ organic$/ },
  { khoa: 'yandex', ten: 'Yandex', host: 'yandex.ru', mau: '#fc3f1d', re: /yandex|^ya\.ru$|^dzen\.ru$/ },
  { khoa: 'duckduckgo', ten: 'DuckDuckGo', host: 'duckduckgo.com', mau: '#de5833', re: /duckduckgo/ },
  { khoa: 'yahoo', ten: 'Yahoo', host: 'search.yahoo.com', mau: '#6001d2', re: /search\.yahoo\.com$|^yahoo \/ organic$/ },
  { khoa: 'brave', ten: 'Brave Search', host: 'search.brave.com', mau: '#fb542b', re: /search\.brave\.com$/ },
  { khoa: 'ecosia', ten: 'Ecosia', host: 'ecosia.org', mau: '#36acb8', re: /ecosia\.org$/ },
  { khoa: 'qwant', ten: 'Qwant', host: 'qwant.com', mau: '#5c97ff', re: /qwant\.com$/ },
  { khoa: 'mailru', ten: 'Mail.ru', host: 'mail.ru', mau: '#005ff9', re: /^(go\.)?mail\.ru$/ },
  { khoa: 'baidu', ten: 'Baidu', host: 'baidu.com', mau: '#2932e1', re: /baidu\.com$/ },
  { khoa: 'naver', ten: 'Naver', host: 'naver.com', mau: '#03c75a', re: /naver\.com$/ },
  { khoa: 'seznam', ten: 'Seznam', host: 'seznam.cz', mau: '#cc0000', re: /seznam\.cz$/ },
];
/** NGUỒN NGOÀI KHÁC (bước 3, anh 22/10/2026): quảng cáo ("<nền> / cpc|paid") và trang giới thiệu (referrer host không phải máy tìm kiếm, không phải
 *  bài social của mình "<nền> / short" — đã tính ở toà tài khoản). khoa quảng cáo = nền chuẩn hoá; mã camp lạ → 'khac'. */
export const NEN_QC: Record<string, { ten: string; host: string; mau: string }> = {
  google: { ten: 'Google Ads', host: 'ads.google.com', mau: '#fbbc04' }, facebook: { ten: 'Meta Ads', host: 'facebook.com', mau: '#0866ff' }, bing: { ten: 'Microsoft Ads', host: 'ads.microsoft.com', mau: '#00a4ef' },
  tiktok: { ten: 'TikTok Ads', host: 'tiktok.com', mau: '#25f4ee' }, email: { ten: 'Email', host: 'gmail.com', mau: '#ea4335' }, khac: { ten: 'Quảng cáo khác', host: 'adfond.com', mau: '#9aa3b8' },
};
export function nguonNgoaiCua(nguon: string | null): { loai: 'qc' | 'gt'; khoa: string } | null {
  if (!nguon || nguon === 'direct' || / \/ (short|comment)$/.test(nguon)) return null;
  const qc = /^(.+?) \/ (cpc|paid|email_flow|email)$/.exec(nguon);
  if (qc) { const n = qc[1]!.toLowerCase(), k = /^(fb|facebook|meta|ig|instagram|an)$/.test(n) ? 'facebook' : n === 'email' ? 'email' : NEN_QC[n] ? n : 'khac'; return { loai: 'qc', khoa: k }; }
  if (/ \/ /.test(nguon) || mayTimCua(nguon)) return null;
  const host = nguon.replace(/^www\./, '').replace(/^l\.|^m\.|^lm\./, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? { loai: 'gt', khoa: host } : null;
}
export const mayTimCua = (nguon: string | null) => { if (!nguon || / \/ (cpc|paid)$/.test(nguon)) return null; return MAY_TIM.find((m) => m.re.test(nguon))?.khoa ?? null; };

export type PhoNen = 'yt' | 'fb' | 'ig' | 'tt' | 'x' | 'pin' | 'dm' | 'th' | 'qu';
const NEN_KEY: Record<string, PhoNen> = { youtube: 'yt', facebook: 'fb', instagram: 'ig', tiktok: 'tt', twitter: 'x', x: 'x', pinterest: 'pin', dailymotion: 'dm', threads: 'th', quora: 'qu' };
/** nơi đăng của máy (xv_may.dang[].nen: youtube, x_anh, fb_link…) → khoá nền tảng của tài khoản (platform_accounts.platform_key) */
export const nenCuaMay = (nen: string) => { const g = nen.replace(/_(anh|link)$/, ''); return ({ fb: 'facebook', ig: 'instagram', x: 'twitter' } as Record<string, string>)[g] ?? g; };

/** toà NGUỒN cạnh đích: tài khoản mạng xã hội ('mxh') · máy tìm kiếm ('tim', id `tim:<máy>@<site>`) · quảng cáo ('qc') · trang giới thiệu ('gt') · nguồn trong cửa hàng ('ch');
 *  host = tên miền lấy favicon, mau = màu hãng */
export interface PhoTk {
  id: string; loai: 'mxh' | 'tim' | 'qc' | 'gt' | 'ch'; nen: PhoNen | 'tim' | 'qc' | 'gt' | 'ch';
  /** nguồn trong cửa hàng (loai 'ch', vào sản phẩm): hiển thị / xem trang / tải lần đầu 30 ngày */
  chiTiet?: { hien: number; xem: number; tai: number }; host?: string; mau?: string; ten: string; duAn: string;
  chay: number; sap: number; xem: number | null;
  /** lượt khách về đích; kỳ đo khác nhau theo nguồn (sổ phiên 7 ngày · Pinterest 30 ngày · tìm kiếm 30 ngày) nên đi kèm nhãn kỳ */
  phien: number; phienKy: string;
  /** khoá đích nó đổ khách vào ('s:<site>'); null = chưa biết đổ về đâu */
  dich: string | null; hong: string | null; dung: boolean;
}
/** ĐÍCH: site ('s:<host>') hoặc sản phẩm ('p:<id>'). duAn = khoá khu (PhoDuAn.khoa). */
export interface PhoDich {
  /** 'nen' = nền tảng chạy chiến dịch (Ethopex) — tâm của khu, các camp ('camp') đứng quanh như bản cửa hàng quanh app */
  khoa: string; loai: 'site' | 'sp' | 'app' | 'nen' | 'camp'; ten: string; site: string | null; duAn: string;
  /** đích đang ở XƯỞNG SX (chưa lên — đang duyệt / sẵn sàng): khu dự án gốc của nó, lên xong tự về đó */
  duAnGoc?: string; duAnGocTen?: string;
  /** trong XƯỞNG SX (góp ý city #1437): giai đoạn — 'sx' (đang làm / sẵn sàng, chưa nộp) · 'tham-dinh' (đã nộp, chờ duyệt — Phòng thẩm định);
   *  vungSx = khu nhà máy theo loại sản phẩm (khoá VUNG_SX) */
  giaiDoan?: 'sx' | 'tham-dinh'; vungSx?: string;
  /** camp: ngôn ngữ, trạng thái chạy, phim */
  ngonNgu?: string | null; phim?: string | null;
  /** CAMP ETHOPEX theo cụm phim (góp ý city #1439): cumPhim = khoá cụm ('f:<content_id>' hoặc tên phim) · campLoai: 'chay' đang chạy · 'lich' đã lên lịch
   *  (camp mới, đứng hàng cạnh cụm) · 'vi-pham' ad bị Meta từ chối (màu riêng) · 'tat' = KHO camp đã tắt của phim (một toà, soTat camp) ·
   *  campGoc = khoá camp gốc khi đây là bản nhân bản (toà nhỏ đứng quanh gốc) · dangCr = dạng creative (hình toà khác nhau) ·
   *  nhanBanDuoc = đủ luật NB (dấu riêng) · sapTat = lỗ sâu chạm luật OFF (bốc khói) */
  cumPhim?: string; campLoai?: 'chay' | 'lich' | 'vi-pham' | 'tat'; campGoc?: string | null; dangCr?: string | null; nhanBanDuoc?: boolean; sapTat?: boolean; soTat?: number;
  /** thu / chi NGÀY BÁO CÁO MỚI NHẤT của Ethopex (ngayHom, YYYY-MM-DD) — bảng hiệu phim + bảng xếp hạng phim đọc cùng số với bảng Content của Ethopex */
  thuHom?: number; chiHom?: number; ngayHom?: string | null;
  /** khách đang trên site (mốc ONLINE_GIAY của sổ phiên) · phiên từng ngày 30 ngày (tua lại) · cảnh báo hạ tầng (tên miền sắp hết hạn) */
  online?: number; ngay?: Record<string, number>; canhBao?: string | null;
  /** khách có mặt trong 30 phút qua (cột 30M bảng SEO) — người đi vào / ra toà */
  khach30p?: number;
  /** tiền thật 30 ngày (USD) + loại nguồn tiền (Bán hàng, App…); null = chưa có nguồn đo */
  tien30?: number | null; loaiTien?: string;
  /** các phần tiền của đích (một site có thể vừa AdSense vừa đơn shop) */
  tienPhan?: { loai: string; so: number }[];
  /** tiền CHI 30 ngày quy được về đích này (quảng cáo của khu) — có thì toà có vòng lãi (xanh) / lỗ (đỏ) */
  chi30?: number | null;
  /** sản phẩm là một bản trên cửa hàng của app nào (khoá 'a:<app>') — vẽ quanh app, không đứng riêng */
  cha?: string;
  phien30: number | null; laShop: boolean; don: number | null; coNguon: boolean;
  /** sản phẩm: cửa bán (app-store, ms-store, gumroad, etsy, kdp, udemy…), host cửa bán để lấy favicon, trạng thái, số */
  nenBan?: string; hostBan?: string; trangThai?: string | null; sapLen?: boolean; url?: string | null; xem7?: number | null; tai?: number | null; net?: number | null;
}
/** KHU: dự án (laDuAn) hoặc một site đứng riêng; ngung = dự án ngừng hoạt động (đặt ở rìa); nhan = dòng đầu biển trên toà khu ('DỰ ÁN', 'DỰ ÁN · NGỪNG', 'TÀI KHOẢN BỊ KHOÁ') */
export interface PhoDuAn { khoa: string; ten: string; laDuAn: boolean; ngung: boolean; mau: string; site: string | null; nhan: string; linhVuc: string;
  /** đặt ở dãy rìa (cùng dãy dự án ngừng) dù vẫn đang chạy */
  raRia?: boolean;
  /** tiền 30 ngày của khu (đích không phải bản con), lưu lượng (phiên 30 ngày + lượt xem sản phẩm 7 ngày) và QUY MÔ 0..1 để vẽ to nhỏ
   *  (anh 22/10/2026 "dự án có doanh thu hoặc ROI lớn phải trông to hơn" + "những con có traffic nhiều cũng được to lên"):
   *  quy mô = max(điểm tiền, điểm lưu lượng), mỗi điểm chia theo log so với khu cao nhất; điểm tiền = thu × (1 + ROI kẹp 0..3 / 3),
   *  ROI = (thu − chi) / chi, khu có thu mà không chi tính ROI 1 */
  tien30?: number; chi30?: number; luu?: number; quyMo?: number }
/** một dòng xe: toà nguồn → đích, số khách (kỳ theo nguồn) */
export interface PhoLuong { tu: string; den: string; so: number }
/** KHO BẠC: tiền thật 30 ngày (USD) theo loại nguồn tiền */
export interface PhoTien { tong: number; theo: { ten: string; so: number }[]; chi: { tong: number; theo: { ten: string; so: number }[] } }
/** NHÀ MÁY = máy chủ chạy site: tên, nhà cung cấp, chi tháng, hạn, các site nó cấp điện, cảnh báo (sắp hết hạn) */
/** henGio = số việc chạy theo giờ (systemd timer) · loiDv = dịch vụ đang lỗi (systemctl --failed) — trạm ngầm của máy */
export interface PhoNhaMay { khoa: string; ten: string; chiThang: string | null; het: string | null; sites: string[]; canhBao: string | null; tai?: number | null; nhan?: number | null; henGio?: number | null; loiDv?: string[]; ramMB?: number | null; diaPct?: number | null }
export interface PhoPhong { khoa: string; ten: string; truong: string; duAn: string[]; hoatDong: boolean; trangThai: string; viec24: number; cuoi: { luc: string; viec: string; ket?: string } | null }
/** KHU TÀI NGUYÊN (anh 23/10/2026 "bộ phận quản lý tài nguyên, tài khoản, ngân sách trong các tài khoản, trạng thái; các bộ quản lý br"):
 *  tài khoản theo nền (đếm theo nhóm trạng thái + cảnh báo chưa xử), hồ sơ trình duyệt br / máy ảo, proxy, ngân sách (ngày · tháng · chi 30 ngày · một lần) */
export interface PhoTaiNguyen {
  tk: { nen: string; ten: string; tong: number; theo: Record<TtTk, number>; canhBao: number }[];
  hoSo: { tool: string; n: number; gan7: number; cuoi: string | null }[];
  proxy: { suc: string; n: number }[];
  nganSach: { ten: string; ky: 'ngày' | 'tháng' | '30 ngày qua' | 'một lần' | 'hạn mức'; so: number; tienTe: string }[];
  canhBao: { nen: string; loai: string; n: number }[];
  /** cảnh báo chưa xử, từng dòng (nền chưa có kho riêng → kho 'khac'): thẻ kho tài khoản liệt kê + nút mở chỗ cần xử / đánh dấu đã xử */
  canhBaoDs: { id: number; nen: string; handle: string | null; loai: string; noiDung: string | null; url: string | null; luc: string; acct: number | null }[];
  chuaNoi: string[];
}
export interface PhoMoHinh { tk: PhoTk[]; dich: PhoDich[]; duAn: PhoDuAn[]; luong: PhoLuong[]; tien: PhoTien; nhaMay: PhoNhaMay[]; congTy: PhoPhong[]; taiNguyen: PhoTaiNguyen; fav: Record<string, string | null> }
/** trạng thái tài khoản (platform_accounts.status) → nhóm người đọc */
export type TtTk = 'song' | 'nuoi' | 'han' | 'khoa' | 'dong';
export const TT_TK: Record<TtTk, { ten: string; mau: string }> = { song: { ten: 'đang dùng', mau: '#3fd68a' }, nuoi: { ten: 'đang nuôi / tạo', mau: '#ffd166' }, han: { ten: 'bị hạn chế', mau: '#ff9f1c' }, khoa: { ten: 'bị khoá / chặn', mau: '#ff4d5e' }, dong: { ten: 'đã đóng', mau: '#5a6070' } };
export const nhomTt = (st: string): TtTk => (st === 'active' ? 'song' : ['warming', 'creating', 'pending', 'todo'].includes(st) ? 'nuoi' : st === 'limited' ? 'han' : ['banned', 'blocked', 'suspended', 'locked'].includes(st) ? 'khoa' : 'dong');
const TEN_NEN_TK: Record<string, string> = { facebook: 'Facebook', google: 'Google', twitter: 'X', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', pinterest: 'Pinterest', reddit: 'Reddit', outlook: 'Outlook', gumroad: 'Gumroad', producthunt: 'Product Hunt', dailymotion: 'Dailymotion', threads: 'Threads', quora: 'Quora', 'app-store': 'App Store', 'ms-store': 'Microsoft Store', etsy: 'Etsy', kdp: 'Amazon KDP', udemy: 'Udemy', khac: 'Nền khác' };
const SO_NEN_TK = 14;
/** LĨNH VỰC = phường trong thành phố (anh 22/10/2026): mỗi phường một màu nền + cổng có tên. Thêm lĩnh vực = thêm dòng ở đây + gán trong linh_vuc_gan. */
export const LINH_VUC: Record<string, { ten: string; ic: string; mau: string }> = {
  'du-lich': { ten: 'Du lịch', ic: '✈️', mau: '#2f8fbf' }, 'thuong-mai': { ten: 'Thương mại · Dropship', ic: '🛍', mau: '#c0507a' }, app: { ten: 'App', ic: '📱', mau: '#3a6ff0' },
  game: { ten: 'Game', ic: '🎮', mau: '#7a4fd0' }, 'tai-chinh': { ten: 'Tài chính · Công cụ', ic: '🏛', mau: '#2f9c6a' }, 'giao-duc': { ten: 'Giáo dục', ic: '🎓', mau: '#c9902f' },
  'xuat-ban': { ten: 'Xuất bản', ic: '📚', mau: '#8f6a3f' }, trading: { ten: 'Trading', ic: '📈', mau: '#3f9fa0' }, ai: { ten: 'AI · SaaS', ic: '🤖', mau: '#6a7fd0' },
  'quang-cao': { ten: 'Quảng cáo · Aff', ic: '📣', mau: '#d0703a' }, khac: { ten: 'Khác', ic: '▫️', mau: '#5a6070' },
};

/** đầu vào hệ sinh thái (social-traffic › docHeSinhThai) */
export interface VaoHeSinhThai {
  /** ria = khu đặt ở dãy rìa dù đang chạy (projects.pho_ria — Adfond) */
  duAn: { id: string; ten: string; site: string | null; ngung: boolean; ria?: boolean }[];
  /** sổ site ↔ dự án (du_an_site) — thắng projects.website */
  duAnSite: { site: string; duAn: string }[];
  sanPham: { id: string; ten: string; nen: string; trangThai: string | null; url: string | null; store: string | null; sku?: string | null; xem7: number | null; tai: number | null; net: number | null }[];
  /** nguồn khách vào từng sản phẩm 30 ngày: app = số Apple (nguồn × hiển thị / xem trang / tải lần đầu); Gumroad = nơi khách tới (product_daily.refs) */
  nguonSp?: { sp: string; nguon: string; hien: number; xem: number; tai: number }[];
  /** app_ung_dung: tên app → dự án */
  app: { ten: string; duAn: string }[];
  /** tài khoản cửa bán trong vault (etsy FrontPorchZ, kdp htuan82…) → dự án */
  tkCua: { nen: string; handle: string; duAn: string | null; khoa?: boolean }[];
  /** sổ lĩnh vực (linh_vuc_gan): khoa 'p:<dự án>' | 's:<site>' → lĩnh vực (khoá LINH_VUC) */
  linhVuc?: { khoa: string; linhVuc: string }[];
  /** tiền đơn shop của site (shop_don 30 ngày, USD) — cửa hàng mặt tiền như mellowstep.com */
  tienSite?: { site: string; usd: number }[];
  /** AdSense theo site 30 ngày (adsense_daily) */
  tienAds?: { site: string; usd: number }[];
  /** tiền CHI quảng cáo 30 ngày theo nguồn (phu_chi: ExoClick…) — Kho bạc hiện thu và chi */
  chi?: { nguon: string; duAn?: string | null; usd: number }[];
  /** hoa hồng aff 30 ngày (CJ / Awin giao dịch, Ethopex) — site nhà sinh đơn nếu biết, không thì theo dự án hoặc để chung */
  tienAff?: { site: string | null; mang: string; duAn?: string | null; usd: number }[];
  /** sổ hạ tầng (infra_resources): máy chủ (hosting: ip) và tên miền (domain: hạn, ip máy gốc) */
  hat?: { kind: string; label: string; duAn: string | null; het: string | null; ip: string | null; chi: number; tien: string }[];
  /** phòng ban công ty AI: trưởng phòng, dự án phụ trách, đang hoạt động, số việc nền 24 giờ, việc gần nhất */
  congTy?: PhoPhong[];
  /** CAMP ETHOPEX (ethopex-doc): thu / chi 30 ngày mỗi camp (cùng cửa sổ với tiền Ethopex của Kho bạc) */
  camps?: { id: number; ten: string; phim: string | null; ngonNgu: string | null; trangThai: string; thu30: number; chi30: number; nganSachNgay?: number;
    /** content_id phim · dạng creative · ad bị từ chối · đã lên lịch (giờ bắt đầu ở tương lai) · đủ luật nhân bản NB · lỗ sâu chạm luật OFF (ethopex-luat, bộ đọc chấm) */
    phimId?: number | null; dang?: string | null; viPham?: boolean; lich?: boolean; nhanBanDuoc?: boolean; sapTat?: boolean;
    /** thu / chi của ngày báo cáo mới nhất (ngayHom) */
    thuHom?: number; chiHom?: number; ngayHom?: string | null }[];
  /** tài nguyên: tài khoản theo nền × trạng thái, cảnh báo nền tảng chưa xử, hồ sơ trình duyệt, proxy, sổ ngân sách, hạn mức tài khoản QC shop */
  taiNguyen?: { tk: { nen: string; status: string; n: number }[]; canhBao: { nen: string; loai: string; n: number }[]; canhBaoDs?: PhoTaiNguyen['canhBaoDs']; hoSo: { tool: string; n: number; gan7: number; cuoi: string | null }[];
    proxy: { suc: string; n: number }[]; soNganSach: { ten: string; kieu: string; so: number; tienTe: string; chuKy: number | null }[]; tkQcShop: { ten: string; trangThai: string; hanMuc: number | null; tienTe: string }[] };
  /** máy chủ đo trực tiếp (nginx + tải): site nó phục vụ, tải CPU / số nhân, RAM trống, % đĩa; loi = không đo được */
  mayChu?: { ten: string; ip: string; tai: number | null; nhan: number | null; ramMB: number | null; diaPct: number | null; sites: string[]; loi: string | null; henGio?: number | null; loiDv?: string[] }[];
}
/** cửa bán → host để lấy favicon */
export const HOST_BAN: Record<string, string> = { 'app-store': 'apps.apple.com', 'ms-store': 'apps.microsoft.com', 'play-store': 'play.google.com', gumroad: 'gumroad.com', etsy: 'etsy.com', kdp: 'amazon.com', udemy: 'udemy.com', 'mql5-market': 'mql5.com', rapidapi: 'rapidapi.com', 'wordpress.org': 'wordpress.org', stripe: 'stripe.com', course: 'teachable.com' };
const NEN_APP = new Set(['app-store', 'ms-store', 'play-store']);
/** cửa bán → tên người đọc (thẻ hover, biển tường) */
export const TEN_BAN: Record<string, string> = { 'app-store': 'App Store', 'ms-store': 'Microsoft Store', 'play-store': 'Google Play', gumroad: 'Gumroad', etsy: 'Etsy', kdp: 'Amazon KDP', udemy: 'Udemy', 'mql5-market': 'MQL5 Market', rapidapi: 'RapidAPI', 'wordpress.org': 'WordPress.org', stripe: 'Stripe', course: 'Khoá học', camp: 'Camp Meta' };
/** trạng thái chưa lên của sản phẩm → chữ người đọc (thẻ Xưởng SX, bản cửa hàng) */
export const TRANG_THAI_VN: Record<string, string> = { ready: 'sẵn sàng', in_review: 'đang duyệt', owner_review: 'chờ anh duyệt', pending: 'chờ xử lý' };
/** khu trong tổ hợp nhà máy Xưởng SX — theo loại sản phẩm (cửa bán) */
export const VUNG_SX: Record<string, { ten: string; ic: string }> = { app: { ten: 'App', ic: '📱' }, sach: { ten: 'Sách', ic: '📚' }, so: { ten: 'Sản phẩm số', ic: '🧩' }, plugin: { ten: 'Plugin', ic: '🔌' }, 'khoa-hoc': { ten: 'Khoá học', ic: '🎓' }, website: { ten: 'Website', ic: '🌐' }, khac: { ten: 'Khác', ic: '📦' } };
const vungCua = (d: { loai: string; nenBan?: string }) => (d.loai === 'app' || NEN_APP.has(d.nenBan ?? '') ? 'app' : d.loai === 'site' ? 'website' : d.nenBan === 'kdp' ? 'sach'
  : ['gumroad', 'etsy', 'mql5-market', 'rapidapi', 'stripe'].includes(d.nenBan ?? '') ? 'so' : d.nenBan === 'wordpress.org' ? 'plugin' : ['udemy', 'course'].includes(d.nenBan ?? '') ? 'khoa-hoc' : 'khac');
/** đã nộp, đang chờ bên duyệt (cửa hàng / anh) → Phòng thẩm định; 'ready' = làm xong nhưng chưa nộp → còn trong nhà máy */
const CHO_DUYET = new Set(['in_review', 'owner_review', 'pending', 'submitted']);
/** khu XƯỞNG SX (anh 22/10/2026): mọi đích chưa lên — đứng cạnh Công ty AI, không chen vào khu dự án */
export const KHU_XUONG = 'xuong';
/** bản nhân bản camp Ethopex: nhan-ban.py đặt tên "<tên gốc> (nhan ban N cua <id gốc>)" */
export const goCampGoc = (ten: string): number | null => { const m = ten.match(/\(nhan ban \d+ cua (\d+)\)\s*$/); return m ? Number(m[1]) : null; };
/** tên nguồn cửa hàng → chữ người đọc + host lấy favicon */
const NGUON_CH: Record<string, [string, string | null]> = { 'App Store search': ['Tìm trên App Store', 'apps.apple.com'], 'App Store browse': ['Duyệt App Store', 'apps.apple.com'], 'Web referrer': ['Từ web', null], 'App referrer': ['Từ app khác', null], 'Institutional purchase': ['Mua tổ chức', null], direct: ['Trực tiếp', null], Unavailable: ['Không rõ', null] };
const TRANG_THAI_LEN = new Set(['published', 'active', 'live']);
const TRANG_THAI_SAP = new Set(['in_review', 'ready', 'owner_review', 'pending']);

/** sản phẩm → dự án: link trùng site dự án · app (tên app_ung_dung là đầu tên sản phẩm) · tài khoản cửa bán (nền + handle) · tên dự án nằm trong tên sản phẩm ·
 *  sản phẩm anh em cùng đầu tên (Giỗ Chạp (Windows) ↔ Giỗ Chạp: Văn Khấn). Không khớp gì → null. */
export function duAnCuaSanPham(sp: VaoHeSinhThai['sanPham'][number], v: VaoHeSinhThai, daGan: Map<string, string>): string | null {
  const host = siteOf(sp.url);
  if (host) { const d = v.duAnSite.find((x) => x.site === host)?.duAn ?? v.duAn.find((x) => x.site === host)?.id; if (d) return d; }
  const ten = chuan(sp.ten);
  const app = v.app.find((a) => chuan(a.ten).length >= 4 && ten.startsWith(chuan(a.ten))); if (app) return app.duAn;
  const tk = v.tkCua.find((t) => t.duAn && t.nen === sp.nen && sp.store && chuan(t.handle) === chuan(sp.store)); if (tk) return tk.duAn;
  const motTk = v.tkCua.filter((t) => t.duAn && !t.khoa && t.nen === sp.nen); if (!sp.store && motTk.length === 1) return motTk[0]!.duAn;   // cửa bán chỉ có MỘT tài khoản gắn dự án (Chaturbate → Chat When Bored)
  const theoTen = v.duAn.filter((d) => chuan(d.ten).length >= 5 && ten.includes(chuan(d.ten))).sort((a, b) => b.ten.length - a.ten.length)[0]; if (theoTen) return theoTen.id;
  const dau = chuan(sp.ten.split(/[:(\-–]/)[0]!); if (dau.length >= 4) for (const [ten2, d] of daGan) if (ten2.startsWith(dau)) return d;
  return null;
}

const MAU_CUM = ['#3b4f8f', '#2f6f8f', '#7a5a2f', '#2f7a5a', '#6a3f8f', '#8f3f5a', '#4f6f2f', '#2f5a7a'];
const chuan = (h: string) => h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\(page\)/g, '').replace(/[^a-z0-9]/g, '');
const nhieuNhat = (xs: (string | null)[]) => { const d = new Map<string, number>(); for (const x of xs) if (x) d.set(x, (d.get(x) ?? 0) + 1); return [...d].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
const laShop = (site: string) => /(^|\.)(gumroad\.com|etsy\.com|amazon\.com)$/.test(site);
/** dòng bán (Gumroad / Etsy) của một site cửa hàng: tên cửa hàng hoặc dự án trùng đầu tên miền — một luật cho cả số đơn lẫn tiền */
const banCuaShop = (ban: SocialLive['ban'], site: string) => { const ten = chuan(site.split('.')[0]!); return ban.filter((x) => /gumroad|etsy/i.test(x.cua) && (chuan(x.ten) === ten || chuan(x.duAn) === ten)); };

export function tinhThanhPho(live: Pick<SocialLive, 'kenh' | 'luoi' | 'suc' | 'landing' | 'ban' | 'fav' | 'nguonSite' | 'heSinhThai'>): PhoMoHinh {
  const { kenh, luoi, suc } = live;
  const het7 = new Date(Date.parse(`${luoi.hom}T00:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10);
  const nhanDong = (d: { mayTen: string; nenTen: string }) => `${d.mayTen.split(' · ')[0]} · ${d.nenTen}`;   // trùng cách social-suc-khoe ghi tên kênh trong sự cố
  const suCoBad = suc.suCo.filter((x) => x.muc === 'bad');
  const duAnCua = new Map(kenh.map((k) => [String(k.id), k.duAn ?? k.nhom]));

  // nơi đăng (máy × nền) của từng tài khoản: theo br.acct; nền chưa khai acct (TikTok qua máy ảo) → tài khoản cùng nền tảng, cùng dự án với các tài khoản khác của máy đó
  const dongCua = (id: string, nenKey: string, duAn: string) => suc.dong.filter((d) => {
    if (d.acct) return d.acct === id;
    if (nenCuaMay(d.nen) !== nenKey) return false;
    return suc.dong.some((e) => e.may === d.may && e.acct && duAnCua.get(e.acct) === duAn);
  });

  const tho = kenh.filter((k) => NEN_KEY[k.nenKey ?? '']).map((k) => {
    const id = String(k.id), duAn = k.duAn ?? k.nhom, dongs = dongCua(id, k.nenKey!, duAn);
    // sắp đăng = 7 ngày tới (lưới lịch giữ 6 tuần cho lịch tháng — phải cắt ở đây, không thì số phình theo kỳ lịch)
    const sap = luoi.o.filter((o) => o.loai === 'du_kien' && o.ngay <= het7 && dongs.some((d) => d.may === o.may && d.nen === o.nen)).length;
    const loi = suCoBad.find((s) => dongs.some((d) => s.kenh.includes(nhanDong(d))));
    const hong = k.tt === 'khoa' ? 'Tài khoản bị khoá' : k.tt === 'co' ? 'Tài khoản dính cờ' : loi?.tieuDe ?? null;
    return { k, id, duAn, site: nhieuNhat(dongs.map((d) => d.site)), sap, hong };
  });
  // site đích của tài khoản: máy đăng của nó → tài khoản trùng tên (cùng thương hiệu, vd IG hotelscamalerts ↔ X hotelscamalerts) → site chính của dự án → link đích của kênh
  const siteDuAn = new Map<string, string | null>();
  for (const t of tho) if (!siteDuAn.has(t.duAn)) siteDuAn.set(t.duAn, nhieuNhat(tho.filter((x) => x.duAn === t.duAn).map((x) => x.site)));
  for (const t of tho) if (!t.site) t.site = tho.find((x) => x.site && chuan(x.k.ten) === chuan(t.k.ten))?.site ?? null;
  for (const t of tho) if (!t.site) t.site = siteDuAn.get(t.duAn) ?? siteOf(t.k.landing);

  const tk: PhoTk[] = tho.map((t) => ({
    id: t.id, loai: 'mxh' as const, nen: NEN_KEY[t.k.nenKey!]!, ten: t.k.ten.replace(/\s*\(Page\)\s*$/i, ''), duAn: t.duAn,
    chay: t.k.video, sap: t.sap, xem: t.k.daDo === false ? null : t.k.xem, phien: t.k.click, phienKy: t.k.nenKey === 'pinterest' ? '30 ngày' : '7 ngày',
    dich: t.site, hong: t.hong, dung: t.k.tt === 'dung',
  }));

  const hst: VaoHeSinhThai = live.heSinhThai ?? { duAn: [], duAnSite: [], sanPham: [], app: [], tkCua: [] };
  const idTheoTen = new Map(hst.duAn.map((d) => [d.ten, d.id]));
  for (const t of tk) { if (t.dich) t.dich = `s:${t.dich}`; }

  // ── ĐÍCH: site
  const nguonSite = live.nguonSite ?? [];
  const dichMap = new Map<string, PhoDich>();
  const siteMoi = (site: string, phien30: number | null): PhoDich => ({ khoa: `s:${site}`, loai: 'site', ten: site, site, duAn: '', phien30, laShop: laShop(site), don: null, coNguon: false });
  for (const x of nguonSite) dichMap.set(`s:${x.site}`, { ...siteMoi(x.site, x.phien30), online: x.online ?? 0, khach30p: x.khach30p ?? 0, ngay: x.ngay ?? {} });
  for (const l of live.landing) { const k = `s:${l.site}`; if (nguonSite.some((x) => x.site === l.site)) continue; const d = dichMap.get(k) ?? siteMoi(l.site, l.coMa ? 0 : null); if (l.coMa) d.phien30 = (d.phien30 ?? 0) + l.phien30; dichMap.set(k, d); }
  for (const t of tk) if (t.dich && !dichMap.has(t.dich)) dichMap.set(t.dich, siteMoi(t.dich.slice(2), null));
  for (const x of [...(hst.tienAds ?? []), ...(hst.tienSite ?? []), ...(hst.tienAff ?? []).filter((y) => y.site).map((y) => ({ site: y.site!, usd: y.usd }))]) if (x.usd > 0 && !dichMap.has(`s:${x.site}`)) dichMap.set(`s:${x.site}`, siteMoi(x.site, null));   // site có tiền vẫn có mặt dù chưa có phiên

  // ── NGUỒN: máy tìm kiếm cạnh từng site (mỗi site tối đa 6 máy, máy dưới 2 khách bỏ — toà lắt nhắt không giúp đọc)
  for (const x of nguonSite) for (const [k, so] of Object.entries(x.tim).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    const m = MAY_TIM.find((y) => y.khoa === k); if (!m) continue;
    tk.push({ id: `tim:${k}@${x.site}`, loai: 'tim', nen: 'tim', host: m.host, mau: m.mau, ten: m.ten, duAn: 'Tìm kiếm', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `s:${x.site}`, hong: null, dung: false });
  }
  // quảng cáo (tối đa 3 mỗi site) + trang giới thiệu (tối đa 4 mỗi site, từ 2 khách) — cùng khuôn toà nguồn đứng cạnh site
  for (const x of nguonSite) {
    for (const [k, so] of Object.entries(x.qc ?? {}).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      const q = NEN_QC[k] ?? NEN_QC.khac!;
      tk.push({ id: `qc:${k}@${x.site}`, loai: 'qc', nen: 'qc', host: q.host, mau: q.mau, ten: q.ten, duAn: 'Quảng cáo', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `s:${x.site}`, hong: null, dung: false });
    }
    for (const [h, so] of Object.entries(x.gt ?? {}).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4))
      tk.push({ id: `gt:${h}@${x.site}`, loai: 'gt', nen: 'gt', host: h, mau: '#7a8bb3', ten: h, duAn: 'Giới thiệu', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `s:${x.site}`, hong: null, dung: false });
  }
  const luong: PhoLuong[] = tk.filter((t) => t.dich && t.phien).map((t) => ({ tu: t.id, den: t.dich!, so: t.phien }));   // nguồn cửa hàng thêm bên dưới

  // ── ĐÍCH: sản phẩm (đã lên hoặc sắp lên; 'planned' / 'draft' / 'archived' chưa có mặt trong thành phố)
  const daGan = new Map<string, string>();
  // dự án gốc app (anh 22/10/2026 "Clane.app là gốc dự án app"): dự án giữ site clane.app nhận mọi app; dự án cũ của app thành thương hiệu
  const cuaKhoa = new Set([...new Set(hst.tkCua.map((t) => t.nen))].filter((n) => hst.tkCua.filter((t) => t.nen === n).every((t) => t.khoa)));
  const duAnApp = hst.duAnSite.find((x) => x.site === 'clane.app')?.duAn ?? hst.duAn.find((d) => d.site === 'clane.app')?.id ?? null;
  const sps = hst.sanPham.filter((p) => TRANG_THAI_LEN.has(p.trangThai ?? '') || TRANG_THAI_SAP.has(p.trangThai ?? ''));
  for (const p of [...sps].sort((a, b) => Number(TRANG_THAI_LEN.has(b.trangThai ?? '')) - Number(TRANG_THAI_LEN.has(a.trangThai ?? '')))) {
    const d0 = duAnCuaSanPham(p, hst, daGan); if (d0) daGan.set(chuan(p.ten), d0);
    // app có dự án thương hiệu (MilitaryCalc) ở cùng dự án đó (anh 22/10/2026); app chưa thuộc dự án nào về dự án gốc Clane
    // cửa bán mà mọi tài khoản trong vault đều bị khoá (Udemy) → khu 'tài khoản bị khoá' ở rìa
    const d = cuaKhoa.has(p.nen) ? null : d0 ?? (duAnApp && NEN_APP.has(p.nen) ? duAnApp : null);
    dichMap.set(`p:${p.id}`, { khoa: `p:${p.id}`, loai: 'sp', ten: p.ten, site: null, duAn: cuaKhoa.has(p.nen) ? `khoa:${p.nen}` : d ? `d:${d}` : 'chua-sp', phien30: null, laShop: false, don: null, coNguon: false,
      nenBan: p.nen, hostBan: HOST_BAN[p.nen] ?? siteOf(p.url) ?? undefined, trangThai: p.trangThai, sapLen: !TRANG_THAI_LEN.has(p.trangThai ?? ''), url: p.url, xem7: p.xem7, tai: p.tai, net: p.net });
  }

  // ── NGUỒN vào sản phẩm (cửa hàng): mỗi nguồn một toà quanh sản phẩm
  const gomCh = new Map<string, { sp: string; nguon: string; hien: number; xem: number; tai: number }>();
  for (const x of hst.nguonSp ?? []) { const k = `${x.sp}|${x.nguon}`, g = gomCh.get(k) ?? { sp: x.sp, nguon: x.nguon, hien: 0, xem: 0, tai: 0 }; g.hien += x.hien; g.xem += x.xem; g.tai += x.tai; gomCh.set(k, g); }
  for (const g of gomCh.values()) {
    if (!dichMap.has(`p:${g.sp}`)) continue;
    const [ten, host] = NGUON_CH[g.nguon] ?? [g.nguon, /\./.test(g.nguon) ? g.nguon : null], so = g.hien || g.xem || g.tai; if (!so) continue;
    const t: PhoTk = { id: `ch:${g.nguon}@p:${g.sp}`, loai: 'ch', nen: 'ch', mau: '#0a84ff', ten, duAn: 'Cửa hàng', chay: 0, sap: 0, xem: null, phien: so, phienKy: '30 ngày', dich: `p:${g.sp}`, hong: null, dung: false, chiTiet: { hien: g.hien, xem: g.xem, tai: g.tai } };
    if (host) t.host = host;
    tk.push(t); luong.push({ tu: t.id, den: t.dich!, so });
  }

  // ── APP = một thực thể trên mọi cửa hàng (anh 22/10/2026 "dự án app là app chứ không phải mỗi iOS"): gom bản App Store / Microsoft Store / Google Play
  //    cùng đầu tên (Giỗ Chạp: Văn Khấn ↔ Giỗ Chạp (Windows)) thành một app; các bản đứng quanh app, nguồn của từng bản đứng quanh bản đó
  const dauApp = (ten: string) => chuan(ten.split(/[:(\-–]/)[0]!.replace(/\b(ios|iphone|windows|android|mac)\b/gi, ''));
  const nhomApp = new Map<string, PhoDich[]>();
  for (const d of dichMap.values()) if (d.loai === 'sp' && NEN_APP.has(d.nenBan ?? '')) { const k = dauApp(d.ten) || d.khoa; nhomApp.set(k, [...(nhomApp.get(k) ?? []), d]); }
  for (const [k, ban] of nhomApp) {
    const chinh = [...ban].sort((a, b) => Number(!!a.sapLen) - Number(!!b.sapLen) || a.ten.length - b.ten.length)[0]!;
    const duAn = ban.find((b) => b.duAn.startsWith('d:'))?.duAn ?? chinh.duAn;
    for (const b of ban) { b.cha = `a:${k}`; b.duAn = duAn; }
    dichMap.set(`a:${k}`, { khoa: `a:${k}`, loai: 'app', ten: chinh.ten.split(/[:(]/)[0]!.trim(), site: null, duAn, phien30: null, laShop: false, don: null, coNguon: false, sapLen: ban.every((b) => b.sapLen) });
  }

  // ── đơn cửa hàng (Gumroad / Etsy) + có nguồn chưa
  for (const d of dichMap.values()) {
    d.coNguon = luong.some((l) => l.den === d.khoa || (d.loai === 'app' && [...dichMap.values()].some((b) => b.cha === d.khoa && l.den === b.khoa)));
    if (d.loai === 'site' && d.laShop) { const b = banCuaShop(live.ban, d.site!); if (b.length) d.don = b.reduce((a, x) => a + (x.ban30 ?? 0), 0); }
  }
  // ── TIỀN 30 ngày (USD): sản phẩm = thực nhận kho products (App Store, AdMob, Gumroad, Udemy, KDP…) · cửa hàng Gumroad / Etsy = bán 30 ngày · shop mặt tiền = đơn shop_don
  const LOAI_TIEN: Record<string, string> = { 'app-store': 'App', 'ms-store': 'App', 'play-store': 'App', gumroad: 'Bán sản phẩm số', etsy: 'Bán sản phẩm số', kdp: 'Sách', udemy: 'Khoá học', 'mql5-market': 'Bán sản phẩm số', rapidapi: 'API', chaturbate: 'Hoa hồng aff', stripcash: 'Hoa hồng aff', stripe: 'Thanh toán', astrolas: 'Đăng ký' };
  for (const d of dichMap.values()) {
    if (d.loai === 'sp') { d.tien30 = d.net ?? null; d.loaiTien = LOAI_TIEN[d.nenBan ?? ''] ?? 'Khác'; if (d.net) d.tienPhan = [{ loai: d.loaiTien, so: d.net }]; }
    if (d.loai === 'site') {
      const usdAds = (hst.tienAds ?? []).filter((x) => x.site === d.site).reduce((a, x) => a + x.usd, 0);
      const usdAff = (hst.tienAff ?? []).filter((x) => x.site === d.site).reduce((a, x) => a + x.usd, 0);
      const usdBan = d.laShop ? banCuaShop(live.ban, d.site!).reduce((a, x) => a + (x.usd30 ?? 0), 0) : 0;
      const usdShop = (hst.tienSite ?? []).filter((x) => x.site === d.site).reduce((a, x) => a + x.usd, 0);
      d.tienPhan = [{ loai: 'Bán sản phẩm số', so: usdBan }, { loai: 'Đơn shop', so: usdShop }, { loai: 'AdSense', so: usdAds }, { loai: 'Hoa hồng aff', so: usdAff }].filter((x) => x.so > 0);
      d.tien30 = d.tienPhan.length ? d.tienPhan.reduce((a, x) => a + x.so, 0) : null; d.loaiTien = d.tienPhan.map((x) => x.loai).join(' + ');
    }
  }
  for (const d of dichMap.values()) if (d.loai === 'app') { const ban = [...dichMap.values()].filter((b) => b.cha === d.khoa); const co = ban.filter((b) => b.tien30 != null); d.tien30 = co.length ? co.reduce((a, b) => a + b.tien30!, 0) : null; d.loaiTien = 'App'; }
  // giữ site có khách hoặc có người trỏ tới
  const dich = [...dichMap.values()].filter((d) => d.loai !== 'site' || d.coNguon || (d.tien30 ?? 0) > 0 || (d.phien30 ?? 0) > 0 || tk.some((t) => t.dich === d.khoa));

  // ── KHU (dự án): site → sổ du_an_site → projects.website → dự án của tài khoản trỏ tới nó → site phụ cùng máy đăng → đứng riêng
  const siteDa = new Map<string, string>([...hst.duAn.filter((d) => d.site).map((d) => [d.site!, d.id] as [string, string]), ...hst.duAnSite.map((x) => [x.site, x.duAn] as [string, string])]);
  const tuTk = (khoa: string) => { const t = tho.find((x) => x.site && `s:${x.site}` === khoa); return t ? idTheoTen.get(t.duAn) ?? null : null; };
  for (const d of dich) if (d.loai === 'site') {
    const site = d.site!;
    let da = siteDa.get(site) ?? [...siteDa].find(([s2]) => site.endsWith(`.${s2}`))?.[1] ?? null;   // *.clane.app → dự án của clane.app
    if (!da) { const dm = suc.dong.find((x) => x.sites?.includes(site) && x.site && x.site !== site); if (dm) da = siteDa.get(dm.site!) ?? tuTk(`s:${dm.site}`); }
    if (!da) da = tuTk(d.khoa);
    // dự án chung nhiều thương hiệu (Social Traffic: Hotel + BYL) không gom site: mỗi site đứng riêng như một dự án
    if (da && hst.duAn.find((x) => x.id === da)?.site == null && !hst.duAnSite.some((x) => x.duAn === da) && dich.filter((y) => y.loai === 'site' && tuTk(y.khoa) === da).length > 1) da = null;
    d.duAn = da ? `d:${da}` : `rieng:${site}`;
  }
  // ── ETHOPEX (anh 22/10/2026 "dự án chính với dòng tiền đang có"): toà nền tảng ở tâm khu; quanh nó là CỤM PHIM (góp ý city #1439) — mỗi phim một cụm:
  //    camp đang chạy / vi phạm mỗi camp một toà, bản nhân bản bám camp gốc, camp lên lịch đứng hàng cạnh, mọi camp đã tắt của phim gộp MỘT toà kho.
  //    Tiền Kho bạc vẫn tính một lần ở toà nền tảng (camp không mang tienPhan).
  if (hst.camps?.length && hst.duAn.some((p) => p.id === 'ethopex')) {
    const hom = (k: 'thuHom' | 'chiHom', ds_: NonNullable<VaoHeSinhThai['camps']>) => ds_.reduce((a, c) => a + (c[k] ?? 0), 0);
    const hub: PhoDich = { khoa: 'n:ethopex', loai: 'nen', ten: 'Ethopex', site: null, duAn: 'd:ethopex', phien30: null, laShop: false, don: null, coNguon: false, nenBan: 'camp', hostBan: 'facebook.com',
      thuHom: hom('thuHom', hst.camps), chiHom: hom('chiHom', hst.camps), ngayHom: hst.camps.find((c) => c.ngayHom)?.ngayHom ?? null };
    dich.push(hub);
    const tenPhim = (c: NonNullable<VaoHeSinhThai['camps']>[number]) => c.phim ?? c.ten.replace(/\s*\(nhan ban \d+ cua \d+\)\s*$/, '').replace(/^(TEST )?\d{4}(ns)? /, '').split(/ (EN|ES) - /)[0]!;
    const cumCua = (c: NonNullable<VaoHeSinhThai['camps']>[number]) => (c.phimId ? `f:${c.phimId}` : `f:${tenPhim(c).toLowerCase()}`);
    const chung = { site: null, duAn: 'd:ethopex', cha: hub.khoa, phien30: null, laShop: false, don: null, coNguon: false, nenBan: 'camp', hostBan: 'facebook.com' } as const;
    const hien = hst.camps.filter((c) => c.trangThai === 'active' || c.viPham), hienId = new Set(hien.map((c) => c.id));
    for (const c of hien) { const g = goCampGoc(c.ten);
      dich.push({ ...chung, khoa: `c:${c.id}`, loai: 'camp', ten: c.ten, trangThai: c.trangThai, tien30: c.thu30, chi30: c.chi30, ngonNgu: c.ngonNgu, phim: tenPhim(c), cumPhim: cumCua(c),
        campLoai: c.viPham ? 'vi-pham' : c.lich ? 'lich' : 'chay', campGoc: g != null && hienId.has(g) ? `c:${g}` : null, dangCr: c.dang ?? null, nhanBanDuoc: !!c.nhanBanDuoc && !c.viPham, sapTat: !!c.sapTat && !c.viPham,
        thuHom: c.thuHom ?? 0, chiHom: c.chiHom ?? 0 }); }
    const tat = new Map<string, NonNullable<VaoHeSinhThai['camps']>>();
    for (const c of hst.camps) if (!hienId.has(c.id)) tat.set(cumCua(c), [...(tat.get(cumCua(c)) ?? []), c]);
    for (const [cum, ds_] of tat) dich.push({ ...chung, khoa: `ct:${cum}`, loai: 'camp', ten: `${ds_.length} camp đã tắt`, trangThai: 'paused', tien30: ds_.reduce((a, c) => a + c.thu30, 0), chi30: ds_.reduce((a, c) => a + c.chi30, 0),
      ngonNgu: null, phim: tenPhim(ds_[0]!), cumPhim: cum, campLoai: 'tat', campGoc: null, dangCr: null, soTat: ds_.length, thuHom: hom('thuHom', ds_), chiHom: hom('chiHom', ds_) });
  }
  // tiền / chi theo DỰ ÁN (Ethopex, chi quảng cáo PHỦ): gắn vào đích chính của khu (đích nhiều tiền nhất, không có thì site đông nhất) — chưa có đích thì dựng một đích đại diện
  const dichChinh = (khoa: string) => dich.filter((d) => d.duAn === khoa && !d.cha).sort((a, b) => (b.tien30 ?? 0) - (a.tien30 ?? 0) || (b.phien30 ?? 0) - (a.phien30 ?? 0))[0];
  const ganKhu = (duAn: string, ten: string) => { const k = `d:${duAn}`; let d = dichChinh(k); if (!d && hst.duAn.some((p) => p.id === duAn)) { d = { khoa: `p:${duAn}-tien`, loai: 'sp', ten, site: null, duAn: k, phien30: null, laShop: false, don: null, coNguon: false, nenBan: duAn, hostBan: hst.duAn.find((p) => p.id === duAn)?.site ?? undefined }; dich.push(d); } return d; };
  for (const x of (hst.tienAff ?? []).filter((y) => !y.site && y.duAn && y.usd)) { const d = ganKhu(x.duAn!, x.mang); if (d) { d.tienPhan = [...(d.tienPhan ?? []), { loai: `Hoa hồng aff · ${x.mang}`, so: x.usd }]; d.tien30 = (d.tien30 ?? 0) + x.usd; } }
  for (const x of (hst.chi ?? []).filter((y) => y.duAn && y.usd)) { const d = ganKhu(x.duAn!, x.nguon); if (d) d.chi30 = (d.chi30 ?? 0) + x.usd; }
  // XƯỞNG SX: đích chưa lên (sản phẩm / app mà mọi bản đang duyệt) rời khu dự án, giữ dự án gốc; bản cửa hàng của app đi theo app (cha)
  const tenKhuGoc = (k: string) => (k.startsWith('d:') ? hst.duAn.find((x) => x.id === k.slice(2))?.ten ?? k.slice(2) : k.startsWith('rieng:') ? k.slice(6) : k.startsWith('khoa:') ? k.slice(5) : 'Chưa gán dự án');
  const vaoXuong = (x: PhoDich) => { x.duAnGoc = x.duAn; x.duAnGocTen = tenKhuGoc(x.duAn); x.duAn = KHU_XUONG; };
  for (const d of dich) if (d.sapLen && !d.cha) { vaoXuong(d); for (const b of dich) if (b.cha === d.khoa) vaoXuong(b); }
  // giai đoạn + khu nhà máy: app chờ duyệt khi có bản cửa hàng nào đã nộp
  for (const d of dich) if (d.duAn === KHU_XUONG && !d.cha) {
    const cho = d.loai === 'app' ? dich.some((b) => b.cha === d.khoa && CHO_DUYET.has(b.trangThai ?? '')) : CHO_DUYET.has(d.trangThai ?? '');
    d.giaiDoan = cho ? 'tham-dinh' : 'sx'; d.vungSx = vungCua(d);
  }
  const khoaDa = [...new Set(dich.map((d) => d.duAn))];
  const lvMap = new Map((hst.linhVuc ?? []).map((x) => [x.khoa, x.linhVuc]));
  const lvCua = (khoa: string, site: string | null) => { const lv = (khoa.startsWith('d:') ? lvMap.get(`p:${khoa.slice(2)}`) : khoa.startsWith('rieng:') ? lvMap.get(`s:${khoa.slice(6)}`) : null) ?? (site ? lvMap.get(`s:${site}`) : null); return lv && LINH_VUC[lv] ? lv : 'khac'; };
  const duAn: PhoDuAn[] = khoaDa.map((khoa, i) => {
    const ds = dich.filter((d) => d.duAn === khoa), p = khoa.startsWith('d:') ? hst.duAn.find((x) => x.id === khoa.slice(2)) : null;
    const siteChinh = ds.filter((d) => d.loai === 'site').sort((a, b) => (b.phien30 ?? -1) - (a.phien30 ?? -1))[0]?.site ?? null;
    const khoaTk = khoa.startsWith('khoa:'), tenCua = khoaTk ? khoa.slice(5).replace(/^./, (c) => c.toUpperCase()) : '';
    if (khoa === KHU_XUONG) return { khoa, ten: 'Xưởng SX', laDuAn: true, ngung: false, mau: '#c98a2f', site: null, nhan: 'XƯỞNG SX', linhVuc: 'khac' };
    return { khoa, ten: khoa === 'chua-sp' ? 'Sản phẩm chưa gán dự án' : khoaTk ? tenCua : p ? p.ten : khoa.startsWith('rieng:') ? khoa.slice(6) : khoa, laDuAn: !!p || khoa === 'chua-sp' || khoaTk,
      ngung: !!p?.ngung || khoaTk, raRia: !!p?.ria, mau: MAU_CUM[i % MAU_CUM.length]!, site: khoaTk ? HOST_BAN[khoa.slice(5)] ?? null : p?.site ?? siteChinh, nhan: khoaTk ? 'TÀI KHOẢN BỊ KHOÁ' : p?.ngung ? 'DỰ ÁN · NGỪNG' : 'DỰ ÁN',
      linhVuc: lvCua(khoa, p?.site ?? siteChinh) };
  });
  // trong phường: khu có tiền thật đứng đầu (Ethopex), rồi theo lưu lượng
  const tienKhu = (k: string) => dich.filter((d) => d.duAn === k && !d.cha).reduce((a, d) => a + (d.tien30 ?? 0), 0);
  const tongKhu = (k: string) => dich.filter((d) => d.duAn === k).reduce((a, d) => a + (d.phien30 ?? 0) + (d.xem7 ?? 0), 0);
  for (const k of duAn) { const ds = dich.filter((d) => d.duAn === k.khoa && !d.cha); k.tien30 = ds.reduce((a, d) => a + (d.tien30 ?? 0), 0); k.chi30 = ds.reduce((a, d) => a + (d.chi30 ?? 0), 0); k.luu = tongKhu(k.khoa); }
  const diemTien = (k: PhoDuAn) => { const thu = k.tien30 ?? 0, chi = k.chi30 ?? 0, roi = chi > 0 ? (thu - chi) / chi : thu > 0 ? 1 : 0; return thu * (1 + Math.max(0, Math.min(3, roi)) / 3); };
  const chuan01 = (v: number, max: number) => (max > 0 ? Math.log10(1 + v) / Math.log10(1 + max) : 0);
  const maxTien = Math.max(0, ...duAn.map(diemTien)), maxLuu = Math.max(0, ...duAn.filter((k) => k.khoa !== KHU_XUONG).map((k) => k.luu ?? 0));
  for (const k of duAn) k.quyMo = k.khoa === KHU_XUONG ? 0 : Math.max(chuan01(diemTien(k), maxTien), chuan01(k.luu ?? 0, maxLuu));
  // phường liền nhau: xếp theo thứ tự lĩnh vực, trong phường theo lưu lượng
  const thuLv = Object.keys(LINH_VUC);
  duAn.sort((a, b) => Number(a.ngung || !!a.raRia) - Number(b.ngung || !!b.raRia) || Number(a.khoa === 'chua-sp') - Number(b.khoa === 'chua-sp') || thuLv.indexOf(a.linhVuc) - thuLv.indexOf(b.linhVuc) || tienKhu(b.khoa) - tienKhu(a.khoa) || tongKhu(b.khoa) - tongKhu(a.khoa));
  const theoTien = new Map<string, number>();
  for (const d of dich) if (d.loai !== 'app' && d.loai !== 'camp') for (const p of d.tienPhan ?? []) { const loai = p.loai.startsWith('Hoa hồng aff') ? 'Hoa hồng aff' : p.loai; theoTien.set(loai, (theoTien.get(loai) ?? 0) + p.so); }
  const affChung = (hst.tienAff ?? []).filter((y) => !y.site && !y.duAn).reduce((a, y) => a + y.usd, 0); if (affChung) theoTien.set('Hoa hồng aff (chưa rõ site)', affChung);
  const chiN = (hst.chi ?? []).filter((x) => x.usd > 0);
  const tien: PhoTien = { tong: [...theoTien.values()].reduce((a, x) => a + x, 0), theo: [...theoTien].map(([ten, so]) => ({ ten, so })).sort((a, b) => b.so - a.so),
    chi: { tong: chiN.reduce((a, x) => a + x.usd, 0), theo: chiN.map((x) => ({ ten: x.nguon, so: x.usd })).sort((a, b) => b.so - a.so) } };
  // ── HẠ TẦNG: nhà máy theo IP (sổ hosting + máy gốc của tên miền) + máy đang chạy mos2 (nginx); cảnh báo hạn: tên miền ≤ 30 ngày, máy ≤ 14 ngày
  const homNay = luoi.hom, conNgay = (het: string) => Math.round((Date.parse(het) - Date.parse(homNay)) / 864e5);
  const dm = (n: string) => `${n.slice(8, 10)}/${n.slice(5, 7)}`;
  for (const r of (hst.hat ?? []).filter((x) => x.kind === 'domain' && x.het)) { const d = dich.find((y) => y.site === r.label.replace(/^www\./, '')); if (d && conNgay(r.het!) <= 30) d.canhBao = `Tên miền hết hạn ${dm(r.het!)} (còn ${conNgay(r.het!)} ngày)`; }
  const may = new Map<string, PhoNhaMay>();
  const layMay = (khoa: string, ten: string) => { const m = may.get(khoa) ?? { khoa, ten, chiThang: null, het: null, sites: [], canhBao: null }; may.set(khoa, m); return m; };
  const siteDich = new Set(dich.filter((d) => d.loai === 'site').map((d) => d.site!));
  for (const r of (hst.hat ?? []).filter((x) => x.ip)) {
    const m = layMay(r.ip!, r.kind === 'hosting' ? r.label : r.ip!);
    if (r.kind === 'hosting') { if (m.ten === r.ip) m.ten = r.label; if (r.chi) m.chiThang = `${r.chi.toLocaleString('vi-VN')} ${r.tien}`; if (r.het) { m.het = r.het; if (conNgay(r.het) <= 14) m.canhBao = `Máy hết hạn ${dm(r.het)} (còn ${conNgay(r.het)} ngày)`; }
      for (const d of dich) if (d.loai === 'site' && r.duAn && d.duAn === `d:${r.duAn}` && !m.sites.includes(d.site!)) m.sites.push(d.site!); }
    else { const s = r.label.replace(/^www\./, ''); if (siteDich.has(s) && !m.sites.includes(s)) m.sites.push(s); }
  }
  // máy đo trực tiếp: tên chuẩn, tải, site theo nginx (một site chỉ thuộc một máy: máy đo được thắng sổ)
  for (const mc of hst.mayChu ?? []) {
    const m = layMay(mc.ip, mc.ten); m.ten = mc.ten; Object.assign(m, { tai: mc.tai, nhan: mc.nhan, ramMB: mc.ramMB, diaPct: mc.diaPct, henGio: mc.henGio ?? null, loiDv: mc.loiDv ?? [] });
    for (const s of mc.sites) if (siteDich.has(s)) { for (const k of may.values()) if (k !== m) k.sites = k.sites.filter((x) => x !== s); if (!m.sites.includes(s)) m.sites.push(s); }
    const qt = mc.tai != null && mc.nhan ? mc.tai / mc.nhan : 0;
    if (mc.loi) m.canhBao = m.canhBao ?? `Không đo được máy (${mc.loi})`;
    else if (mc.loiDv?.length) m.canhBao = m.canhBao ?? `${mc.loiDv.length} dịch vụ lỗi: ${mc.loiDv.slice(0, 3).join(', ')}`;
    else if (qt > .9) m.canhBao = m.canhBao ?? `Quá tải: ${mc.tai} / ${mc.nhan} nhân`;
    else if ((mc.diaPct ?? 0) >= 90) m.canhBao = m.canhBao ?? `Đĩa đầy ${mc.diaPct}%`;   // 85–89% chỉ đèn vàng (cảnh), ≥ 90% mới báo
  }
  const nhaMay = [...may.values()].filter((m) => m.sites.length || m.canhBao || m.tai != null).sort((a, b) => b.sites.length - a.sites.length);
  const congTy = [...(hst.congTy ?? [])].sort((a, b) => Number(b.hoatDong) - Number(a.hoatDong) || b.viec24 - a.viec24);
  // ── TÀI NGUYÊN
  const vt = hst.taiNguyen;
  const theoNen = new Map<string, { tong: number; theo: Record<TtTk, number> }>();
  for (const x of vt?.tk ?? []) { const g = theoNen.get(x.nen) ?? { tong: 0, theo: { song: 0, nuoi: 0, han: 0, khoa: 0, dong: 0 } }; g.tong += x.n; g.theo[nhomTt(x.status)] += x.n; theoNen.set(x.nen, g); }
  const xepNen = [...theoNen].sort((a, b) => b[1].tong - a[1].tong), dau = xepNen.slice(0, SO_NEN_TK), con = xepNen.slice(SO_NEN_TK);
  // cảnh báo của nền không có kho (nền ít tài khoản / chưa rõ nền) → kho 'khac' — không để cảnh báo nào mất chỗ
  const coKho = new Set(dau.map(([n]) => n)), cbLac = (vt?.canhBao ?? []).filter((c) => !coKho.has(c.nen));
  if (con.length || cbLac.length) { const g = { tong: 0, theo: { song: 0, nuoi: 0, han: 0, khoa: 0, dong: 0 } as Record<TtTk, number> }; for (const [, x] of con) { g.tong += x.tong; for (const k of Object.keys(g.theo) as TtTk[]) g.theo[k] += x.theo[k]; } dau.push(['khac', g]); }
  const veKho = (nen: string) => (dau.some(([n]) => n === nen && n !== 'khac') ? nen : 'khac');
  const cbNen = (nen: string) => (vt?.canhBao ?? []).filter((c) => veKho(c.nen) === nen).reduce((a, c) => a + c.n, 0);
  const campChay = (hst.camps ?? []).filter((c) => c.trangThai === 'active');
  const taiNguyen: PhoTaiNguyen = {
    tk: dau.map(([nen, g]) => ({ nen, ten: TEN_NEN_TK[nen] ?? nen.replace(/^./, (c) => c.toUpperCase()), tong: g.tong, theo: g.theo, canhBao: cbNen(nen) })),
    hoSo: vt?.hoSo ?? [], proxy: vt?.proxy ?? [], canhBao: (vt?.canhBao ?? []).map((c) => ({ ...c, nen: veKho(c.nen) })), canhBaoDs: (vt?.canhBaoDs ?? []).map((c) => ({ ...c, nen: veKho(c.nen) })),
    nganSach: [
      ...(campChay.length ? [{ ten: `Ethopex · ngân sách đặt trên ${campChay.length} camp đang bật`, ky: 'ngày' as const, so: campChay.reduce((a, c) => a + (c.nganSachNgay ?? 0), 0), tienTe: 'USD' }] : []),
      ...(hst.chi ?? []).filter((x) => x.usd > 0).map((x) => ({ ten: `Chi QC · ${x.nguon}`, ky: '30 ngày qua' as const, so: x.usd, tienTe: 'USD' })),
      ...(vt?.soNganSach ?? []).map((x) => ({ ten: x.ten, ky: (x.chuKy ? 'tháng' : 'một lần') as 'tháng' | 'một lần', so: x.chuKy ? (x.so * 30) / x.chuKy : x.so, tienTe: x.tienTe })),
      ...(vt?.tkQcShop ?? []).filter((x) => x.hanMuc != null).map((x) => ({ ten: `TK QC shop · ${x.ten}`, ky: 'hạn mức' as const, so: x.hanMuc!, tienTe: x.tienTe })),
    ],
    chuaNoi: ['Ngân sách / số dư Google Ads (DB adfond — mos2 chưa có quyền đọc)'],
  };
  return { tk, dich, duAn, luong, tien, nhaMay, congTy, taiNguyen, fav: live.fav };
}
