// SỔ WIDGET + MÀN của /home — MỘT nguồn cho: kho widget (panel phải, bảng tìm), bố cục dựng sẵn từng màn, kiểm bố cục khi lưu (máy chủ), thanh màn bên trái.
// File THƯỜNG (không 'use client'): server page + client component cùng import được giá trị thật.
// Thêm widget = một mục WIDGET ở đây + một hàm vẽ cùng mã trong components/home/ve.tsx (kiểu Record<MaWidget, …> bắt thiếu lúc kiểm kiểu;
// scripts/check-home-widget.mjs đối chiếu với sổ tab trang chủ: tab nào của `/` không có widget nào nhận là đỏ).
// Cỡ tính theo lưới mịn 48 × 72 (lib/home/luoi.ts): một ô của lưới 12×18 = 4 × 4.
import type { O } from './luoi';

export type NhomWidget = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'K' | 'L';
export const NHOM: Record<NhomWidget, string> = { A: 'Toàn cảnh', B: 'Campaign phủ', C: 'Tiền', D: 'Tài sản và kênh', E: 'SEO', F: 'Email', G: 'Dự án', H: 'Ethopex', I: 'Social Traffic', K: 'Máy', L: 'Thư viện' };
/** ngu: tham số ngữ cảnh widget đọc (thanh đầu trang chỉ hiện bộ chọn mà màn đang mở cần) · tuDe: ruột đã có tiêu đề riêng → khung không vẽ thêm thanh tiêu đề lúc xem ·
 *  ghi: có nút ghi dữ liệu · tab: tab của trang chủ cũ mà widget này thay (sổ lib/tab-trang.ts) */
