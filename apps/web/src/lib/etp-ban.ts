import { sql } from 'drizzle-orm';

// BẢN MẪU (anh 09/11/2026 "sao lại có 2 cái PO? Giờ là PO.1 đến PO.5 cơ mà"): số bản do máy dựng ghi sẵn trong etp.thu_vien.ghi ("poster động (PO) PO.5 bản 1/3 …",
// tinh-ba-kieu.py BAN_PO) → đọc ra tự động, mẫu mới PO.6… tự hiện không cần sửa đây. PO dựng trước 17:44 08/11 (ghi chưa mang số, chỉ có mẫu gốc) = PO.1. Dạng khác chưa có bản → null.
const BAN_RE = "PO[.][0-9]+";
export const sqlBan = (tvGhi: string, dang: string) => sql.raw(`case when ${dang} = 'poster động' then coalesce(substring(${tvGhi} from '${BAN_RE}'), 'PO.1') end`);
export const banCr = (cid: string, dang: string) => sqlBan(`(select t.ghi from etp.thu_vien t where t.creative_id = ${cid})`, dang);
