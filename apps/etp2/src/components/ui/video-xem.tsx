'use client';
// VIDEO XEM (anh #1753 22/11/2026: "Default là có bật âm thanh !") — mọi video có nút điều khiển (người xem chủ động mở để xem creative)
// mặc định BẬT TIẾNG. Chrome chặn tự chạy có tiếng khi trang chưa được bấm lần nào → lùi về tắt tiếng để video vẫn chạy (bấm loa là có tiếng).
// Ảnh nhỏ / rê để xem trước (không có nút điều khiển) giữ <video muted> — không dùng khung này.
import { useEffect, useRef, type Ref, type VideoHTMLAttributes } from 'react';

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'muted' | 'autoPlay'> & { ref?: Ref<HTMLVideoElement> };

export function VideoXem({ ref, ...p }: Props) {
  const el = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = el.current; if (!v) return;
    v.muted = false;
    v.play().catch(() => { v.muted = true; void v.play().catch(() => {}); });
  }, [p.src]);
  return <video {...p} data-video-xem="" ref={(v) => { el.current = v; if (typeof ref === 'function') ref(v); else if (ref) (ref as { current: HTMLVideoElement | null }).current = v; }} />;
}