export type WidgetSo = { ten: string; moTa: string; mac: [number, number]; ngu?: ('p' | 'days' | 'ky')[]; tuDe?: true; ghi?: true; tab: string };
export const WIDGET = {
  A1: { ten: 'Dải số chính', moTa: 'doanh thu 30 ngày · chi QC · view → click → out · signup · camp chạy', mac: [48, 10], ngu: ['p', 'days'], tuDe: true, tab: 'camp' },
  A2: { ten: 'Cần chú ý', moTa: 'adapter hỏng · lander cũ · camp tới ngưỡng · sid lạ', mac: [16, 24], ngu: ['p', 'days'], tab: 'camp' },
  B1: { ten: 'Bảng campaign', moTa: 'phễu từng camp + phán xét; nhật ký, soi nguồn, nhập chi', mac: [36, 40], ngu: ['p', 'days'], tuDe: true, ghi: true, tab: 'camp' },
  B2: { ten: 'Nền tảng phủ', moTa: 'trạng thái · chương trình · hoa hồng · đường thoát', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, ghi: true, tab: 'phu' },
  B3: { ten: 'Nguồn traffic', moTa: 'số dư · macro · trạng thái · nguồn định làm / đã bỏ', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, ghi: true, tab: 'nguon' },
  B4: { ten: 'Lander', moTa: 'host · lần sinh cuối · số mục', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, tab: 'hatang' },
  B5: { ten: 'Adapter', moTa: 'lịch chạy · lần chạy cuối · postback', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, tab: 'hatang' },
  C1: { ten: 'Lịch doanh thu', moTa: 'tiền từng ngày theo nguồn, 30 ngày gần nhất', mac: [32, 36], tab: 'doanhthu' },
  C2: { ten: 'Phễu offer affiliate', moTa: 'offer cities.gg · steamsolo', mac: [24, 24], tuDe: true, tab: 'doanhthu' },
  C3: { ten: 'Awin theo ngày', moTa: 'dải số + hàng tồn Awin', mac: [16, 36], tuDe: true, tab: 'doanhthu' },
  C4: { ten: 'Phễu nhận biết cities.gg', moTa: 'dải số + bảng theo nước', mac: [24, 24], tuDe: true, tab: 'doanhthu' },
  C5: { ten: 'Chi AI', moTa: 'tiền mô hình hôm nay / 7 / 30 ngày', mac: [48, 12], tuDe: true, tab: 'duan' },
  C6: { ten: 'Lệnh MT5', moTa: 'lệnh sống theo strategy (strategy-lab) — khối nặng, nên để ở màn riêng', mac: [48, 60], tab: 'lenh' },
  D1: { ten: 'Số tài sản', moTa: 'website · shop · đang bán · chờ duyệt · sẵn sàng · đang làm', mac: [48, 10], ngu: ['ky'], tuDe: true, tab: 'taisan' },
  D2: { ten: 'Bảng website', moTa: 'GSC · GA4 · Bing · Clarity · social trỏ về của mọi site', mac: [32, 40], ngu: ['ky'], tuDe: true, ghi: true, tab: 'taisan' },
  D3: { ten: 'Shop → sản phẩm', moTa: 'cây shop, duyệt + đổi trạng thái sản phẩm', mac: [24, 40], ngu: ['ky'], ghi: true, tab: 'taisan' },
  D4: { ten: 'Video ngắn', moTa: 'lượt xem 7 ngày theo nền và theo video', mac: [24, 32], ngu: ['ky'], tab: 'taisan' },
  D5: { ten: 'Ma trận kênh traffic', moTa: 'tựa × phương pháp kéo khách', mac: [24, 32], ngu: ['ky'], ghi: true, tab: 'taisan' },
  D6: { ten: 'Kênh nội dung', moTa: 'bảng kênh video, mở ra cây tập', mac: [32, 48], ngu: ['ky'], tab: 'kenh' },
  E1: { ten: 'SEO một site', moTa: 'chọn site → GSC / Bing 30 ngày + truy vấn', mac: [28, 36], ghi: true, tab: 'seo' },
  E2: { ten: 'SteamSolo ngôn ngữ', moTa: 'số liệu theo ngôn ngữ + engagement', mac: [20, 36], tuDe: true, tab: 'seo' },
  F1: { ten: 'Danh sách MailWizz', moTa: 'dải số + bảng list ba tầng', mac: [20, 40], tuDe: true, tab: 'email' },
  F2: { ten: 'Gửi thư có tới không', moTa: 'domain gửi (SPF · DKIM · DMARC) · lịch warm-up · seed · engagement', mac: [28, 48], ghi: true, tab: 'email' },
  G1: { ten: 'Lưới dự án', moTa: 'thẻ dự án, lọc theo sức khoẻ / loại / chế độ', mac: [32, 40], tab: 'duan' },
  H1: { ten: 'Số Ethopex', moTa: 'camp bật · chi · lãi · ROI · đủ điều kiện tăng / giảm · ad bị từ chối', mac: [48, 13], tuDe: true, tab: 'ethopex' },
  H2: { ten: 'Camp Ethopex', moTa: 'bảng camp + luật đang chạm, lọc đang bật / đã tắt / chạm luật', mac: [32, 48], tab: 'ethopex' },
  H3: { ten: 'Ethopex theo ngày', moTa: 'biểu đồ lãi từng ngày, lọc phim / camp / dạng / ngôn ngữ', mac: [24, 32], tab: 'ethopex' },
  H4: { ten: 'Thể loại × thứ', moTa: 'ROI từng thể loại phim theo thứ trong tuần', mac: [24, 32], tab: 'ethopex' },
  H5: { ten: 'Ethopex theo phim', moTa: 'số từng phim + đề xuất dạng creative', mac: [24, 32], tab: 'ethopex' },
  H6: { ten: 'Phim chờ test', moTa: 'hàng chờ lên camp', mac: [16, 28], tab: 'ethopex' },
  H7: { ten: 'Lên test', moTa: 'mỗi ngày: camp mới · phim mới · còn bật / đã tắt · ROI lứa camp', mac: [24, 32], tab: 'ethopex' },
  H8: { ten: 'Sổ luật Ethopex', moTa: 'các luật đang áp cho camp', mac: [24, 32], tab: 'ethopex' },
  I1: { ten: 'Sức khoẻ đăng', moTa: 'máy đăng có đều không, lỡ lượt nào', mac: [16, 36], tab: 'social' },
  I2: { ten: 'Phễu social', moTa: 'lượt xem → về site → sang shop → đơn', mac: [16, 28], tuDe: true, tab: 'social' },
  I3: { ten: 'Góc đang ra tiền', moTa: 'góc nào đang kiếm hoa hồng', mac: [16, 28], tuDe: true, tab: 'social' },
  I4: { ten: 'Kênh và đo lường', moTa: 'việc gấp của kênh social + máy đo', mac: [16, 28], tuDe: true, tab: 'social' },
  I5: { ten: 'Thành phố hệ sinh thái', moTa: 'cả hệ sinh thái dạng thành phố 3D — khối nặng, tự tải khi mở', mac: [48, 72], tab: 'social' },
  I6: { ten: 'Góc', moTa: 'góc theo tài sản · kho góc spy · dạng bài', mac: [24, 36], ghi: true, tab: 'social' },
  I7: { ten: 'Kế hoạch đăng góc', moTa: 'dạng × góc × sản phẩm', mac: [24, 36], ghi: true, tab: 'social' },
  I8: { ten: 'Lô sản xuất', moTa: 'video đang chờ / đang làm theo lô', mac: [16, 36], tab: 'social' },
  I9: { ten: 'Bảng kênh social', moTa: 'kênh theo nền, lọc + gộp theo nền / góc', mac: [32, 40], tab: 'social' },
  I10: { ten: 'Lịch đăng', moTa: 'đã đăng + sẽ đăng: bảng nội dung · tuần · tháng · lưới giờ', mac: [32, 36], tab: 'social' },
  I11: { ten: 'Landing', moTa: 'bảng landing của các kênh', mac: [20, 36], tab: 'social' },
  I12: { ten: 'Khách trực tiếp', moTa: 'ai đang trên site aff + bảng trang đích', mac: [28, 48], tab: 'social' },
  I13: { ten: 'Sổ tiền social', moTa: 'cửa bán + tiền theo nguồn', mac: [20, 36], tab: 'social' },
  K1: { ten: 'Số máy đăng', moTa: 'đang đăng · đã đăng · lỗi · kho cạn · dừng theo luật (3 ngày)', mac: [48, 9], tuDe: true, tab: 'maydang' },
  K2: { ten: 'Lượt đăng', moTa: 'mỗi lượt máy đăng một dòng, 7 bước thành 7 cột; thử lại / bỏ / ghi chú', mac: [32, 40], ghi: true, tab: 'maydang' },
  K3: { ten: 'Lỗi hay gặp', moTa: 'lỗi máy đăng gom theo bước dừng × khâu kẹt × nhóm lý do', mac: [16, 24], tab: 'maydang' },
  K4: { ten: 'Bật / tắt máy đăng', moTa: 'trạng thái từng máy, cho nền nghỉ, kế hoạch hôm nay', mac: [16, 24], ghi: true, tab: 'maydang' },
  K5: { ten: 'Đang sản xuất', moTa: 'việc sản xuất của mọi nguồn, lỗi lên đầu', mac: [24, 28], tuDe: true, tab: 'maysx' },
  K6: { ten: 'Lượt đã dựng', moTa: 'lượt dựng 1 / 7 / 30 ngày, tiền thật, lỗi', mac: [24, 28], tuDe: true, tab: 'maysx' },
  K7: { ten: 'Lịch máy đăng', moTa: 'lịch đăng lọc theo dự án, kênh, nền, tài khoản', mac: [32, 36], tab: 'maydang' },
  L1: { ten: 'Thư viện', moTa: 'thiết kế (mẫu + ảnh) và các trang Library: công cụ, kiến thức, catalog, offers, nền tảng, công nghệ', mac: [48, 60], tab: 'thuvien' },
  L2: { ten: 'Lối tắt', moTa: 'Luật campaign · Strategy Tests · Keyword Research · Lịch doanh thu', mac: [16, 20], tab: 'luat' },
} as const satisfies Record<string, WidgetSo>;
export type MaWidget = keyof typeof WIDGET;
export const widgetCua = (ma: string): WidgetSo | undefined => (WIDGET as Record<string, WidgetSo>)[ma];
export const coWidget = (ma: string) => Object.prototype.hasOwnProperty.call(WIDGET, ma);
export const macCua = (ma: string): [number, number] => widgetCua(ma)?.mac ?? [16, 24];
export const nhomCua = (ma: string) => ma.replace(/\d+$/, '') as NhomWidget;

