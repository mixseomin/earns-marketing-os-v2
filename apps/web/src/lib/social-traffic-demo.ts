// SOCIAL TRAFFIC — kiểu dữ liệu + bộ DEMO của tab trang chủ "Social Traffic" (anh chốt 16/10/2026):
// kênh video tự đăng → site aff. Góc lấy từ spy.on.tc, video dựng ở xưởng studio.on.tc, kênh = tài khoản vault,
// mỗi video một trang đích trên site aff, hoa hồng chảy ngược về spy. File THƯỜNG (không 'use client', không server-only):
// server loader (lib/social-traffic.ts) và view client cùng import.

export type StTrangThaiGoc = 'chua' | 'dang' | 'thang' | 'chet';
export type StTrangThaiKenh = 'song' | 'co' | 'khoa' | 'dung';

export interface StGoc {
  id: number; nhom: string; ten: string; loai: string;
  suc: number | null; nguoi: number; qc: number | null; batNgo: boolean; dangLen: boolean;
  tt: StTrangThaiGoc; video: number; click: number; hh: number;
}
export interface StKenh {
  id: number; ten: string; nenTang: string; nhom: string; ngonNgu: string; proxy: string;
  tt: StTrangThaiKenh; ngay: number; video: number; trungViXem: number; xem: number; click: number; hh: number;
}
export interface StLo { id: number; goc: number; kenh: number; buoc: number }
export interface StTrang { slug: string; goc: number; kenh: number; click: number; raShop: number; chuongTrinh: string; song: boolean }
export interface StDuLieu { goc: StGoc[]; kenh: StKenh[]; lo: StLo[]; trang: StTrang[] }

export const ST_BUOC = ['Kịch bản', 'Dựng', 'Kiểm', 'Lên lịch'] as const;   // bước 4 = đã đăng (rời hàng đợi)
export const ST_GIA_MAC = { video: 2, proxy: 3, hhDon: 6 };                 // $/video (xưởng đo $1–3), $/proxy/tháng ($2,4–4), $/đơn (15% × $40)
export const ST_CAT_TRUNG_VI = 500, ST_CAT_NGAY = 30;                       // luật cắt kênh: sau 30 ngày trung vị < 500 lượt

