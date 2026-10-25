'use client';
// State nhớ theo trình duyệt (lib/luu-tru): giá trị ngoài danh sách hợp lệ (khoá cũ, sửa tay) → về mặc định.
import { useLayoutEffect, useState } from 'react';
import { docLT, ghiLT } from '@/lib/luu-tru';
import { ghiThamSoUrl } from '@/lib/ghi-url';

/** thamSoUrl: trạng thái đổi cách nhìn cũng nằm trên URL (luật nhà #1255, như ?tlz=) — link/F5 mở đúng chỗ, URL thắng localStorage. */
export function useNho<T extends string>(khoa: string, macDinh: T, hopLe?: readonly T[], thamSoUrl?: string): [T, (v: T) => void] {
  const hop = (s: string | null): s is T => s != null && (!hopLe || hopLe.includes(s as T));
  // Lượt dựng ĐẦU luôn = macDinh (giống HTML máy chủ dựng); URL / localStorage đọc ngay sau đó, TRƯỚC khi vẽ (useLayoutEffect, không nháy).
  // Trước 16/10/2026 đọc thẳng trong khởi tạo → trang chủ mở bằng ?kho=template / ?kho=sanpham lệch HTML máy chủ (React #418).
  const [v, setV] = useState<T>(macDinh);
  useLayoutEffect(() => {
    const u = thamSoUrl ? new URLSearchParams(window.location.search).get(thamSoUrl) : null;
    const s = hop(u) ? u : docLT(khoa);
    if (hop(s) && s !== macDinh) setV(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, (x: T) => {
    setV(x); ghiLT(khoa, x);
    if (thamSoUrl) ghiThamSoUrl({ [thamSoUrl]: x });
  }];
}
