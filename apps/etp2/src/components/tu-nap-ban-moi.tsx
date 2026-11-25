'use client';
// BẢN MỚI LÊN → TAB CŨ TỰ NẠP LẠI (anh 25/11/2026: bấm Duyệt trên thẻ chờ duyệt ra "Server Action … was not found on the server").
// Mỗi lần deploy, mã server action đổi; tab mở từ trước còn giữ mã cũ nên MỌI nút gọi máy chủ đều hỏng cho tới khi nạp lại trang.
// Máy chủ Next trả header x-nextjs-action-not-found: 1 cho đúng ca này → bắt một chỗ ở fetch toàn trang, nạp lại ngay, mọi nút đều được (không vá từng nút).
import { useEffect } from 'react';

export function TuNapBanMoi() {
  useEffect(() => {
    const w = window as unknown as { __tuNap?: boolean };
    if (w.__tuNap) return; w.__tuNap = true;
    const goc = window.fetch.bind(window);
    window.fetch = async (...a: Parameters<typeof fetch>) => {
      const r = await goc(...a);
      if (r.headers.get('x-nextjs-action-not-found') === '1') { window.location.reload(); return new Promise<Response>(() => {}); }
      return r;
    };
  }, []);
  return null;
}
