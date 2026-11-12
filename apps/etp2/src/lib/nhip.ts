// NHỊP TỰ LÀM MỚI CHỈ KHI TAB ĐANG HIỆN (anh 12/11/2026: một tab etp2 để mở 18 giờ ăn 53% CPU iMac).
// Thay mọi setInterval tự làm mới: tab ẩn (sang tab khác / thu nhỏ) thì bỏ lượt; quay lại tab thì chạy ngay một lượt cho số liệu mới.
// Trả về hàm huỷ, dùng y như clearInterval: `const t = nhip(f, 15_000); return () => t();`
export function nhip(f: () => unknown, ms: number): () => void {
  const chay = () => { if (typeof document === 'undefined' || !document.hidden) void f(); };
  const id = window.setInterval(chay, ms);
  const hien = () => { if (!document.hidden) void f(); };
  document.addEventListener('visibilitychange', hien);
  return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', hien); };
}
