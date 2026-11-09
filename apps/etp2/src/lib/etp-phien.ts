// MÃ PHIÊN BẢN DỮ LIỆU etp2 (anh 09/11/2026 "sửa load chậm"): trang tự làm mới mỗi phút bằng router.refresh → mỗi phút tải lại ~10 MB dữ liệu
// + dựng lại cả bảng dù số không đổi. Giờ trang hỏi /etp/phien (mã băm dữ liệu, vài chục byte), mã khác mã trang đang cầm mới làm mới.
// Băm bỏ `luc` (giờ dựng). Có trường đổi theo đồng hồ thì mã đổi mỗi phút — chỉ quay về như cũ (làm mới mỗi phút), không mất số.
import { createHash } from 'node:crypto';
import type { DuLieuEtp } from './etp-doc';

export const phienDu = (d: DuLieuEtp) => createHash('sha1').update(JSON.stringify({ ...d, luc: null })).digest('hex').slice(0, 16);
