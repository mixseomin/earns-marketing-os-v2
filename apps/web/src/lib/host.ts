/**
 * Hostname hiển thị được từ một URL — bỏ 'www.', hỏng thì trả nguyên chuỗi vào.
 *
 * Trước 2026-08-07 hàm này tồn tại y hệt trong backlinks-page.tsx và outreach-page.tsx, cộng thêm
 * 8 biến thể `replace(/^www\./)` viết tay rải trong các route ext. Mỗi bản sao là một chỗ để
 * hành vi lệch nhau (bản này bỏ www, bản kia không; bản này bắt lỗi, bản kia ném).
 */
export const hostOf = (u: string): string => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
};

/** Hostname → slug dùng làm key (a-z0-9 + gạch nối). Cùng quy tắc mà ext dùng để sinh platform key. */
export const slugifyHost = (h: string): string =>
  h.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
