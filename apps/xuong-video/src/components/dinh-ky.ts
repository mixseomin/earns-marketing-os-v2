'use client';
// Hỏi lại máy chủ định kỳ — một cơ chế cho mọi vòng hỏi của studio. Mặc định CHỈ khi tab đang hiện (tab ẩn không tốn lượt gọi);
// `caKhiAn` cho vòng phải chạy cả khi tab ẩn (đẩy việc sinh video/bản xuất về đích). `ms` null = tạm dừng.
import { useEffect, useRef } from 'react';

export function useDinhKy(fn: () => unknown, ms: number | null, o: { caKhiAn?: boolean } = {}): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const t = setInterval(() => { if (o.caKhiAn || document.visibilityState === 'visible') void ref.current(); }, ms);
    return () => clearInterval(t);
  }, [ms, o.caKhiAn]);
}
