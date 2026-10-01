'use client';
import { useEffect } from 'react';
import { bao, type MonDo } from './do';

/** Sự kiện purchase — bắn MỘT lần mỗi đơn (tải lại trang cảm ơn không đếm đôi). */
export function BaoMua({ so, tong, mon }: { so: string; tong: number; mon: MonDo[] }) {
  useEffect(() => {
    const k = `da-bao-${so}`;
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch { /* không có bộ nhớ: vẫn bắn */ }
    bao('purchase', { transaction_id: so, value: tong, items: mon });
  }, [so, tong, mon]);
  return null;
}
