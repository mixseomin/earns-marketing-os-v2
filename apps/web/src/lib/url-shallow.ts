'use client';

// Đọc/ghi MỘT param trên URL kiểu SHALLOW (window.history.replaceState) — KHÔNG trigger RSC roundtrip
// như router.replace, nên hợp cho trạng thái bảng đổi liên tục (bấm sort, gõ lọc-cột). Nhờ đó sort +
// lọc-cột SỐNG QUA F5 và share được qua link. Cùng triết lý useModalParam (URL = source of truth) nhưng
// ở tầng 1-param thô, không gắn React state.
//
// QUAN TRỌNG: đọc window.location.search TƯƠI mỗi lần ghi (không snapshot lúc render) → gọi nhiều setter
// trong cùng handler vẫn cộng dồn đúng, tránh bug "chỉ key cuối sống" của useUrlState (xem file đó).

export function readShallowParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return new URLSearchParams(window.location.search).get(key); } catch { return null; }
}

/** replaceState shallow CHUẨN NHÀ — mọi chỗ tự gọi window.history.replaceState phải đi qua đây.
 *  Lý do tồn tại: Next App Router lưu state điều hướng trong history.state; ghi `{}`/`null` như
 *  17 call-site cũ là ĐÈ MẤT nó → back/forward lệch sau khi đụng bất kỳ filter shallow nào. */
export function shallowReplaceUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try { window.history.replaceState(window.history.state, '', url); } catch { /* ignore */ }
}

export function writeShallowParam(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (value) sp.set(key, value); else sp.delete(key);
    const qs = sp.toString();
    shallowReplaceUrl(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  } catch { /* ignore */ }
}
