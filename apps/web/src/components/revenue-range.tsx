'use client';

// Bộ lọc khung thời gian của /revenue. Đây là control DUY NHẤT cho cả trang:
// đổi chip → đổi ?days= → server render lại cả AdSense lẫn lịch doanh thu.
// (Trước đây AdSense cứng 30 ngày còn lịch cứng 120 ngày → hai khối nói hai
// khoảng khác nhau trên cùng một màn hình.)

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FilterChips } from './ui';

export const RANGES = [7, 30, 90, 365, 0] as const;

export function RevenueRange({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <FilterChips
      value={String(value)}
      onChange={(v) => {
        const next = new URLSearchParams(params.toString());
        if (v === '30') next.delete('days'); else next.set('days', v);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
      options={[
        { value: '7', label: '7N', title: '7 ngày gần nhất' },
        { value: '30', label: '30N', title: '30 ngày gần nhất' },
        { value: '90', label: '90N', title: '90 ngày gần nhất' },
        { value: '365', label: '1 năm', title: '365 ngày gần nhất' },
        { value: '0', label: 'Toàn bộ', title: 'Toàn bộ lịch sử' },
      ]}
    />
  );
}
