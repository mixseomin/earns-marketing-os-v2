// SỔ WIDGET + MÀN của /home — MỘT nguồn cho: kho widget (panel phải, bảng tìm), bố cục dựng sẵn từng màn, kiểm bố cục khi lưu (máy chủ), thanh màn bên trái.
// File THƯỜNG (không 'use client'): server page + client component cùng import được giá trị thật.
// Thêm widget = một mục WIDGET ở đây + một hàm vẽ cùng mã trong components/home/ve.tsx (kiểu Record<MaWidget, …> bắt thiếu lúc kiểm kiểu;
// scripts/check-home-widget.mjs đối chiếu với sổ tab trang chủ: tab nào của `/` không có widget nào nhận là đỏ).
// Cỡ tính theo lưới mịn 48 × 72 (lib/home/luoi.ts): một ô của lưới 12×18 = 4 × 4.
import type { O } from './luoi';

export type NhomWidget = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'K' | 'L' | 'M';
export const NHOM: Record<NhomWidget, string> = { A: 'Toàn cảnh', B: 'Campaign phủ', C: 'Tiền', D: 'Tài sản và kênh', E: 'SEO', F: 'Email', G: 'Dự án', H: 'Ethopex', I: 'Social Traffic', K: 'Máy', L: 'Thư viện', M: 'Agents công ty AI' };
/** ngu: tham số ngữ cảnh widget đọc (thanh đầu trang chỉ hiện bộ chọn mà màn đang mở cần) · tuDe: ruột đã có tiêu đề riêng → khung không vẽ thêm thanh tiêu đề lúc xem ·
 *  ghi: có nút ghi dữ liệu · tab: tab của trang chủ cũ mà widget này thay (sổ lib/tab-trang.ts) ·
 *  rong: ruột là BẢNG RỘNG nhiều cột — bố cục dựng sẵn phải cho nó ô rộng ≥ RONG_BANG cột (anh 20/11/2026: bảng cũ cho vào ô hẹp "bị kẹp kích thước");
 *  nhiều bảng rộng cùng màn thì xếp thành tab trong MỘT ô trọn bề ngang, không chia đôi màn. scripts/check-home-widget.mjs chặn bố cục sai.
 *  nguon: 'cty' — widget KHÔNG thay tab nào của trang chủ cũ mà đọc DỮ LIỆU của cty.on.tc qua cổng /api/agents (lib/cty-agents.ts) rồi tự vẽ (components/agents/*).
 *  nguon: 'etp2' — widget Tổng quan 2 của etp2.on.tc, dùng chung MÃ VẼ etp2 qua alias @etp2/tong2 (components/home/etp2-o.tsx), không chép, không nhúng trang.
 *  CẤM nhúng nguyên trang app khác vào ô (anh 20/11/2026) — scripts/check-home-widget.mjs luật 6 chặn. Mỗi widget khai đúng một trong hai: tab hoặc nguon. */
export type WidgetSo = { ten: string; moTa: string; mac: [number, number]; ngu?: ('p' | 'days' | 'ky')[]; tuDe?: true; ghi?: true; rong?: true; tab?: string; nguon?: 'cty' | 'etp2';
  /** ngày giờ widget vào sổ (ISO) — bố cục đã lưu TRƯỚC mốc này mà thiếu widget thì lúc đọc tự chèn thành tab vào ô chứa widget cùng ô ở bố cục dựng sẵn (lib/home/bo-cuc.ts), không ghi đè bản lưu */
  moi?: string };
