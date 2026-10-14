'use client';
// ĐÓNG KHI BẤM RA NGOÀI — một chỗ cho mọi ô nổi (nút xác nhận, bảng chỉnh lịch…; góp ý #1358 "bấm ra ngoài phải đóng lại chứ"):
// mousedown ngoài các phần tử `trong` · Esc · trang mất focus (bấm vào khung nhúng như văn phòng pixel không phát mousedown ở trang) ·
// tuỳ chọn cuộn trang (ô neo position:fixed lệch khỏi chỗ neo khi cuộn).
import { useEffect, type RefObject } from 'react';

export function useBamNgoai(mo: boolean, trong: RefObject<Element | null>[], dong: () => void, { cuon = false } = {}) {
  useEffect(() => {
    if (!mo) return;
    const o = (n: EventTarget | null) => trong.some((r) => r.current?.contains(n as Node));
    const ngoai = (e: MouseEvent) => { if (!o(e.target)) dong(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); };
    const cuonTrang = (e: Event) => { if (!o(e.target)) dong(); };
    document.addEventListener('mousedown', ngoai); document.addEventListener('keydown', esc); window.addEventListener('blur', dong);
    if (cuon) window.addEventListener('scroll', cuonTrang, true);
    return () => { document.removeEventListener('mousedown', ngoai); document.removeEventListener('keydown', esc); window.removeEventListener('blur', dong); window.removeEventListener('scroll', cuonTrang, true); };
  }, [mo, dong, cuon]);   // eslint-disable-line react-hooks/exhaustive-deps -- `trong` là ref, ổn định
}
