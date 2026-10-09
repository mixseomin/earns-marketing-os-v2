'use client';
// State nhớ theo trình duyệt (lib/luu-tru): giá trị ngoài danh sách hợp lệ (khoá cũ, sửa tay) → về mặc định.
import { useState } from 'react';
import { docLT, ghiLT } from '@/lib/luu-tru';

export function useNho<T extends string>(khoa: string, macDinh: T, hopLe?: readonly T[]): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    const s = docLT(khoa) as T | null;
    return s != null && (!hopLe || hopLe.includes(s)) ? s : macDinh;
  });
  return [v, (x: T) => { setV(x); ghiLT(khoa, x); }];
}
