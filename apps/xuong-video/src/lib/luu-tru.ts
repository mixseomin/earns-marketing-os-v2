// Tuỳ chọn nhớ theo trình duyệt (tab đang mở, bề rộng drawer, nháp góp ý, khối gập…). localStorage ném lỗi khi chế độ riêng tư,
// đầy hay bị chặn, và không có trên máy chủ → MỌI đọc/ghi đi qua đây: lỗi = coi như chưa lưu, trang vẫn chạy.
export function docLT(khoa: string): string | null {
  try { return localStorage.getItem(khoa); } catch { return null; }
}
/** null = xoá khoá. */
export function ghiLT(khoa: string, v: string | null): void {
  try { if (v == null) localStorage.removeItem(khoa); else localStorage.setItem(khoa, v); } catch { /* riêng tư / đầy / máy chủ */ }
}
export function docJsonLT<T>(khoa: string, macDinh: T): T {
  const s = docLT(khoa);
  if (s == null) return macDinh;
  try { return JSON.parse(s) as T; } catch { return macDinh; }
}
export const ghiJsonLT = (khoa: string, v: unknown): void => ghiLT(khoa, JSON.stringify(v));
