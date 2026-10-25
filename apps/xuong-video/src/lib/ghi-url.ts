// CỬA DUY NHẤT ghi tham số trạng thái lên URL (?tab= ?sbx= ?m= ?tlz= …) — không qua điều hướng, không gọi máy chủ.
// Gốc lỗi "lúc nào cũng về tab đầu" (anh 25/10/2026): mọi chỗ cũ gọi history.replaceState(window.history.state, …). State đó mang cờ __NA của Next
// → bản vá history của Next coi là lệnh NỘI BỘ, bỏ qua, router không biết URL đã đổi. Lần kế router đổi state (server action docPhim chạy định kỳ
// 4–15s, bấm bất kỳ nút nào gọi máy chủ) Next ghi lại URL cũ của nó → ?tab= mất → F5 / dựng lại ngăn mở tab mặc định.
// Đúng cách (Next ≥14.1): truyền state null — Next tự chép __NA + cây router sang, rồi cập nhật canonicalUrl (useSearchParams theo kịp).
// scripts/khong-replace-state-tho.mjs chặn mọi history.replaceState/pushState ngoài tệp này (chạy trong npm run typecheck).

/** Đặt / xoá nhiều tham số một lượt: giá trị null|'' = xoá; mảng = nhiều giá trị cùng khoá (append). */
export function ghiThamSoUrl(doi: Record<string, string | readonly string[] | null | undefined>): void {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(doi)) {
    u.searchParams.delete(k);
    if (Array.isArray(v)) for (const x of v) u.searchParams.append(k, x);
    else if (typeof v === 'string' && v !== '') u.searchParams.set(k, v);
  }
  const moi = `${u.pathname}${u.search}${u.hash}`;
  if (moi === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history.replaceState(null, '', moi);
}
