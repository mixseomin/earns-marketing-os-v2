'use client';
// VIDEO XEM — mọi video có nút điều khiển (người xem chủ động mở để xem creative) đi qua MỘT khung này.
// Tiếng (anh #1849 25/11/2026, thay #1753): "Khi mở creative, ko bật voice ngay ! Nếu tắt/bật thì thao tác tiếp theo sẽ theo nó default mới"
// → mặc định TẮT TIẾNG; anh bấm loa bật / tắt thì nhớ lựa chọn đó (localStorage, mọi tab) và video mở sau theo đúng lựa chọn mới.
// Nhớ bật tiếng mà Chrome chặn tự chạy có tiếng (trang chưa bấm lần nào) → lùi về tắt tiếng cho video vẫn chạy, KHÔNG ghi đè lựa chọn đã nhớ.
// Ảnh nhỏ / rê để xem trước (không có nút điều khiển) giữ <video muted> — không dùng khung này.
import { useEffect, useRef, type Ref, type VideoHTMLAttributes } from 'react';

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'muted' | 'autoPlay'> & { ref?: Ref<HTMLVideoElement> };

const KHOA_TIENG = 'etp2-video-tieng'; // '1' = bật tiếng; không có / '0' = tắt tiếng (mặc định)

function docBatTieng(): boolean {
  try { return localStorage.getItem(KHOA_TIENG) === '1'; } catch { return false; }
}
function ghiBatTieng(bat: boolean) {
  try { localStorage.setItem(KHOA_TIENG, bat ? '1' : '0'); } catch { /* chế độ riêng tư: chỉ nhớ trong lượt xem */ }
}

export function VideoXem({ ref, onVolumeChange, ...p }: Props) {
  const el = useRef<HTMLVideoElement | null>(null);
  const mayDoi = useRef(false); // máy tự đổi tiếng (đặt mặc định / lùi khi bị chặn) → không coi là anh chọn
  useEffect(() => {
    const v = el.current; if (!v) return;
    mayDoi.current = true;
    v.muted = !docBatTieng();
    v.play().catch(() => { if (!v.muted) { v.muted = true; return v.play().catch(() => {}); } })
      .finally(() => { setTimeout(() => { mayDoi.current = false; }, 0); });
  }, [p.src]);
  return <video {...p} data-video-xem=""
    onVolumeChange={(e) => { if (!mayDoi.current) ghiBatTieng(!e.currentTarget.muted && e.currentTarget.volume > 0); onVolumeChange?.(e); }}
    ref={(v) => { el.current = v; if (typeof ref === 'function') ref(v); else if (ref) (ref as { current: HTMLVideoElement | null }).current = v; }} />;
}