/** ô dựng sẵn theo lưới mịn 48 × 72: [mã, x, y, rộng, cao] */
type OTho = [MaWidget, number, number, number, number];
const o = (ds: OTho[]): O[] => ds.map(([ma, x, y, w, h]) => ({ ma, x, y, w, h }));
export type Man = { id: string; ten: string; kh: string; nhom: string; o: O[] };
export const MAN: Man[] = [
  { id: 'sang', ten: 'Sáng nay', kh: 'SN', nhom: 'Toàn cảnh', o: o([['A1', 0, 0, 48, 10], ['A2', 0, 10, 14, 26], ['C1', 14, 10, 34, 26], ['I1', 0, 36, 14, 36], ['H1', 14, 36, 34, 13], ['K1', 14, 49, 34, 9], ['K5', 14, 58, 34, 14]]) },
  { id: 'camp', ten: 'Campaign', kh: 'CP', nhom: 'Campaign và tiền', o: o([['A1', 0, 0, 48, 10], ['A2', 0, 10, 12, 62], ['B1', 12, 10, 36, 62]]) },
  { id: 'hatang', ten: 'Hạ tầng phủ', kh: 'HT', nhom: 'Campaign và tiền', o: o([['B2', 0, 0, 24, 36], ['B3', 24, 0, 24, 36], ['B4', 0, 36, 24, 36], ['B5', 24, 36, 24, 36]]) },
  { id: 'tien', ten: 'Tiền', kh: 'TI', nhom: 'Campaign và tiền', o: o([['C1', 0, 0, 32, 36], ['C3', 32, 0, 16, 36], ['C2', 0, 36, 24, 24], ['C4', 24, 36, 24, 24], ['C5', 0, 60, 48, 12]]) },
  { id: 'etp', ten: 'Ethopex vận hành', kh: 'EV', nhom: 'Ethopex', o: o([['H1', 0, 0, 48, 13], ['H2', 0, 13, 32, 59], ['H3', 32, 13, 16, 30], ['H6', 32, 43, 16, 29]]) },
  { id: 'etp2', ten: 'Ethopex phân tích', kh: 'EP', nhom: 'Ethopex', o: o([['H4', 0, 0, 24, 36], ['H5', 24, 0, 24, 36], ['H7', 0, 36, 24, 36], ['H8', 24, 36, 24, 36]]) },
  { id: 'social', ten: 'Social toàn cảnh', kh: 'SO', nhom: 'Social', o: o([['I2', 0, 0, 16, 28], ['I4', 16, 0, 16, 28], ['I3', 32, 0, 16, 28], ['I1', 0, 28, 16, 44], ['I9', 16, 28, 32, 44]]) },
  { id: 'pho', ten: 'Thành phố', kh: 'TP', nhom: 'Social', o: o([['I5', 0, 0, 48, 72]]) },
  { id: 'sxdang', ten: 'Sản xuất và đăng', kh: 'SX', nhom: 'Social', o: o([['I6', 0, 0, 24, 36], ['I7', 24, 0, 24, 36], ['I8', 0, 36, 48, 36]]) },
  { id: 'lich', ten: 'Lịch đăng', kh: 'LD', nhom: 'Social', o: o([['I10', 0, 0, 48, 36], ['K7', 0, 36, 48, 36]]) },
  { id: 'khach', ten: 'Khách trên trang', kh: 'KH', nhom: 'Social', o: o([['I12', 0, 0, 28, 72], ['I11', 28, 0, 20, 36], ['I13', 28, 36, 20, 36]]) },
  { id: 'may', ten: 'Máy', kh: 'MA', nhom: 'Máy', o: o([['K1', 0, 0, 48, 9], ['K2', 0, 9, 32, 37], ['K3', 32, 9, 16, 20], ['K4', 32, 29, 16, 17], ['K5', 0, 46, 24, 26], ['K6', 24, 46, 24, 26]]) },
  { id: 'taisan', ten: 'Tài sản', kh: 'TS', nhom: 'Tài sản', o: o([['D1', 0, 0, 48, 10], ['D2', 0, 10, 28, 62], ['D3', 28, 10, 20, 62]]) },
  { id: 'kenh', ten: 'Kênh nội dung', kh: 'KN', nhom: 'Tài sản', o: o([['D6', 0, 0, 28, 72], ['D4', 28, 0, 20, 36], ['D5', 28, 36, 20, 36]]) },
  { id: 'seo', ten: 'SEO', kh: 'SE', nhom: 'Tài sản', o: o([['D2', 0, 0, 48, 36], ['E1', 0, 36, 28, 36], ['E2', 28, 36, 20, 36]]) },
  { id: 'email', ten: 'Email', kh: 'EM', nhom: 'Tài sản', o: o([['F1', 0, 0, 20, 72], ['F2', 20, 0, 28, 72]]) },
  { id: 'congcu', ten: 'Dự án và công cụ', kh: 'CC', nhom: 'Công cụ', o: o([['G1', 0, 0, 32, 40], ['C5', 32, 0, 16, 20], ['L2', 32, 20, 16, 20], ['L1', 0, 40, 48, 32]]) },
  { id: 'mt5', ten: 'Lệnh MT5', kh: 'MT', nhom: 'Công cụ', o: o([['C6', 0, 0, 48, 72]]) },
];
export const MAN_MAC_DINH = 'sang';
export const manCua = (id: string | undefined): Man => MAN.find((m) => m.id === id) ?? MAN.find((m) => m.id === MAN_MAC_DINH)!;

