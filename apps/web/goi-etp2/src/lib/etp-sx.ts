// PHIM ĐANG SẢN XUẤT CREATIVE — một định nghĩa cho bản nhẹ (etp-doc), badge KT trên cây, tab Phim và ô Lọc Cây camp (anh 05/11/2026
// "cần thêm bộ lọc show các film đang có sx creative"). Module thuần: trang (client) và etp-doc (server-only) cùng nhập.
import type { DuLieuEtp, ThuVienMuc } from '@/lib/etp-doc';

/** bản thư viện CHƯA thành creative (máy sinh đang làm / sẵn sàng chờ đưa lên) */
export const tvChuaCr = (v: ThuVienMuc) => !v.creative_id && (v.tv === 'dang_sinh' || v.tv === 'san_sang');

/** bản thư viện còn trong đường sản xuất: chưa thành creative, hoặc đã thành creative ≤ 3 ngày mà chưa lên camp nào (chờ chấm / chờ nhịp lên camp) */
export const tvSx = (v: ThuVienMuc, bayGio = Date.now()) =>
  tvChuaCr(v) || (!!v.creative_id && v.tv === 'da_len' && !v.camp && !!v.tao && bayGio - Date.parse(v.tao) < 3 * 86_400_000);

/** content_id các phim đang sản xuất: dòng phim đang chạy + thư viện còn trong đường sản xuất */
export const phimDangSx = (du: Pick<DuLieuEtp, 'dongChay' | 'thuVien'>) => new Set<number>([
  ...(du.dongChay ?? []).filter((x) => (x.trang_thai ?? 'chay') === 'chay').map((x) => x.content_id),
  ...(du.thuVien ?? []).filter((v) => tvSx(v)).map((v) => v.content_id)]);
