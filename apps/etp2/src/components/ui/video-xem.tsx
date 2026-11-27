'use client';
// VIDEO XEM — mọi video có nút điều khiển (người xem chủ động mở để xem creative) đi qua MỘT khung này.
// Tiếng (anh #1849 25/11/2026, thay #1753): "Khi mở creative, ko bật voice ngay ! Nếu tắt/bật thì thao tác tiếp theo sẽ theo nó default mới"
// → mặc định TẮT TIẾNG; anh bấm loa bật / tắt thì nhớ lựa chọn đó (localStorage, mọi tab) và video mở sau theo đúng lựa chọn mới.
// Nhớ bật tiếng mà Chrome chặn tự chạy có tiếng (trang chưa bấm lần nào) → lùi về tắt tiếng cho video vẫn chạy, KHÔNG ghi đè lựa chọn đã nhớ.
// Ảnh nhỏ / rê để xem trước (không có nút điều khiển) giữ <video muted> — không dùng khung này.
// NÚT TIẾNG TOÀN TRANG (anh #1850 25/11/2026 "Thêm 1 nút tắt/bật sound toàn site"): NutTieng ở hàng tiêu đề, cùng MỘT khoá nhớ với loa của video —
// bấm nút hay bấm loa của một video đều phát sự kiện SU_KIEN → mọi video đang mở + nút đổi theo ngay (tab khác theo qua sự kiện storage).
import { useEffect, useRef, useState, type Ref, type VideoHTMLAttributes } from 'react';

// MỘT VIDEO MỘT LÚC cả trang (anh 27/11/2026 "SAO LẠI BẬT PLAY HẾT VIDEO CÙNG 1 LÚC"): video nào bắt đầu chạy thì mọi video khác đang chạy dừng lại.
// Bắt sự kiện play ở tầng document (pha capture) → áp cho mọi <video> trên trang, kể cả video không đi qua khung này.
if (typeof document !== 'undefined' && !(window as { __motVideo?: boolean }).__motVideo) {
  (window as { __motVideo?: boolean }).__motVideo = true;
  document.addEventListener('play', (e) => {
    const t = e.target; if (!(t instanceof HTMLVideoElement)) return;
    document.querySelectorAll('video').forEach((v) => { if (v !== t && !v.paused) v.pause(); });
  }, true);
}

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'muted' | 'autoPlay'> & { ref?: Ref<HTMLVideoElement> };

const KHOA_TIENG = 'etp2-video-tieng'; // '1' = bật tiếng; không có / '0' = tắt tiếng (mặc định)
const SU_KIEN = 'etp2-tieng';          // phát trong tab khi lựa chọn tiếng đổi

function docBatTieng(): boolean {
  try { return localStorage.getItem(KHOA_TIENG) === '1'; } catch { return false; }
}
function ghiBatTieng(bat: boolean) {
  if (docBatTieng() === bat) return;
  try { localStorage.setItem(KHOA_TIENG, bat ? '1' : '0'); } catch { /* chế độ riêng tư: chỉ nhớ trong lượt xem */ }
  window.dispatchEvent(new Event(SU_KIEN));
}
// nghe đổi tiếng: trong tab (SU_KIEN) + tab khác (storage)
function useNgheTieng(fn: () => void) {
  const f = useRef(fn); f.current = fn;
  useEffect(() => {
    const goi = () => f.current();
    const st = (e: StorageEvent) => { if (e.key === KHOA_TIENG) goi(); };
    window.addEventListener(SU_KIEN, goi); window.addEventListener('storage', st);
    return () => { window.removeEventListener(SU_KIEN, goi); window.removeEventListener('storage', st); };
  }, []);
}

export function VideoXem({ ref, onVolumeChange, ...p }: Props) {
  const el = useRef<HTMLVideoElement | null>(null);
  const mayDoi = useRef(false); // máy tự đổi tiếng (đặt mặc định / lùi khi bị chặn / nút toàn trang) → không coi là anh bấm loa video này
  useEffect(() => {
    const v = el.current; if (!v) return;
    mayDoi.current = true;
    v.muted = !docBatTieng();
    v.play().catch(() => { if (!v.muted) { v.muted = true; return v.play().catch(() => {}); } })
      .finally(() => { setTimeout(() => { mayDoi.current = false; }, 0); });
  }, [p.src]);
  useNgheTieng(() => {   // nút toàn trang / loa video khác đổi → video đang mở theo ngay
    const v = el.current; if (!v) return;
    const tat = !docBatTieng(); if (v.muted === tat) return;
    mayDoi.current = true; v.muted = tat; setTimeout(() => { mayDoi.current = false; }, 0);
  });
  return <video {...p} data-video-xem=""
    onVolumeChange={(e) => { if (!mayDoi.current) ghiBatTieng(!e.currentTarget.muted && e.currentTarget.volume > 0); onVolumeChange?.(e); }}
    ref={(v) => { el.current = v; if (typeof ref === 'function') ref(v); else if (ref) (ref as { current: HTMLVideoElement | null }).current = v; }} />;
}

// Nút 🔇 / 🔊 toàn trang — một chỗ bật / tắt tiếng cho mọi video creative (đang mở và mở sau). Chỉ biểu tượng, lời giải thích ở chữ rê (YDNI).
export function NutTieng() {
  const [bat, setBat] = useState(false);
  useEffect(() => { setBat(docBatTieng()); }, []);
  useNgheTieng(() => setBat(docBatTieng()));
  return <button type="button" data-nut-tieng={bat ? 'bat' : 'tat'} onClick={() => { ghiBatTieng(!bat); setBat(!bat); }}
    title={bat ? 'Tiếng ĐANG BẬT cho mọi video creative trên trang — bấm để tắt hết' : 'Tiếng ĐANG TẮT cho mọi video creative trên trang — bấm để bật (video đang mở theo ngay, video mở sau cũng theo)'}
    aria-label={bat ? 'Tắt tiếng toàn trang' : 'Bật tiếng toàn trang'} aria-pressed={bat}
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, padding: 0, borderRadius: 6, border: '1px solid var(--line)', background: bat ? 'rgba(34,211,238,0.12)' : 'transparent', color: bat ? '#22d3ee' : 'var(--fg-2)', cursor: 'pointer', fontSize: 14, flex: 'none' }}>
    <span aria-hidden>{bat ? '🔊' : '🔇'}</span>
  </button>;
}
