// SỐ LIỆU TRANG etp2 ĐI RIÊNG, KHÔNG NHÉT TRONG HTML (anh 13/11/2026 "Etp2 đang lỗi. Fix triệt để ngay lập tức, tối ưu"):
// trước đây `du` (~10 MB JSON: 1.835 camp, 1.652 creative, 4.260 lượt chấm…) đi làm props của EtpView → Next nhét nguyên khối vào HTML 11,4 MB
// → iPhone Safari hết RAM giết tab rồi tự tải lại (nginx 20:56 VN 13/11: 3 lượt 499 cách 3 giây).
// HAI PHẦN + BROTLI (anh 13/11/2026 22:00 "Ko load nổi"): mạng iPhone của anh đo ~20 KB/giây — một khối 950 KB gzip mất ~45 giây, anh tải lại giữa chừng.
//   · phần CHÍNH (camp, số ngày, phim, creative…) tải trước → trang hiện ngay; phần PHỤ (xét luật, lịch sử bậc, chấm, báo, nhật ký) tải ngay sau, ghép vào.
//   · mỗi phần cất sẵn gzip (nén ngay, ~0,2 s) rồi brotli mức 11 chạy nền (~40 % nhỏ hơn gzip; ~10 s, chạy ở luồng phụ zlib, không chặn máy chủ).
// Cùng mã phiên bản = cùng dữ liệu → trình duyệt chỉ tải lại khi số đổi.
import { promisify } from 'node:util';
import { brotliCompress, constants as Z, gzip } from 'node:zlib';
import { docEtp } from './etp-doc';
import type { DuLieuEtp } from './etp-doc';
import { catChoNguoi, ngCua, type QuyenEtp } from './etp-quyen';
import { gonXet, type DuLieuEtpGui } from './etp-xet-gon';
import { phienDu } from './etp-phien';

const nenGz = promisify(gzip), nenBr = promisify(brotliCompress);
export type PhanDu = 'chinh' | 'phu';
type Ban = { gz: Buffer; br: Buffer | null; tho: number };
type O = { chinh: Ban; phu: Ban; luc: number };
// globalThis: trang và route có thể nằm ở hai gói mã khác nhau trong cùng tiến trình — một kho chung, không hai bản Map
const g = globalThis as unknown as { __etpDuKho2?: Map<string, O> };
const KHO = (g.__etpDuKho2 ??= new Map<string, O>());
const TOI_DA = 6, SONG_MS = 20 * 60_000;

/** khoá phần PHỤ — giá trị rỗng đúng dạng để phần chính dựng được trang trước khi phần phụ về */
const PHU = { xetLuat: {}, xetChu: [], lsBac: {}, cham: {}, bao: [], ket: [], daLam: [], nhatKy: [], thuVien: [] } satisfies Partial<Record<keyof DuLieuEtpGui, unknown>>;
export const KHOA_PHU = Object.keys(PHU) as (keyof typeof PHU)[];

/** số liệu trang của người xem + mã phiên bản — trang, /etp/du và /etp/phien băm cùng một kiểu */
// MỘT LƯỢT ĐỌC CHO MỌI NGƯỜI HỎI CÙNG LÚC + dùng lại trong 8 giây: trước đây mỗi lần tải lại / mỗi /etp/du trượt / mỗi /etp/phien đọc kho riêng (~1,5 s, 30 câu SQL)
// → anh tải lại liên tục thì máy chủ đọc chồng chục lượt, lượt nào cũng chậm thêm (15:30 UTC 13/11: 12 lượt trong 65 giây, có lượt 22 s).
const g2 = globalThis as unknown as { __etpDuDoc?: Map<string, { p: Promise<{ du: DuLieuEtp; phien: string }>; luc: number }> };
const DOC = (g2.__etpDuDoc ??= new Map());
const DOC_MS = 8_000;
export async function duTrang(quyen: QuyenEtp, ng?: string): Promise<{ du: DuLieuEtp; phien: string }> {
  const n = ngCua(quyen, ng) ?? '', co = DOC.get(n);
  if (co && Date.now() - co.luc < DOC_MS) return co.p;
  const p = docEtp(n || undefined, true).then((du) => ({ du, phien: phienDu(du) }));
  DOC.set(n, { p, luc: Date.now() });
  p.catch(() => DOC.delete(n));
  return p;
}

const khoa = (q: QuyenEtp, phien: string) => `${q.vai}:${q.nguoiId ?? ''}:${phien}`;   // kèm vai: người thường nhận bản đã cắt

// brotli mức 9 nén cùng gzip (~0,3 s / phần). KHÔNG chạy mức 11 nền: 13/11/2026 22:30 mỗi lượt ~10 s chiếm luồng phụ zlib, trong lúc đồng bộ mỗi lần mở trang
// lại đẻ hai lượt → trang chờ 13–22 s, anh tải lại càng chồng (anh: "giờ còn đéo load nổi nữa"). Mức 9 chỉ lớn hơn ~8 %.
const brMuc = (s: Buffer, q: number) => nenBr(s, { params: { [Z.BROTLI_PARAM_QUALITY]: q, [Z.BROTLI_PARAM_SIZE_HINT]: s.length } });
async function ban(v: unknown): Promise<Ban> {
  const s = Buffer.from(JSON.stringify(v));
  const [gz, br] = await Promise.all([nenGz(s, { level: 6 }), brMuc(s, 9).catch(() => null)]);
  return { gz, br, tho: s.length };
}

/** cắt bản gửi làm hai phần, nén, cất theo mã (đã có thì chỉ gia hạn) → trả mã */
export async function catDu(quyen: QuyenEtp, du: DuLieuEtp, phien: string): Promise<string> {
  const k = khoa(quyen, phien), co = KHO.get(k);
  if (co) { co.luc = Date.now(); return phien; }
  const gui = gonXet(quyen.vai === 'nguoi' ? catChoNguoi(du, quyen.nguoiId!) : du) as unknown as Record<string, unknown>;
  const phu = Object.fromEntries(KHOA_PHU.map((x) => [x, gui[x]]));
  const [a, b] = await Promise.all([ban({ ...gui, ...PHU }), ban(phu)]);
  KHO.set(k, { chinh: a, phu: b, luc: Date.now() });
  const nay = Date.now();
  for (const [kk, v] of KHO) if (nay - v.luc > SONG_MS) KHO.delete(kk);
  while (KHO.size > TOI_DA) KHO.delete(KHO.keys().next().value!);
  return phien;
}

export const layDu = (quyen: QuyenEtp, phien: string, phan: PhanDu) => KHO.get(khoa(quyen, phien))?.[phan] ?? null;
