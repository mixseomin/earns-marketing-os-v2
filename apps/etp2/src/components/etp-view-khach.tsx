'use client';
// etp2 09/11/2026 "sửa load chậm": EtpView CHỈ DỰNG Ở TRÌNH DUYỆT — trước máy chủ dựng sẵn HTML cả bảng ~1.569 camp (~1,5–2s TTFB, ~3 MB HTML)
// rồi trình duyệt dựng lại y hệt lúc hydrate. Dữ liệu vẫn đi kèm trang như cũ; chỉ bỏ lượt dựng trùng trên máy chủ.
import dynamic from 'next/dynamic';

export const EtpView = dynamic(() => import('./etp-view').then((m) => m.EtpView), {
  ssr: false,
  loading: () => <div style={{ padding: 24, color: 'var(--fg-2)', fontSize: 13 }}>Đang dựng bảng etp…</div>,
});
