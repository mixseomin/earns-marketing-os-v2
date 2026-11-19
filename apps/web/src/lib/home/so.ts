// SỔ WIDGET + MÀN của /home — MỘT nguồn cho: kho widget (panel phải, bảng tìm), bố cục dựng sẵn từng màn, kiểm bố cục khi lưu (máy chủ), thanh màn bên trái.
// File THƯỜNG (không 'use client'): server page + client component cùng import được giá trị thật.
// Thêm widget = một mục WIDGET ở đây + một hàm vẽ cùng mã trong components/home/ve.tsx (scripts/check-home-widget.mjs đối chiếu hai bên + sổ tab trang chủ).
// Cỡ tính theo lưới mịn 48 × 72 (lib/home/luoi.ts): một ô của lưới 12×18 = 4 × 4.
import type { O } from './luoi';

export type NhomWidget = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'K' | 'L';
export const NHOM: Record<NhomWidget, string> = { A: 'Toàn cảnh', B: 'Campaign phủ', C: 'Tiền', D: 'Tài sản và kênh', E: 'SEO', F: 'Email', G: 'Dự án', H: 'Ethopex', I: 'Social Traffic', K: 'Máy', L: 'Thư viện' };
/** ngu: tham số ngữ cảnh widget đọc (thanh đầu trang chỉ hiện bộ chọn mà màn đang mở cần) · tuDe: ruột đã có tiêu đề riêng → khung không vẽ thêm thanh tiêu đề lúc xem · ghi: có nút ghi dữ liệu */
export type WidgetSo = { ten: string; moTa: string; mac: [number, number]; ngu?: ('p' | 'days' | 'ky')[]; tuDe?: true; ghi?: true; tab: string };
export const WIDGET = {
  A1: { ten: 'Dải số chính', moTa: 'doanh thu 30 ngày · chi QC · view → click → out · signup · camp chạy', mac: [48, 10], ngu: ['p', 'days'], tuDe: true, tab: 'camp' },
  A2: { ten: 'Cần chú ý', moTa: 'adapter hỏng · lander cũ · camp tới ngưỡng · sid lạ', mac: [16, 24], ngu: ['p', 'days'], tab: 'camp' },
  B1: { ten: 'Bảng campaign', moTa: 'phễu từng camp + phán xét; nhật ký, soi nguồn, nhập chi', mac: [36, 40], ngu: ['p', 'days'], tuDe: true, ghi: true, tab: 'camp' },
  B2: { ten: 'Nền tảng phủ', moTa: 'trạng thái · chương trình · hoa hồng · đường thoát', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, ghi: true, tab: 'phu' },
  B3: { ten: 'Nguồn traffic', moTa: 'số dư · macro · trạng thái · nguồn định làm / đã bỏ', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, ghi: true, tab: 'nguon' },
  B4: { ten: 'Lander', moTa: 'host · lần sinh cuối · số mục', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, tab: 'hatang' },
  B5: { ten: 'Adapter', moTa: 'lịch chạy · lần chạy cuối · postback', mac: [24, 36], ngu: ['p', 'days'], tuDe: true, tab: 'hatang' },
  C1: { ten: 'Lịch doanh thu', moTa: 'tiền từng ngày theo nguồn, 30 ngày gần nhất', mac: [32, 40], tab: 'doanhthu' },
  C2: { ten: 'Phễu offer affiliate', moTa: 'offer cities.gg · steamsolo', mac: [16, 32], tuDe: true, tab: 'doanhthu' },
  C3: { ten: 'Awin theo ngày', moTa: 'dải số + hàng tồn Awin', mac: [16, 32], tuDe: true, tab: 'doanhthu' },
  C4: { ten: 'Phễu nhận biết cities.gg', moTa: 'dải số + bảng theo nước', mac: [16, 32], tuDe: true, tab: 'doanhthu' },
  C5: { ten: 'Chi AI', moTa: 'tiền mô hình hôm nay / 7 / 30 ngày', mac: [16, 20], tuDe: true, tab: 'duan' },
  C6: { ten: 'Lệnh MT5', moTa: 'lệnh sống theo strategy (strategy-lab)', mac: [32, 32], tab: 'lenh' },
} as const satisfies Record<string, WidgetSo>;
export type MaWidget = keyof typeof WIDGET;
export const widgetCua = (ma: string): WidgetSo | undefined => (WIDGET as Record<string, WidgetSo>)[ma];
export const coWidget = (ma: string) => Object.prototype.hasOwnProperty.call(WIDGET, ma);
export const macCua = (ma: string): [number, number] => widgetCua(ma)?.mac ?? [16, 24];
export const nhomCua = (ma: string) => ma.replace(/\d+$/, '') as NhomWidget;

/** ô dựng sẵn viết theo lưới 12 × 18 cho dễ đọc: [mã, x, y, rộng, cao] */
type OThô = [MaWidget, number, number, number, number];
const o = (ds: OThô[]): O[] => ds.map(([ma, x, y, w, h]) => ({ ma, x: x * 4, y: y * 4, w: w * 4, h: h * 4 }));
export type Man = { id: string; ten: string; kh: string; nhom: string; o: O[] };
export const MAN: Man[] = [
  { id: 'sang', ten: 'Sáng nay', kh: 'SN', nhom: 'Toàn cảnh', o: o([['A1', 0, 0, 12, 3], ['A2', 0, 3, 4, 7], ['C1', 4, 3, 8, 7], ['B1', 0, 10, 12, 8]]) },
  { id: 'camp', ten: 'Campaign', kh: 'CP', nhom: 'Campaign và tiền', o: o([['A1', 0, 0, 12, 3], ['A2', 0, 3, 3, 15], ['B1', 3, 3, 9, 15]]) },
  { id: 'hatang', ten: 'Hạ tầng phủ', kh: 'HT', nhom: 'Campaign và tiền', o: o([['B2', 0, 0, 6, 9], ['B3', 6, 0, 6, 9], ['B4', 0, 9, 6, 9], ['B5', 6, 9, 6, 9]]) },
  { id: 'tien', ten: 'Tiền', kh: 'TI', nhom: 'Campaign và tiền', o: o([['C1', 0, 0, 8, 10], ['C5', 8, 0, 4, 5], ['C6', 8, 5, 4, 5], ['C2', 0, 10, 4, 8], ['C3', 4, 10, 4, 8], ['C4', 8, 10, 4, 8]]) },
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
