// SHOP — luật NGUỒN của một biến thể shop, phía màn hình (thuần, không DB). Một bản cho mọi màn: cây Sản phẩm/Liên kết, danh mục NCC, drawer nguồn.
// Chọn nguồn đang dùng là việc của máy chủ (dong-bo apNguon, SQL) — ở đây chỉ ĐỌC kết quả đó (nguonId) và gọi tên vai theo cùng thứ tự:
// nguồn bật xếp theo ưu tiên (doc.ts đã ORDER BY bat DESC, uu_tien), [0] = chính, còn lại = dự phòng 1, 2…
import type { BienTheDong, NguonDong } from './doc';

/** Nguồn bật theo thứ tự ưu tiên; [0] = chính. */
export const nguonBat = (b: BienTheDong) => b.nguon.filter((n) => n.bat);
/** Nguồn máy đang dùng để đặt hàng (apNguon chọn). */
export const dangDung = (b: BienTheDong) => b.nguon.find((n) => n.id === b.nguonId) ?? null;
/** Biến thể đang chạy bằng nguồn dự phòng (nguồn chính hết/gỡ). */
export const chayDuPhong = (b: BienTheDong) => { const bat = nguonBat(b); return !!b.nguonId && bat.length > 1 && bat[0]!.id !== b.nguonId; };
/** Vai của một nguồn trong biến thể: chính / dự phòng n / đã tắt. */
export const vaiNguon = (b: BienTheDong, n: NguonDong) => { const i = nguonBat(b).findIndex((x) => x.id === n.id); return !n.bat ? 'đã tắt' : i === 0 ? 'chính' : `dự phòng ${i}`; };
/** Mã dài (vid CJ, mã 19 số) giống nhau ở đầu — hiện ĐUÔI để phân biệt; đủ mã đặt ở title. */
export const duoi = (x: string | null) => (x ? (x.length > 10 ? `…${x.slice(-8)}` : x) : '—');
