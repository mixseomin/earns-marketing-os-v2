// NHẬT KÝ LÊN CAMP CỦA MỘT CREATIVE (/tmp/etp-len-cr-<cr>.log trên máy chạy web) — một chỗ ghi + đọc cho mọi nút lên camp (lenNgayCr, lenCampCr) và dòng chờ duyệt (etp-doc hangCr).
// #1770 (anh 22/11/2026 "đã gửi thì status này phải update ngay lập tức chứ ?"): nút ghi DÒNG GỬI trước khi chạy nhan-ban → bảng đọc ra "đang lên" ngay, không chờ camp vào sổ.
import { openSync, readFileSync, writeSync } from 'node:fs';

const tep = (cr: number) => `/tmp/etp-len-cr-${Math.trunc(Number(cr))}.log`;
/** quá chừng này mà nhan-ban chưa ghi kết quả thì thôi coi là đang lên (tiến trình đã chết) */
const GUI_HET_MS = 2 * 3600_000;

/** "HH:MM DD/MM" giờ VN từ ISO */
export const gioVnIso = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600_000), p = (x: number) => String(x).padStart(2, '0'); return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`; };

/** mở nhật ký để nối + ghi dòng gửi (gọi ngay trước spawn nhan-ban; fd dùng làm stdout/stderr của tiến trình) */
export function moNhatKyLen(cr: number, ai: string): number {
  const fd = openSync(tep(cr), 'a'), luc = new Date().toISOString();
  writeSync(fd, `${luc} ${ai} bấm lên camp: ${JSON.stringify({ gui: luc })}\n`);
  return fd;
}

/** gui = giờ gửi lệnh còn đang chạy (chưa có kết quả sau nó) · truoc = lý do lần lên gần nhất hỏng (chỉ khi không đang gửi) */
export function docNhatKyLen(cr: number): { gui: string | null; truoc: string | null } {
  let gui: string | null = null, truoc: string | null = null;
  try {
    for (const d of readFileSync(tep(cr), 'utf8').split('\n')) {
      const i = d.indexOf('{'); if (i < 0) continue;
      let j: { gui?: string; ok?: unknown; loi?: string | null };
      try { j = JSON.parse(d.slice(i)); } catch { continue; }
      if (j.gui) { gui = j.gui; truoc = null; continue; }
      if ('loi' in j || 'ok' in j) { gui = null; truoc = j.loi ? String(j.loi).slice(0, 300) : null; }   // kết quả nhan-ban / lenh_cho: lần gửi trước đã xong
    }
  } catch { /* chưa từng lên */ }
  if (gui && !(Date.now() - Date.parse(gui) < GUI_HET_MS)) gui = null;
  return { gui, truoc };
}
