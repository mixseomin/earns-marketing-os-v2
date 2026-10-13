'use client';
// THỜI GIAN THỰC cho mọi trang (anh 14/10/2026 "các chỗ đều có dạng real-time"): tab đang hiện thì làm mới dữ liệu máy chủ mỗi 20 giây
// (router.refresh — giữ nguyên chữ đang gõ, ngăn đang mở, tab đang chọn). Tab ẩn thì nghỉ. Việc đang chạy vẫn dùng nhịp nhanh riêng (useLamMoiKhi).
import { useEffect, useState } from 'react';
import { useLamMoiKhi } from './lam-moi';

export function LamMoiNen() {
  const [hien, setHien] = useState(true);
  useEffect(() => { const f = () => setHien(document.visibilityState === 'visible'); f(); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  useLamMoiKhi(hien, 20_000);
  return null;
}
