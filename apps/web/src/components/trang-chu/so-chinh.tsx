// NĂM SỐ ĐẦU TRANG CHỦ — tính MỘT chỗ cho trang chủ cũ (HomeStats, bấm đổi tab) và widget A1 của /home (bấm đổi màn): cùng công thức nên cùng con số.
import type { StatCard } from '@/components/ui';
import type { HomeTab } from '@/lib/home-tabs';
import type { RevenueByDay } from '@/lib/revenue/by-day';
import type { PhuData } from '@/lib/phu-shared';
import { phuDo } from '@/lib/phu-shared';

const usd = (v: number) => (v ? `$${v.toFixed(2)}` : '—');
const pct = (a: number, b: number, so = 0) => (b ? `${((a / b) * 100).toFixed(so)}%` : '—');

export type TheSoChinh = StatCard & { tab: HomeTab };
export function theSoChinh({ byDay, phu, pid, days, soDuAn }: { byDay: RevenueByDay; phu: PhuData | null; pid: string | undefined; days: number; soDuAn: number }): { the: TheSoChinh[]; campChay: number; hong: number } {
  const thu30 = byDay.rows.reduce((a, r) => a + r.amount, 0);
  const campChay = phu?.camp.filter((c) => c.trangThai === 'chay').length ?? 0;
  const hong = phu ? phuDo(phu) : 0;
  return { campChay, hong, the: [
    { key: 'thu', tab: 'doanhthu', label: 'Doanh thu 30 ngày', value: usd(thu30), sub: byDay.errors.length ? <span style={{ color: 'var(--danger)' }}>{byDay.errors.length} nguồn lỗi</span> : `${byDay.scannedNetworks.length} mạng đã quét` },
    { key: 'chi', tab: 'camp', label: `Chi QC ${days} ngày`, value: usd(phu?.tong.chi ?? 0), color: phu && phu.tong.chi > phu.tong.revenue ? 'var(--danger)' : undefined, sub: phu ? `về ${usd(phu.tong.revenue)} · ${pid}` : 'chưa có sổ phủ' },
    { key: 'pheu', tab: 'camp', label: 'View → click → out', value: phu ? `${phu.tong.view} → ${phu.tong.click} → ${phu.tong.out}` : '—', sub: phu ? `CTR ${pct(phu.tong.click, phu.tong.view, 1)} · cổng ${pct(phu.tong.gate, phu.tong.view)}` : undefined },
    { key: 'signup', tab: 'phu', label: 'Signup', value: phu?.tong.signup ?? '—', sub: phu?.tong.click ? `${((phu.tong.signup / phu.tong.click) * 1000).toFixed(1)} / 1k click` : undefined },
    { key: 'camp', tab: hong ? 'hatang' : 'camp', label: 'Camp chạy', value: campChay, color: hong ? 'var(--danger)' : undefined, sub: hong ? `${hong} adapter/lander đỏ` : `${soDuAn} dự án` },
  ] };
}
