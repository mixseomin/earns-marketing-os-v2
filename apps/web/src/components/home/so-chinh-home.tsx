'use client';
// Widget A1 của /home — cùng năm thẻ số với trang chủ cũ (components/trang-chu/so-chinh.tsx tính), bấm thẻ nào là sang MÀN tương ứng (trang chủ cũ: sang tab).
import { useRouter, useSearchParams } from 'next/navigation';
import { StatsStrip } from '@/components/ui';
import type { TheSoChinh } from '@/components/trang-chu/so-chinh';
import { MAN } from '@/lib/home/so';

const MAN_CUA_TAB: Record<string, string> = { doanhthu: 'tien', camp: 'camp', phu: 'hatang', nguon: 'hatang', hatang: 'hatang' };

export function SoChinhHome({ the }: { the: TheSoChinh[] }) {
  const router = useRouter(), sp = useSearchParams();
  const toi = (man: string) => { const q = new URLSearchParams(sp?.toString()); q.set('man', man); router.push(`/home?${q.toString()}`); };
  return (
    <StatsStrip minColWidth={150} cards={the.map(({ tab, ...c }) => {
      const man = MAN.find((m) => m.id === MAN_CUA_TAB[tab]);
      return { ...c, onClick: man ? () => toi(man.id) : undefined, title: man ? `Mở màn ${man.ten}` : undefined };
    })} />
  );
}
