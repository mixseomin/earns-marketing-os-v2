// SHOP — BƯỚC của một đơn trên đường đi (dùng chung máy chủ + trình duyệt). Một hàm duy nhất suy bước từ trạng thái Woo
// + đơn NCC, để danh sách, ô lọc, dải số và drawer không mỗi chỗ tự đoán một kiểu.

export type Buoc = 'cho_tt' | 'cho_ncc' | 'loi_ncc' | 'cho_tra' | 'ncc_xu_ly' | 'dang_giao' | 'tre' | 'da_giao' | 'huy';

export const BUOC: { key: Buoc; nhan: string; chuThich: string; mau: 'muted' | 'warn' | 'bad' | 'ok' | 'info' }[] = [
  { key: 'cho_ncc', nhan: 'Chờ sang NCC', chuThich: 'Khách đã trả tiền, chưa có đơn bên nhà cung cấp. Nhịp máy (10 phút) tự đặt nếu cửa hàng bật "tự sang NCC".', mau: 'warn' },
  { key: 'loi_ncc', nhan: 'Lỗi NCC', chuThich: 'Đặt sang nhà cung cấp bị lỗi (thiếu mã biến thể, không có tuyến ship, CJ từ chối…). Mở đơn đọc lỗi, sửa rồi bấm Sang NCC.', mau: 'bad' },
  { key: 'cho_tra', nhan: 'Chờ trả NCC', chuThich: 'Đơn CJ đã tạo nhưng CHƯA thanh toán — CJ chưa xử lý. Trả bằng nút trong đơn (trừ ví CJ) hoặc trên trang CJ.', mau: 'warn' },
  { key: 'ncc_xu_ly', nhan: 'NCC đang xử lý', chuThich: 'Đã trả CJ, chờ CJ đóng gói và cấp mã vận đơn.', mau: 'info' },
  { key: 'dang_giao', nhan: 'Đang giao', chuThich: 'Có mã vận đơn, khách đã được báo, hàng đang trên đường.', mau: 'info' },
  { key: 'tre', nhan: 'Giao trễ', chuThich: 'Đã gửi quá số ngày tối đa của tuyến mà chưa giao — dễ thành khiếu nại/dispute, nên nhắn khách trước.', mau: 'bad' },
  { key: 'da_giao', nhan: 'Đã giao', chuThich: 'Hãng vận chuyển báo đã giao.', mau: 'ok' },
  { key: 'cho_tt', nhan: 'Chưa trả tiền', chuThich: 'Đơn Woo chưa thanh toán xong (pending / on-hold / failed) — chưa làm gì.', mau: 'muted' },
  { key: 'huy', nhan: 'Huỷ / hoàn', chuThich: 'Đơn đã huỷ hoặc hoàn tiền toàn bộ.', mau: 'muted' },
];
export const NHAN_BUOC = Object.fromEntries(BUOC.map((b) => [b.key, b.nhan])) as Record<Buoc, string>;

export type NccTom = { trang_thai: string; da_tra: boolean; ma_van_don: string | null; gui_luc: string | null; giao_luc: string | null; so_ngay: string | null } | null;

export function buocCua(trangThaiShop: string, ncc: NccTom, bayGio = Date.now()): Buoc {
  if (['cancelled', 'refunded'].includes(trangThaiShop)) return 'huy';
  if (['pending', 'on-hold', 'failed', 'checkout-draft'].includes(trangThaiShop)) return 'cho_tt';
  if (!ncc || ncc.trang_thai === 'CANCELLED') return 'cho_ncc';
  if (ncc.trang_thai === 'LOI') return 'loi_ncc';
  if (ncc.giao_luc || ncc.trang_thai === 'DELIVERED') return 'da_giao';
  if (ncc.ma_van_don) {
    const toiDa = Math.max(...(String(ncc.so_ngay ?? '').match(/\d+/g) ?? ['20']).map(Number));
    // +3 ngày: vận đơn hiện trước khi hàng thật sự rời kho
    return ncc.gui_luc && bayGio - Date.parse(ncc.gui_luc) > (toiDa + 3) * 86_400_000 ? 'tre' : 'dang_giao';
  }
  if (!ncc.da_tra) return 'cho_tra';
  return 'ncc_xu_ly';
}