export const RONG_BANG = 32;
export const WIDGET = {
  A1: { ten: 'Dải số chính', moTa: 'doanh thu 30 ngày · chi QC · view → click → out · signup · camp chạy', mac: [48, 10], ngu: ['p', 'days'], tuDe: true, tab: 'camp' },
  A2: { ten: 'Cần chú ý', moTa: 'adapter hỏng · lander cũ · camp tới ngưỡng · sid lạ', mac: [16, 24], ngu: ['p', 'days'], tab: 'camp' },
  B1: { ten: 'Bảng campaign', moTa: 'phễu từng camp + phán xét; nhật ký, soi nguồn, nhập chi', mac: [48, 40], ngu: ['p', 'days'], tuDe: true, ghi: true, rong: true, tab: 'camp' },
  B2: { ten: 'Nền tảng phủ', moTa: 'trạng thái · chương trình · hoa hồng · đường thoát', mac: [48, 36], ngu: ['p', 'days'], tuDe: true, ghi: true, rong: true, tab: 'phu' },
  B3: { ten: 'Nguồn traffic', moTa: 'số dư · macro · trạng thái · nguồn định làm / đã bỏ', mac: [48, 36], ngu: ['p', 'days'], tuDe: true, ghi: true, rong: true, tab: 'nguon' },
  B4: { ten: 'Lander', moTa: 'host · lần sinh cuối · số mục', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, tab: 'hatang' },
  B5: { ten: 'Adapter', moTa: 'lịch chạy · lần chạy cuối · postback', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, tab: 'hatang' },
  C1: { ten: 'Lịch doanh thu', moTa: 'tiền từng ngày theo nguồn, 30 ngày gần nhất', mac: [32, 36], tab: 'doanhthu' },
  C2: { ten: 'Phễu offer affiliate', moTa: 'offer cities.gg · steamsolo', mac: [48, 24], tuDe: true, rong: true, tab: 'doanhthu' },
  C3: { ten: 'Awin theo ngày', moTa: 'dải số + hàng tồn Awin', mac: [16, 36], tuDe: true, tab: 'doanhthu' },
  C4: { ten: 'Phễu nhận biết cities.gg', moTa: 'dải số + bảng theo nước', mac: [24, 24], tuDe: true, tab: 'doanhthu' },
  C5: { ten: 'Chi AI', moTa: 'tiền mô hình hôm nay / 7 / 30 ngày', mac: [48, 12], tuDe: true, tab: 'duan' },
  C6: { ten: 'Lệnh MT5', moTa: 'lệnh sống theo strategy (strategy-lab) — khối nặng, nên để ở màn riêng', mac: [48, 60], rong: true, tab: 'lenh' },
  D1: { ten: 'Số tài sản', moTa: 'website · shop · đang bán · chờ duyệt · sẵn sàng · đang làm', mac: [48, 10], ngu: ['ky'], tuDe: true, tab: 'taisan' },
  D2: { ten: 'Bảng website', moTa: 'GSC · GA4 · Bing · Clarity · social trỏ về của mọi site', mac: [48, 40], ngu: ['ky'], tuDe: true, ghi: true, rong: true, tab: 'taisan' },
  D3: { ten: 'Shop → sản phẩm', moTa: 'cây shop, duyệt + đổi trạng thái sản phẩm', mac: [48, 40], ngu: ['ky'], ghi: true, rong: true, tab: 'taisan' },
  D4: { ten: 'Video ngắn', moTa: 'lượt xem 7 ngày theo nền và theo video', mac: [24, 32], ngu: ['ky'], tab: 'taisan' },
  D5: { ten: 'Ma trận kênh traffic', moTa: 'tựa × phương pháp kéo khách', mac: [24, 32], ngu: ['ky'], ghi: true, tab: 'taisan' },
  D6: { ten: 'Kênh nội dung', moTa: 'bảng kênh video, mở ra cây tập', mac: [48, 48], ngu: ['ky'], rong: true, tab: 'kenh' },
  E1: { ten: 'SEO một site', moTa: 'chọn site → GSC / Bing 30 ngày + truy vấn', mac: [28, 36], ghi: true, tab: 'seo' },
  E2: { ten: 'SteamSolo ngôn ngữ', moTa: 'số liệu theo ngôn ngữ + engagement', mac: [20, 36], tuDe: true, tab: 'seo' },
  F1: { ten: 'Danh sách MailWizz', moTa: 'dải số + bảng list ba tầng', mac: [20, 40], tuDe: true, tab: 'email' },
  F2: { ten: 'Domain gửi', moTa: 'SPF · DKIM · DMARC · inbox seed · uy tín Postmaster · spam-test; thêm domain, đo placement', mac: [48, 36], ghi: true, rong: true, tab: 'email' },
  F3: { ten: 'Lịch warm-up', moTa: 'lịch làm ấm từng domain đang gửi, bật / tắt tự làm ấm, soạn thư', mac: [28, 36], ghi: true, tab: 'email' },
  F4: { ten: 'Hòm seed', moTa: 'các hòm thư seed dùng để đo vào Inbox hay Spam', mac: [20, 24], ghi: true, tab: 'email' },
  F5: { ten: 'Engagement email', moTa: 'mở · bấm · huỷ theo tầng người nhận', mac: [20, 24], tab: 'email' },
  F6: { ten: 'Lịch gửi gộp', moTa: 'lịch gửi của mọi domain trên một bảng', mac: [28, 24], tab: 'email' },
  G1: { ten: 'Lưới dự án', moTa: 'thẻ dự án, lọc theo sức khoẻ / loại / chế độ', mac: [32, 40], tab: 'duan' },
  H1: { ten: 'Số Ethopex', moTa: 'camp bật · chi · lãi · ROI · đủ điều kiện tăng / giảm · ad bị từ chối', mac: [48, 13], tuDe: true, tab: 'ethopex' },
  H2: { ten: 'Camp Ethopex', moTa: 'bảng camp + luật đang chạm, lọc đang bật / đã tắt / chạm luật', mac: [48, 48], rong: true, tab: 'ethopex' },
  H3: { ten: 'Ethopex theo ngày', moTa: 'biểu đồ lãi từng ngày, lọc phim / camp / dạng / ngôn ngữ', mac: [24, 32], tab: 'ethopex' },
  H4: { ten: 'Thể loại × thứ', moTa: 'ROI từng thể loại phim theo thứ trong tuần', mac: [24, 32], tab: 'ethopex' },
  H5: { ten: 'Ethopex theo phim', moTa: 'số từng phim + đề xuất dạng creative', mac: [48, 32], rong: true, tab: 'ethopex' },
  H6: { ten: 'Phim chờ test', moTa: 'hàng chờ lên camp', mac: [16, 28], tab: 'ethopex' },
  H7: { ten: 'Lên test', moTa: 'mỗi ngày: camp mới · phim mới · còn bật / đã tắt · ROI lứa camp', mac: [24, 32], tab: 'ethopex' },
  H8: { ten: 'Sổ luật Ethopex', moTa: 'các luật đang áp cho camp', mac: [24, 32], tab: 'ethopex' },
  // H9–H19 — WIDGET TỔNG QUAN 2 CỦA etp2.on.tc (anh 26/11/2026 "thêm các widget mới giống widget của etp2"): mã vẽ + số dùng chung với etp2, mã etp2 ghi trong moTa
  H9: { ten: 'Nắm nhanh', moTa: 'lãi hôm qua · nhịp hôm nay so với cùng giờ hôm qua · người tụt mạnh nhất · tài khoản cần xem · luật nhịp tới (etp2)', mac: [48, 16], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H10: { ten: 'Người', moTa: 'từng người trong 7 ngày: chi, lãi, ROI ▲▼ so kỳ trước, camp bật, đường ROI (etp2)', mac: [20, 20], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H11: { ten: 'Nhà thua đội ở đâu', moTa: 'phim nhà và đội cùng chạy 7 ngày đã khép mà đội có ROI tốt hơn (etp2)', mac: [20, 16], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H12: { ten: 'Tài khoản QC', moTa: 'mỗi tài khoản một ô theo người: màu = ROI, viền đỏ = có cờ (etp2)', mac: [28, 32], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H13: { ten: 'Bản đồ giờ', moTa: 'ngày × giờ VN 14 ngày, màu = ROI giờ đó của nhà + đội (etp2)', mac: [48, 28], rong: true, nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H14: { ten: 'Luỹ kế hôm nay', moTa: 'lãi cộng dồn theo giờ: hôm nay so với hôm qua và TB 7 ngày (etp2)', mac: [24, 24], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H15: { ten: 'Luật máy', moTa: 'thẻ luật máy nhịp tới + việc máy đã làm theo từng luật (etp2)', mac: [20, 32], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H16: { ten: 'Phân bổ ngân sách', moTa: 'ngân sách camp đang bật so với trần ngày, từng nhóm so với mục tiêu (etp2)', mac: [48, 32], rong: true, nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H17: { ten: 'Thị trường', moTa: 'CPM / CPC / ROI từng ngày Ethopex — lịch nhiệt tháng + dự đoán (etp2)', mac: [48, 48], rong: true, nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H18: { ten: 'Phim mới', moTa: 'phim nhà theo tuần bắt đầu chạy: thử · đủ thử · thắng · tiền thử / phim thắng (etp2)', mac: [28, 48], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  H19: { ten: 'Thành phố phim', moTa: 'mỗi phim nhà đang chạy = một toà 3D, cửa sổ = camp — khối nặng, tự tải khi mở (etp2)', mac: [32, 64], nguon: 'etp2', moi: '2026-11-26T05:00:00Z' },
  I1: { ten: 'Sức khoẻ đăng', moTa: 'máy đăng có đều không, lỡ lượt nào', mac: [16, 36], tab: 'social' },
  I2: { ten: 'Phễu social', moTa: 'lượt xem → về site → sang shop → đơn', mac: [16, 28], tuDe: true, tab: 'social' },
  I3: { ten: 'Góc đang ra tiền', moTa: 'góc nào đang kiếm hoa hồng', mac: [16, 28], tuDe: true, tab: 'social' },
  I4: { ten: 'Kênh và đo lường', moTa: 'việc gấp của kênh social + máy đo', mac: [16, 28], tuDe: true, tab: 'social' },
  I5: { ten: 'Thành phố hệ sinh thái', moTa: 'cả hệ sinh thái dạng thành phố 3D — khối nặng, tự tải khi mở', mac: [48, 72], tab: 'social' },
  I6: { ten: 'Góc', moTa: 'góc theo tài sản · kho góc spy · dạng bài', mac: [48, 36], ghi: true, rong: true, tab: 'social' },
  I7: { ten: 'Kế hoạch đăng góc', moTa: 'dạng × góc × sản phẩm', mac: [48, 36], ghi: true, rong: true, tab: 'social' },
  I8: { ten: 'Lô sản xuất', moTa: 'video đang chờ / đang làm theo lô', mac: [16, 36], tab: 'social' },
  I9: { ten: 'Bảng kênh social', moTa: 'kênh theo nền, lọc + gộp theo nền / góc', mac: [48, 40], rong: true, tab: 'social' },
  I10: { ten: 'Lịch đăng', moTa: 'đã đăng + sẽ đăng: bảng nội dung · tuần · tháng · lưới giờ', mac: [48, 36], rong: true, tab: 'social' },
  I11: { ten: 'Landing', moTa: 'bảng landing của các kênh', mac: [48, 36], rong: true, tab: 'social' },
  I12: { ten: 'Khách trực tiếp', moTa: 'ai đang trên site aff + bảng trang đích', mac: [48, 48], rong: true, tab: 'social' },
  I13: { ten: 'Sổ tiền social', moTa: 'cửa bán + tiền theo nguồn', mac: [20, 36], tab: 'social' },
  K1: { ten: 'Số máy đăng', moTa: 'đang đăng · đã đăng · lỗi · kho cạn · dừng theo luật (3 ngày)', mac: [48, 9], tuDe: true, tab: 'maydang' },
  K2: { ten: 'Lượt đăng', moTa: 'mỗi lượt máy đăng một dòng, 7 bước thành 7 cột; thử lại / bỏ / ghi chú', mac: [48, 40], ghi: true, rong: true, tab: 'maydang' },
  K3: { ten: 'Lỗi hay gặp', moTa: 'lỗi máy đăng gom theo bước dừng × khâu kẹt × nhóm lý do', mac: [48, 24], rong: true, tab: 'maydang' },
  K4: { ten: 'Bật / tắt máy đăng', moTa: 'trạng thái từng máy, cho nền nghỉ, kế hoạch hôm nay', mac: [16, 24], ghi: true, tab: 'maydang' },
  K5: { ten: 'Đang sản xuất', moTa: 'việc sản xuất của mọi nguồn, lỗi lên đầu', mac: [48, 28], tuDe: true, rong: true, tab: 'maysx' },
  K6: { ten: 'Lượt đã dựng', moTa: 'lượt dựng 1 / 7 / 30 ngày, tiền thật, lỗi', mac: [48, 28], tuDe: true, rong: true, tab: 'maysx' },
  K7: { ten: 'Lịch máy đăng', moTa: 'lịch đăng lọc theo dự án, kênh, nền, tài khoản', mac: [48, 36], rong: true, tab: 'maydang' },
  L1: { ten: 'Thư viện', moTa: 'thiết kế (mẫu + ảnh) và các trang Library: công cụ, kiến thức, catalog, offers, nền tảng, công nghệ', mac: [48, 60], rong: true, tab: 'thuvien' },
  // M — AGENTS của công ty AI (anh 20/11/2026 "thêm 1 layout + widgets mới để quản lý các agents trong cty.on.tc"): dữ liệu cty, MOS2 tự vẽ (components/agents/*)
  M1: { ten: 'Số agents', moTa: 'nhân sự · đang làm · kẹt · rảnh · tắt · việc máy bật / lỗi · chi API tháng · phiên CLI hôm nay', mac: [48, 9], tuDe: true, nguon: 'cty' },
  M2: { ten: 'Bảng agents', moTa: 'bật / tắt tự làm · đổi mô hình · chỉnh ca và lịch · trạng thái thật · chi; kèm so sánh bộ não và đề xuất', mac: [48, 40], ghi: true, rong: true, nguon: 'cty' },
  M3: { ten: 'Việc máy và việc nền', moTa: 'timer, cron trên box3 / box1 + sổ bộ điều phối Mac: bật / tắt, đổi lịch, lần cuối, lỗi', mac: [48, 36], ghi: true, rong: true, nguon: 'cty' },
  M4: { ten: 'Lượt chạy kỹ sư', moTa: 'mọi phiên Claude Code của kỹ sư CLI: việc · kết · token vào / ra · chi phí', mac: [48, 32], rong: true, nguon: 'cty' },
  M5: { ten: 'Sổ sự kiện cty', moTa: 'ai gọi mô hình gì, gửi tin cho ai, quyết định, lỗi — lọc theo lượt / người / loại', mac: [48, 32], rong: true, nguon: 'cty' },
  M6: { ten: 'Sơ đồ tổ chức', moTa: 'cây phòng ban và nhân sự, bấm vào người hoặc phòng để mở hồ sơ', mac: [48, 40], nguon: 'cty' },
  M7: { ten: 'Việc theo phòng', moTa: 'mỗi phòng một dòng: người đang làm / kẹt / rảnh / tắt · lượt kỹ sư đã sửa / không sửa / cần anh · việc máy bật / tắt / lỗi', mac: [48, 28], rong: true, nguon: 'cty', moi: '2026-11-23T07:00:00Z' },
  L2: { ten: 'Lối tắt', moTa: 'Luật campaign · Strategy Tests · Keyword Research · Lịch doanh thu', mac: [16, 20], tab: 'luat' },
} as const satisfies Record<string, WidgetSo>;
export type MaWidget = keyof typeof WIDGET;
export const widgetCua = (ma: string): WidgetSo | undefined => (WIDGET as Record<string, WidgetSo>)[ma];
export const coWidget = (ma: string) => Object.prototype.hasOwnProperty.call(WIDGET, ma);
export const macCua = (ma: string): [number, number] => widgetCua(ma)?.mac ?? [16, 24];
export const nhomCua = (ma: string) => ma.replace(/\d+$/, '') as NhomWidget;

/** ô dựng sẵn theo lưới mịn 48 × 72: [mã, x, y, rộng, cao, (các widget xếp thành tab cùng ô)] — widget đầu là tab đang mở */
type OTho = [MaWidget, number, number, number, number, MaWidget[]?];
// góp ý #1731: bố cục mặc định luôn BẮT vào lưới thô 12×18 (bước 4 ô mịn) — làm tròn từng CẠNH (không làm tròn cỡ) nên hai ô chung cạnh vẫn khít nhau
const BUOC_MAC = 4, bat = (v: number) => Math.round(v / BUOC_MAC) * BUOC_MAC;
const o = (ds: OTho[]): O[] => ds.map(([ma, x0, y0, w0, h0, tabs]) => {
  const x = bat(x0), y = bat(y0), w = bat(x0 + w0) - x, h = bat(y0 + h0) - y;
  return tabs?.length ? { ma, x, y, w, h, tabs: [ma, ...tabs] } : { ma, x, y, w, h };
});
export type Man = { id: string; ten: string; kh: string; nhom: string; o: O[] };
// NGUYÊN TẮC XẾP (anh 20/11/2026): bảng rộng (rong) trọn bề ngang; bảng phụ đi kèm thành TAB trong cùng ô; dải số một hàng mỏng trên cùng; ô hẹp chỉ dành cho danh sách / thẻ số.
export const MAN: Man[] = [
  // không đặt dải số Ethopex ở màn mở đầu: nó kéo theo lần đọc Ethopex ~35 giây khi bộ nhớ đệm 60 giây đã hết
  { id: 'sang', ten: 'Sáng nay', kh: 'SN', nhom: 'Toàn cảnh', o: o([['A1', 0, 0, 48, 10], ['A2', 0, 10, 14, 26], ['C1', 14, 10, 34, 26], ['I1', 0, 36, 14, 36], ['K1', 14, 36, 34, 10], ['K5', 14, 46, 34, 26]]) },
  { id: 'camp', ten: 'Campaign', kh: 'CP', nhom: 'Campaign và tiền', o: o([['A1', 0, 0, 48, 10], ['A2', 0, 10, 10, 62], ['B1', 10, 10, 38, 62]]) },
  { id: 'hatang', ten: 'Hạ tầng phủ', kh: 'HT', nhom: 'Campaign và tiền', o: o([['B2', 0, 0, 48, 40, ['B3']], ['B4', 0, 40, 24, 32], ['B5', 24, 40, 24, 32]]) },
  { id: 'tien', ten: 'Tiền', kh: 'TI', nhom: 'Campaign và tiền', o: o([['C1', 0, 0, 32, 34], ['C3', 32, 0, 16, 34], ['C2', 0, 34, 48, 26, ['C4']], ['C5', 0, 60, 48, 12]]) },
  // TỔNG QUAN Ethopex (anh 26/11/2026 "tạo 1 page trên group Ethopex là Tổng quan"): theo template "Sáng nay" của etp2, widget còn lại xếp thành tab
  { id: 'etptq', ten: 'Tổng quan', kh: 'TQ', nhom: 'Ethopex', o: o([['H9', 0, 0, 48, 16], ['H10', 0, 16, 20, 28, ['H11', 'H15']], ['H12', 20, 16, 28, 28, ['H14', 'H18']], ['H13', 0, 44, 48, 28, ['H16', 'H17', 'H19', 'H3']]]) },
  { id: 'etp', ten: 'Ethopex vận hành', kh: 'EV', nhom: 'Ethopex', o: o([['H1', 0, 0, 48, 13], ['H2', 0, 13, 48, 59, ['H3', 'H6']]]) },
  { id: 'etp2', ten: 'Ethopex phân tích', kh: 'EP', nhom: 'Ethopex', o: o([['H5', 0, 0, 48, 38, ['H7']], ['H4', 0, 38, 28, 34], ['H8', 28, 38, 20, 34]]) },
  { id: 'social', ten: 'Social toàn cảnh', kh: 'SO', nhom: 'Social', o: o([['I2', 0, 0, 16, 26], ['I4', 16, 0, 16, 26], ['I3', 32, 0, 16, 26], ['I9', 0, 26, 48, 46, ['I1']]]) },
  { id: 'pho', ten: 'Thành phố', kh: 'TP', nhom: 'Social', o: o([['I5', 0, 0, 48, 72]]) },
  { id: 'sxdang', ten: 'Sản xuất và đăng', kh: 'SX', nhom: 'Social', o: o([['I6', 0, 0, 48, 44, ['I7']], ['I8', 0, 44, 48, 28]]) },
  { id: 'lich', ten: 'Lịch đăng', kh: 'LD', nhom: 'Social', o: o([['I10', 0, 0, 48, 72, ['K7']]]) },
  { id: 'khach', ten: 'Khách trên trang', kh: 'KH', nhom: 'Social', o: o([['I12', 0, 0, 48, 42], ['I11', 0, 42, 48, 30, ['I13']]]) },
  { id: 'may', ten: 'Máy', kh: 'MA', nhom: 'Máy', o: o([['K1', 0, 0, 48, 9], ['K2', 0, 9, 48, 37, ['K3', 'K4']], ['K5', 0, 46, 48, 26, ['K6']]]) },
  { id: 'agents', ten: 'Agents', kh: 'AG', nhom: 'Công ty AI', o: o([['M1', 0, 0, 48, 9], ['M2', 0, 9, 48, 36, ['M3', 'M6']], ['M7', 0, 45, 48, 27, ['M4', 'M5']]]) },
  { id: 'taisan', ten: 'Tài sản', kh: 'TS', nhom: 'Tài sản', o: o([['D1', 0, 0, 48, 10], ['D2', 0, 10, 48, 62, ['D3']]]) },
  { id: 'kenh', ten: 'Kênh nội dung', kh: 'KN', nhom: 'Tài sản', o: o([['D6', 0, 0, 48, 44], ['D4', 0, 44, 24, 28], ['D5', 24, 44, 24, 28]]) },
  { id: 'seo', ten: 'SEO', kh: 'SE', nhom: 'Tài sản', o: o([['E1', 0, 0, 28, 72], ['E2', 28, 0, 20, 72]]) },   // bảng website (D2) nặng ~1,3 MB nên nằm ở màn Tài sản, không kéo sang đây
  { id: 'email', ten: 'Email', kh: 'EM', nhom: 'Tài sản', o: o([['F2', 0, 0, 48, 36, ['F3', 'F6']], ['F1', 0, 36, 28, 36], ['F4', 28, 36, 20, 18], ['F5', 28, 54, 20, 18]]) },
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
