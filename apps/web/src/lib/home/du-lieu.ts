// DỮ LIỆU DÙNG CHUNG của trang chủ cũ (/) và /home — MỘT chỗ đọc nên hai trang luôn ra CÙNG con số (anh 20/11/2026 "số liệu phải khớp").
// Bọc bằng React cache(): trong một lượt vẽ, nhiều widget cùng cần một nguồn (vd 7 widget đọc sổ phủ) chỉ tốn MỘT lần truy vấn.
import { cache } from 'react';
import { getPhu, listPhuProjects } from '@/lib/phu';
import { getRevenueByDay } from '@/lib/revenue/by-day';
import { listProjects, getAiUsageSummary } from '@/lib/data';
import { BACKLINK_SITES } from '@/lib/backlink-sites';

export const docDuAn = cache(() => listProjects());
export const docDuAnPhu = cache(() => listPhuProjects());
export const docPhu = cache((pid: string, days: number) => getPhu(pid, days));
export const docThuTheoNgay = cache((soNgay: number) => getRevenueByDay(soNgay));
export const docChiAi = cache(() => getAiUsageSummary());

export const KY_PHU = [7, 30, 90] as const;
export const kyPhu = (raw: string | undefined): number => (KY_PHU.includes(Number(raw) as 7) ? Number(raw) : 7);

/** Ngữ cảnh sổ phủ của một lượt xem: dự án (?p, không hợp lệ thì dự án đầu), kỳ (?days), sổ phủ, host lander. */
export const docNguPhu = cache(async (p: string | undefined, days: number) => {
  const duAnPhu = await docDuAnPhu();
  const pid = duAnPhu.includes(p ?? '') ? String(p) : duAnPhu[0];
  const phu = pid ? await docPhu(pid, days) : null;
  const host = phu?.landers[0]?.host.replace(/^[a-z]+\./, '') ?? BACKLINK_SITES.find((s) => s.slug === pid)?.domain ?? '';
  return { duAnPhu, pid, phu, host, days };
});
export type NguPhu = Awaited<ReturnType<typeof docNguPhu>>;