export const ST_DEMO: StDuLieu = {
  goc: [
    { id: 1, nhom: 'Râu tóc nam', ten: 'Tự cắt tóc ở nhà không lởm chởm sau gáy', loai: 'Tình huống', suc: 92, nguoi: 148, qc: 0, batNgo: true, dangLen: false, tt: 'thang', video: 14, click: 3120, hh: 412 },
    { id: 2, nhom: 'Râu tóc nam', ten: 'Tóc dày hay kẹt lưỡi', loai: 'Nỗi đau', suc: 87, nguoi: 96, qc: 12, batNgo: false, dangLen: true, tt: 'thang', video: 9, click: 1840, hh: 238 },
    { id: 3, nhom: 'Râu tóc nam', ten: 'Cạo râu trên xe tải đường dài', loai: 'Tình huống', suc: 81, nguoi: 41, qc: 0, batNgo: true, dangLen: false, tt: 'dang', video: 5, click: 410, hh: 36 },
    { id: 4, nhom: 'Râu tóc nam', ten: 'Da nhạy cảm nổi mẩn sau cạo', loai: 'Nỗi đau', suc: 78, nguoi: 73, qc: 31, batNgo: false, dangLen: false, tt: 'dang', video: 4, click: 260, hh: 18 },
    { id: 5, nhom: 'Râu tóc nam', ten: '18.000 bài Reddit: 5 lỗi người ta ghét nhất', loai: 'Phản đối', suc: 74, nguoi: 210, qc: 0, batNgo: false, dangLen: false, tt: 'chua', video: 0, click: 0, hh: 0 },
    { id: 6, nhom: 'Râu tóc nam', ten: 'Cắt tóc cho con nhỏ hay ngọ nguậy', loai: 'Chân dung', suc: 69, nguoi: 38, qc: 0, batNgo: true, dangLen: false, tt: 'chua', video: 0, click: 0, hh: 0 },
    { id: 7, nhom: 'Chăm sóc da', ten: 'Da xỉn sau ca đêm', loai: 'Tình huống', suc: 83, nguoi: 64, qc: 4, batNgo: false, dangLen: false, tt: 'dang', video: 6, click: 720, hh: 71 },
    { id: 8, nhom: 'Chăm sóc da', ten: 'Serum làm bết khi trang điểm', loai: 'Phản đối', suc: 66, nguoi: 52, qc: 9, batNgo: false, dangLen: false, tt: 'chet', video: 8, click: 95, hh: 0 },
    { id: 9, nhom: 'Đồ du lịch', ten: 'Mất điện giữa chuyến bay dài', loai: 'Tình huống', suc: 80, nguoi: 88, qc: 22, batNgo: false, dangLen: false, tt: 'chua', video: 0, click: 0, hh: 0 },
  ],
  kenh: [
    { id: 1, ten: '@trimlab.us', nenTang: 'TikTok', nhom: 'Râu tóc nam', ngonNgu: 'EN', proxy: 'US · ISP #14', tt: 'song', ngay: 46, video: 88, trungViXem: 4200, xem: 412000, click: 3900, hh: 486 },
    { id: 2, ten: 'TrimLab', nenTang: 'YouTube', nhom: 'Râu tóc nam', ngonNgu: 'EN', proxy: 'US · ISP #15', tt: 'song', ngay: 46, video: 88, trungViXem: 1900, xem: 168000, click: 2140, hh: 214 },
    { id: 3, ten: '@trimlab', nenTang: 'Instagram', nhom: 'Râu tóc nam', ngonNgu: 'EN', proxy: 'US · ISP #16', tt: 'co', ngay: 31, video: 60, trungViXem: 820, xem: 51000, click: 610, hh: 42 },
    { id: 4, ten: 'TrimLab Pins', nenTang: 'Pinterest', nhom: 'Râu tóc nam', ngonNgu: 'EN', proxy: 'US · ISP #17', tt: 'song', ngay: 31, video: 60, trungViXem: 640, xem: 39000, click: 880, hh: 64 },
    { id: 5, ten: '@trimlab.es', nenTang: 'TikTok', nhom: 'Râu tóc nam', ngonNgu: 'ES', proxy: 'MX · ISP #21', tt: 'song', ngay: 12, video: 24, trungViXem: 1300, xem: 31000, click: 220, hh: 18 },
    { id: 6, ten: '@glowshift', nenTang: 'TikTok', nhom: 'Chăm sóc da', ngonNgu: 'EN', proxy: 'US · ISP #22', tt: 'song', ngay: 21, video: 40, trungViXem: 960, xem: 38000, click: 815, hh: 71 },
    { id: 7, ten: '@carryon.kit', nenTang: 'TikTok', nhom: 'Đồ du lịch', ngonNgu: 'EN', proxy: 'US · ISP #23', tt: 'khoa', ngay: 9, video: 18, trungViXem: 140, xem: 2500, click: 12, hh: 0 },
  ],
  lo: [
    { id: 301, goc: 3, kenh: 1, buoc: 0 }, { id: 302, goc: 3, kenh: 2, buoc: 1 }, { id: 303, goc: 4, kenh: 1, buoc: 1 },
    { id: 304, goc: 7, kenh: 6, buoc: 2 }, { id: 305, goc: 1, kenh: 5, buoc: 2 }, { id: 306, goc: 2, kenh: 4, buoc: 3 }, { id: 307, goc: 1, kenh: 3, buoc: 3 },
  ],
  trang: [
    { slug: 'g/0142', goc: 1, kenh: 1, click: 1480, raShop: 31, chuongTrinh: 'Amazon Associates', song: true },
    { slug: 'g/0151', goc: 2, kenh: 1, click: 940, raShop: 26, chuongTrinh: 'Impact · nhãn A', song: true },
    { slug: 'g/0163', goc: 1, kenh: 2, click: 1020, raShop: 34, chuongTrinh: 'Amazon Associates', song: true },
    { slug: 'g/0170', goc: 3, kenh: 1, click: 410, raShop: 18, chuongTrinh: 'CJ · nhãn B', song: false },
    { slug: 'g/0188', goc: 7, kenh: 6, click: 720, raShop: 22, chuongTrinh: 'Amazon Associates', song: true },
    { slug: 'g/0194', goc: 8, kenh: 6, click: 95, raShop: 6, chuongTrinh: 'Impact · nhãn C', song: false },
  ],
};