/** khung xếp sẵn (lưới 12 × 18): [x, y, rộng, cao] từng ô */
export const KHUNG: { ten: string; o: number[][] }[] = [
  { ten: 'Một ô lớn', o: [[0, 0, 12, 18]] },
  { ten: 'Dải số + một ô', o: [[0, 0, 12, 3], [0, 3, 12, 15]] },
  { ten: 'Dải số + hai cột', o: [[0, 0, 12, 3], [0, 3, 6, 15], [6, 3, 6, 15]] },
  { ten: 'Trái lớn + cột phải', o: [[0, 0, 8, 18], [8, 0, 4, 9], [8, 9, 4, 9]] },
  { ten: 'Lưới 2 × 2', o: [[0, 0, 6, 9], [6, 0, 6, 9], [0, 9, 6, 9], [6, 9, 6, 9]] },
  { ten: 'Ba cột', o: [[0, 0, 4, 18], [4, 0, 4, 18], [8, 0, 4, 18]] },
];

/** tuỳ chọn khung của từng người — cookie `home-khung` (máy chủ đọc để lần vẽ đầu đã đúng, không nháy) */
export const KHUNG_COOKIE = 'home-khung';
export type TuyChon = { nav: 'rong' | 'hep' | 'an'; pn: 'rong' | 'an'; hd: boolean; ft: boolean; doi: boolean; re: boolean; luoi: 12 | 24 | 48 | 0; cham: 'de' | 'day' | 'chan'; lm: 0 | 30 | 60 | 300 };
export const TUY_CHON_MAC: TuyChon = { nav: 'rong', pn: 'an', hd: true, ft: true, doi: false, re: true, luoi: 12, cham: 'de', lm: 0 };
export function docTuyChon(raw: string | undefined): TuyChon {
  try {
    const v = JSON.parse(decodeURIComponent(raw ?? '')) as Partial<TuyChon>, m = TUY_CHON_MAC;
    return {
      nav: v.nav === 'hep' || v.nav === 'an' ? v.nav : m.nav, pn: v.pn === 'rong' ? 'rong' : m.pn,
      hd: v.hd !== false, ft: v.ft !== false, doi: v.doi === true, re: v.re !== false,
      luoi: v.luoi === 24 || v.luoi === 48 || v.luoi === 0 ? v.luoi : 12, cham: v.cham === 'day' || v.cham === 'chan' ? v.cham : 'de',
      lm: v.lm === 30 || v.lm === 60 || v.lm === 300 ? v.lm : 0,
    };
  } catch { return TUY_CHON_MAC; }
}
