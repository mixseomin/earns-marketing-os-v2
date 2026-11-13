// SỐ LIỆU TRANG etp2 ĐI RIÊNG MỘT TỆP JSON NÉN, KHÔNG NHÉT TRONG HTML (anh 13/11/2026 "Etp2 đang lỗi. Fix triệt để ngay lập tức, tối ưu"):
// trước đây `du` (~9,6 MB JSON: 1.835 camp, 1.652 creative, 4.260 lượt chấm…) đi làm props của EtpView → Next nhét nguyên khối vào HTML dưới dạng chuỗi
// self.__next_f (11,4 MB thô) → trình duyệt giữ cùng lúc chuỗi trong thẻ script + mảng flight + object đã mở. iPhone Safari hết RAM giết tab rồi tự tải lại:
// nhật ký nginx 20:56 VN 13/11 có 3 lượt 499 cách nhau 3 giây liền nhau trên cùng một trang (Safari 604.1) trước khi vào được.
// Giờ trang chỉ mang mã phiên bản (phienDu); số liệu nằm ở kho trong tiến trình theo mã đó, nén gzip một lần, /etp/du trả thẳng bản nén.
// Cùng mã = cùng dữ liệu → trình duyệt chỉ tải lại khi số đổi (router.refresh đưa mã mới xuống, khung khach tải theo mã).
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { docEtp } from './etp-doc';
import type { DuLieuEtp } from './etp-doc';
import { catChoNguoi, ngCua, type QuyenEtp } from './etp-quyen';
import { gonXet } from './etp-xet-gon';
import { phienDu } from './etp-phien';

const nen = promisify(gzip);
type O = { gz: Buffer; luc: number };
// globalThis: trang và route có thể nằm ở hai gói mã khác nhau trong cùng tiến trình — một kho chung, không hai bản Map
const g = globalThis as unknown as { __etpDuKho?: Map<string, O> };
const KHO = (g.__etpDuKho ??= new Map<string, O>());
const TOI_DA = 6, SONG_MS = 20 * 60_000;   // ~1 MB / bản nén · giữ 6 bản (mấy người / kỳ xem cùng lúc) · 20 phút

/** số liệu trang của người xem: bản thô (băm mã) + bản gửi trình duyệt (cắt theo quyền, gọn bảng xét luật) — trang và /etp/du gọi chung một hàm */
export async function duTrang(quyen: QuyenEtp, ng?: string): Promise<{ du: DuLieuEtp; phien: string }> {
  const du = await docEtp(ngCua(quyen, ng), true);
  return { du, phien: phienDu(du) };
}

/** nén bản gửi + cất theo mã (đã có thì chỉ gia hạn) → trả mã */
export async function catDu(quyen: QuyenEtp, du: DuLieuEtp, phien: string): Promise<string> {
  const k = khoa(quyen, phien), co = KHO.get(k);   // khoá kèm vai: cùng dữ liệu thô nhưng người thường nhận bản đã cắt
  if (co) { co.luc = Date.now(); return phien; }
  const gui = gonXet(quyen.vai === 'nguoi' ? catChoNguoi(du, quyen.nguoiId!) : du);
  KHO.set(k, { gz: await nen(JSON.stringify(gui), { level: 6 }), luc: Date.now() });
  const nay = Date.now();
  for (const [k, v] of KHO) if (nay - v.luc > SONG_MS) KHO.delete(k);
  while (KHO.size > TOI_DA) KHO.delete(KHO.keys().next().value!);
  return phien;
}

const khoa = (q: QuyenEtp, phien: string) => `${q.vai}:${q.nguoiId ?? ''}:${phien}`;
export const layDu = (quyen: QuyenEtp, phien: string): Buffer | null => KHO.get(khoa(quyen, phien))?.gz ?? null;
