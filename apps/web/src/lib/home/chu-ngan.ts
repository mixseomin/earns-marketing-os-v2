'use client';
// Một khối cũ (vd Máy SX) được /home tách thành nhiều widget cùng màn thì mỗi widget là MỘT bản của khối đó — và mọi bản cùng đọc một tham số URL để mở ngăn chi tiết.
// Không gác thì bấm một dòng là mở hai ngăn chồng nhau. Hook này chọn đúng MỘT bản (bản lên màn trước) giữ việc vẽ ngăn; bản đó rời màn thì bản kế nhận.
import { useEffect, useRef, useState } from 'react';

const DANG_CO = new Map<string, symbol[]>(), NGHE = new Set<() => void>();
const bao = () => NGHE.forEach((f) => f());

export function useChuNgan(khoa: string): boolean {
  const toi = useRef<symbol>(Symbol(khoa)).current;
  const [, veLai] = useState(0);
  useEffect(() => {
    DANG_CO.set(khoa, [...(DANG_CO.get(khoa) ?? []), toi]);
    const f = () => veLai((n) => n + 1); NGHE.add(f); bao();
    return () => { DANG_CO.set(khoa, (DANG_CO.get(khoa) ?? []).filter((x) => x !== toi)); NGHE.delete(f); bao(); };
  }, [khoa, toi]);
  return (DANG_CO.get(khoa) ?? [])[0] === toi;
}
