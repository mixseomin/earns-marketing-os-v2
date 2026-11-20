// SỔ WIDGET + MÀN của outreach.on.tc (đường /outreach) — cùng khuôn với sổ /home (lib/home/so.ts) và chạy trên cùng khung trang (components/home/trang.tsx).
// File THƯỜNG (không 'use client'). Thêm widget = một mục WIDGET ở đây + một hàm vẽ cùng mã trong components/outreach-tong/ve.tsx
// (kiểu Record<MaWidgetOb, …> bắt thiếu lúc kiểm kiểu). Bố cục dựng sẵn được bài tự kiểm so.test.mts soát: mã có thật, không lặp, trong lưới 48 × 72, không đè nhau.
// Mã màn có tiền tố "ob-" vì bố cục lưu chung bảng home_bo_cuc (khoá user_id + man) với /home.
import type { O } from '../home/luoi';
import type { BoSoWidget, BoSoMan } from '../luoi-trang/bo-so';

export const NHOM_OB = { T: 'Toàn cảnh', C: 'Chiến dịch', N: 'Người nhận', K: 'Kiểu và nguồn', H: 'Hạ tầng gửi' } as const;
export const WIDGET_OB = {
  T1: { ten: 'Dải số outreach', moTa: 'chiến dịch đang chạy · người nhận · đã gửi · trả lời · thắng · chờ gửi · tới hạn nhắc', mac: [48, 10], ngu: ['da'], tuDe: true },
  T2: { ten: 'Cần xử', moTa: 'trả lời chưa xử · tới hạn nhắc · chiến dịch bật tự gửi mà đứng · chiến dịch thiếu người gửi', mac: [16, 30], ngu: ['da'] },
  C1: { ten: 'Bảng chiến dịch', moTa: 'mọi chiến dịch của mọi dự án: kiểu · tự gửi · trần ngày · phễu · lần gửi cuối', mac: [48, 36], ngu: ['da'], rong: true },
  C2: { ten: 'Phễu theo kiểu', moTa: 'từng kiểu outreach: chờ gửi → đã gửi → trả lời → thắng', mac: [24, 26], ngu: ['da'] },
  N1: { ten: 'Bảng người nhận', moTa: 'người nhận của mọi dự án, tìm + lọc + sắp', mac: [48, 46], ngu: ['da'], rong: true },
  N2: { ten: 'Hàng chờ gửi', moTa: 'thư đầu chưa gửi + thư nhắc tới hạn, theo chiến dịch, so với trần ngày', mac: [24, 26], ngu: ['da'] },
  N3: { ten: 'Trả lời', moTa: 'người đã trả lời / quan tâm, mới nhất trước', mac: [24, 26], ngu: ['da'] },
  K1: { ten: 'Sổ kiểu outreach', moTa: 'các kiểu: gửi cho ai, tính thắng là gì, nguồn nào hợp, đang có bao nhiêu chiến dịch', mac: [24, 36] },
  K2: { ten: 'Nguồn người nhận', moTa: 'người nhận tới từ đâu, nguồn nào đã nối máy nạp', mac: [24, 36] },
  H1: { ten: 'Đường gửi', moTa: 'người gửi của từng chiến dịch, lần gửi cuối, thư đang kẹt', mac: [48, 22], rong: true },
  H2: { ten: 'Domain gửi', moTa: 'SPF · DKIM · DMARC · uy tín · spam-test của các domain gửi thư', mac: [48, 36], ghi: true, rong: true },
  H3: { ten: 'Lịch warm-up', moTa: 'lịch làm ấm từng domain đang gửi', mac: [28, 36], ghi: true },
  H4: { ten: 'Hòm seed', moTa: 'các hòm thư seed dùng để đo vào Inbox hay Spam', mac: [20, 24], ghi: true },
} as const satisfies Record<string, BoSoWidget>;
export type MaWidgetOb = keyof typeof WIDGET_OB;
export const coWidgetOb = (ma: string) => Object.prototype.hasOwnProperty.call(WIDGET_OB, ma);

type OTho = [MaWidgetOb, number, number, number, number, MaWidgetOb[]?];
const o = (ds: OTho[]): O[] => ds.map(([ma, x, y, w, h, tabs]) => (tabs?.length ? { ma, x, y, w, h, tabs: [ma, ...tabs] } : { ma, x, y, w, h }));
// Nguyên tắc xếp như /home: bảng rộng trọn bề ngang, bảng phụ thành tab cùng ô, dải số một hàng mỏng trên cùng.
export const MAN_OB: BoSoMan[] = [
  { id: 'ob-tong', ten: 'Toàn cảnh', kh: 'TC', nhom: 'Outreach', o: o([['T1', 0, 0, 48, 10], ['C1', 0, 10, 48, 26], ['T2', 0, 36, 13, 36], ['N2', 13, 36, 20, 36], ['N3', 33, 36, 15, 36]]) },   // bảng chiến dịch 14 cột: trọn bề ngang (ô 34 cột làm tiêu đề cột bị cắt chữ — đo 20/11/2026)
  { id: 'ob-cd', ten: 'Chiến dịch', kh: 'CD', nhom: 'Outreach', o: o([['C1', 0, 0, 48, 44], ['C2', 0, 44, 48, 28]]) },
  { id: 'ob-nn', ten: 'Người nhận', kh: 'NN', nhom: 'Outreach', o: o([['N1', 0, 0, 48, 72]]) },
  { id: 'ob-kn', ten: 'Kiểu và nguồn', kh: 'KN', nhom: 'Thiết lập', o: o([['K1', 0, 0, 28, 72], ['K2', 28, 0, 20, 72]]) },
  { id: 'ob-gui', ten: 'Hạ tầng gửi', kh: 'HG', nhom: 'Thiết lập', o: o([['H1', 0, 0, 48, 22], ['H2', 0, 22, 48, 50, ['H3', 'H4']]]) },
];
export const MAN_OB_MAC_DINH = 'ob-tong';
