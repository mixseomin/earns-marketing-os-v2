'use client';

// Dãy số trang chủ — bấm thẻ nào là nhảy sang tab tương ứng (anh yêu cầu 16/09/2026). Client vì onClick;
// dữ liệu thẻ đã tính sẵn ở server, đây chỉ gắn tab đích + đổi ?tab=.
import { StatsStrip, type StatCard } from '@/components/ui';
import { useUrlParam } from '@/lib/use-url-param';
import { HOME_TAB_MAC_DINH, type HomeTab } from '@/lib/home-tabs';

export function HomeStats({ cards }: { cards: (StatCard & { tab: HomeTab })[] }) {
  const [tab, setTab] = useUrlParam('tab', HOME_TAB_MAC_DINH);
  return <StatsStrip minColWidth={150} cards={cards.map((c) => ({ ...c, active: c.tab === tab, onClick: () => setTab(c.tab), title: c.title ?? `Mở tab ${c.tab}` }))} />;
}
