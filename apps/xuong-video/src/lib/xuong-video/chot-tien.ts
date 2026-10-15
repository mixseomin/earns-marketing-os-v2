// CHỐT TIỀN CHO SCRIPT (16/10/2026: `scripts/kiem-nguoi-xem.mts 57 --in` thiếu --canh nên chạy luôn lượt Claude $0.07 không ai duyệt).
// 13 script ghi "TỐN TIỀN" trong chú thích mà không tự chặn — chặn chỉ trông vào hook tầng lệnh, hook chỉ nhận vài mẫu lệnh. Chặn ở tầng
// mọi lượt tốn tiền đều đi qua (doc-db.ts › taoJob cho ảnh / video / âm; claude.ts › client cho Claude): chạy bằng SCRIPT (tsx scripts/*.mts)
// mà không có DUYET_SINH_1_LAN=1 → ném lỗi, không gọi gì. Studio (next start) không bị ảnh hưởng: nút trong app đã có giá + xác nhận.
// Thuần — tự kiểm: chot-tien.test.mts

/** Loại job tốn tiền (xuat = ffmpeg trên box, 0đ — không chặn). */
export const LOAI_JOB_TON_TIEN = new Set(['anh', 'video', 'am', 'chu', 'nhac']);

/** Đang chạy bằng script trong scripts/ (tsx đặt argv[1] = đường dẫn tệp script) — không phải máy chủ Next. */
export const laScript = (argv1: string | undefined = process.argv[1]): boolean => /\/scripts\/[^/]+\.m?[jt]s$/.test(argv1 ?? '');

/** Gọi ngay trước lượt tốn tiền. Script thiếu duyệt → ném lỗi. */
export function chotTien(viec: string, o: { argv1?: string; duyet?: string } = {}): void {
  if (!laScript(o.argv1 ?? process.argv[1])) return;
  if ((o.duyet ?? process.env.DUYET_SINH_1_LAN) === '1') return;
  throw new Error(`${viec} TỐN TIỀN — chạy bằng script chỉ được khi có DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt đúng lượt này`);
}
