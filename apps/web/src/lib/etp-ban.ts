import { sql } from 'drizzle-orm';

// BẢN MẪU (anh 09/11/2026 "sao lại có 2 cái PO? Giờ là PO.1 đến PO.5 cơ mà"): số bản do máy dựng ghi sẵn trong etp.thu_vien.ghi ("poster động (PO) PO.5 bản 1/3 …",
// tinh-ba-kieu.py BAN_PO) → đọc ra tự động, mẫu mới PO.6… tự hiện không cần sửa đây. PO dựng trước 17:44 08/11 (ghi chưa mang số, chỉ có mẫu gốc) = PO.1. Dạng khác chưa có bản → null.
const BAN_RE = "PO[.][0-9]+";
export const sqlBan = (tvGhi: string, dang: string) => sql.raw(`case when ${dang} = 'poster động' then coalesce(substring(${tvGhi} from '${BAN_RE}'), 'PO.1') end`);
// GIỌNG ĐỌC (anh 09/11/2026 "làm sao show ra được cả loại giọng? Giờ nhìn 2 camp giống hệt nhau"): máy dựng ghi "giọng ky_di" vào cùng dòng ghi
// (anh-tinh.py KIEU_GIONG) → đọc ra tự động cho MỌI dạng có giọng (PO, AT, CT…); giọng mới tự hiện bằng mã của nó cho tới khi thêm tên ở TEN_GIONG (lib/etp-dang).
const tvGhiCr = (cid: string) => `(select t.ghi from etp.thu_vien t where t.creative_id = ${cid})`;
export const sqlGiong = (tvGhi: string) => sql.raw(`substring(${tvGhi} from 'giọng ([a-z_]+)')`);
export const giongCr = (cid: string) => sqlGiong(tvGhiCr(cid));
export const banCr = (cid: string, dang: string) => sqlBan(tvGhiCr(cid), dang);
