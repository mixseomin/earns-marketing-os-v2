'use client';
// Làm mới trang (router.refresh) khi đang có việc chạy nền — NỐI ĐUÔI, không chồng: lần sau chỉ hẹn khi lần trước đã dựng xong.
// Trước 12/10/2026 dùng setInterval: trang dựng lâu hơn khoảng hẹn (~130 KB, 1,5–3 s qua đường hầm) → lần làm mới sau huỷ lần trước
// đang dở, giao diện đứng yên mãi ở bước đầu dù lượt đã xong. Một hook cho mọi chỗ cần theo dõi việc đang chạy.
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function useLamMoiKhi(dang: boolean, ms = 1500) {
  const router = useRouter(); const [cho, chuyen] = useTransition();
  useEffect(() => { if (!dang || cho) return; const t = setTimeout(() => chuyen(() => router.refresh()), ms); return () => clearTimeout(t); }, [dang, cho, ms, router]);
}
