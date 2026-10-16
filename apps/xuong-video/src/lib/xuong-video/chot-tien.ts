// CHỐT TIỀN CHO SCRIPT (16/10/2026: `scripts/kiem-nguoi-xem.mts 57 --in` thiếu --canh nên chạy luôn lượt Claude $0.07 không ai duyệt).
// 13 script ghi "TỐN TIỀN" trong chú thích mà không tự chặn — chặn chỉ trông vào hook tầng lệnh, hook chỉ nhận vài mẫu lệnh. Chặn ở tầng
// mọi lượt tốn tiền đều đi qua (doc-db.ts › taoJob cho ảnh / video / âm; claude.ts › client cho Claude): chạy bằng SCRIPT (tsx scripts/*.mts)
// mà không có DUYET_SINH_1_LAN=1 → ném lỗi, không gọi gì. Studio (next start) không bị ảnh hưởng: nút trong app đã có giá + xác nhận.
// Thuần — tự kiểm: chot-tien.test.mts

/** Loại job tốn tiền (xuat = ffmpeg trên box, 0đ — không chặn). */
export const LOAI_JOB_TON_TIEN = new Set(['anh', 'video', 'am', 'chu', 'nhac']);

/** Đang chạy bằng script trong scripts/ (tsx đặt argv[1] = đường dẫn tệp script) — không phải máy chủ Next. */
export const laScript = (argv1: string | undefined = process.argv[1]): boolean => /\/scripts\/[^/]+\.m?[jt]s$/.test(argv1 ?? '');

/** LUẬT DƯỚI $0,01 (anh 16/10/2026: "các bước dưới $0.01 thì tự chạy luôn"): lượt chạy script được TỰ tiêu tới mức này mà không cần
 *  DUYET_SINH_1_LAN — CỘNG DỒN cả tiến trình (14 ảnh 0,3¢ = 4,2¢ → ảnh thứ 4 đã phải hỏi), ước theo GIÁ NIÊM YẾT (cổng rẻ thật ra còn rẻ hơn).
 *  Không biết giá (video, Claude…) → luôn hỏi. */
export const NGUONG_TU_CHAY_CENTS = 1;
let daTuChay = 0;
/** Reset bộ đếm cộng dồn — chỉ cho tự kiểm. */
export const _datLaiTuChay = (): void => { daTuChay = 0; };

/** Gọi ngay trước lượt tốn tiền. Script thiếu duyệt → ném lỗi, trừ khi `cents` (giá ước) cộng dồn vẫn dưới NGUONG_TU_CHAY_CENTS. */
export function chotTien(viec: string, o: { argv1?: string; duyet?: string; cents?: number } = {}): void {
  if (!laScript(o.argv1 ?? process.argv[1])) return;
  if ((o.duyet ?? process.env.DUYET_SINH_1_LAN) === '1') return;
  if (o.cents != null && Number.isFinite(o.cents) && o.cents >= 0 && daTuChay + o.cents < NGUONG_TU_CHAY_CENTS) { daTuChay += o.cents; return; }
  throw new Error(`${viec} TỐN TIỀN${o.cents != null ? ` (~${o.cents}¢, cộng dồn lượt này ${daTuChay}¢ — vượt ngưỡng tự chạy ${NGUONG_TU_CHAY_CENTS}¢)` : ' (không ước được giá)'} — chạy bằng script chỉ được khi có DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt đúng lượt này`);
}
