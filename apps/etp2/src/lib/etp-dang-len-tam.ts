// DẤU "ĐANG LÊN" TẠM Ở TRÌNH DUYỆT (#1770, anh 22/11/2026 "đã gửi thì status này phải update ngay lập tức chứ ?").
// Gốc: ▶ Lên xong máy chủ đã ghi dòng gửi (etp-nhat-ky-len), nhưng bảng chỉ đổi khi tải lại xong cả bộ số (~7 MB × 2, ~10 giây, iPhone lâu hơn;
// tự làm mới còn nghỉ lúc Ethopex đồng bộ) → khung báo "✓ đã gửi" mà dòng phía sau vẫn "chờ anh duyệt".
// Cách: nút ▶ Lên thành công thì đánh dấu creative ngay ở trình duyệt; ô trạng thái đọc dấu này cho tới khi có bộ số máy chủ dựng SAU lúc gửi
// (lúc đó số thật thắng: còn đang lên → x.gui; hỏng nhanh → về "chờ anh duyệt ⚠ …"). Quá 2 giờ thì bỏ, như nhật ký phía máy chủ.
import { useSyncExternalStore } from 'react';

const HET_MS = 2 * 3600_000;
const dau = new Map<number, string>();   // creative → ISO giờ gửi
const nghe = new Set<() => void>();

/** gọi khi ▶ Lên trả ok — gui = giờ máy chủ ghi dòng gửi (thiếu thì lấy giờ trình duyệt) */
export function danhDauDangLen(cr: number, gui?: string | null): void {
  dau.set(Math.trunc(Number(cr)), gui || new Date().toISOString());
  for (const f of nghe) f();
}

/** giờ gửi còn hiệu lực của creative, chỉ khi bộ số đang xem (lucDu = DuLieuEtp.luc) dựng TRƯỚC lúc gửi — bộ số mới hơn thì để số thật nói */
export function dangLenTam(cr: number, lucDu: string | null | undefined): string | null {
  const g = dau.get(Math.trunc(Number(cr))); if (!g) return null;
  const t = Date.parse(g);
  if (!(Date.now() - t < HET_MS)) return null;
  if (lucDu && Date.parse(lucDu) >= t) return null;
  return g;
}

export function useDangLenTam(cr: number, lucDu: string | null | undefined): string | null {
  useSyncExternalStore((f) => { nghe.add(f); return () => { nghe.delete(f); }; }, () => dau.get(Math.trunc(Number(cr))) ?? null, () => null);
  return dangLenTam(cr, lucDu);
}
// tự kiểm: node_modules/.bin/tsx apps/etp2/src/lib/etp-dang-len-tam.test.mts
