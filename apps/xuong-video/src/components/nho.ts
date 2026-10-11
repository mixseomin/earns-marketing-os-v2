'use client';
// State nhớ theo trình duyệt (lib/luu-tru): giá trị ngoài danh sách hợp lệ (khoá cũ, sửa tay) → về mặc định.
import { useState } from 'react';
import { docLT, ghiLT } from '@/lib/luu-tru';

/** thamSoUrl: trạng thái đổi cách nhìn cũng nằm trên URL (luật nhà #1255, như ?tlz=) — link/F5 mở đúng chỗ, URL thắng localStorage. */
export function useNho<T extends string>(khoa: string, macDinh: T, hopLe?: readonly T[], thamSoUrl?: string): [T, (v: T) => void] {
  const hop = (s: string | null): s is T => s != null && (!hopLe || hopLe.includes(s as T));
  const [v, setV] = useState<T>(() => {
    const u = thamSoUrl && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(thamSoUrl) : null;
    if (hop(u)) return u;
    const s = docLT(khoa);
    return hop(s) ? s : macDinh;
  });
  return [v, (x: T) => {
    setV(x); ghiLT(khoa, x);
    if (thamSoUrl && typeof window !== 'undefined') { const u = new URL(window.location.href); u.searchParams.set(thamSoUrl, x); window.history.replaceState(window.history.state, '', u.toString()); }
  }];
}
