'use client';

// Tab cấp trang của TRANG CHỦ — chọn tab = đổi ?tab= trên URL để server chỉ đọc dữ liệu của tab đang mở
// (GSC/Gumroad/MailWizz đều là mạng ngoài chậm; đọc cả 6 tab mỗi lượt là tự làm chậm trang chủ).
import { Tabs, type TabItem } from '@/components/ui';
import { useUrlParam } from '@/lib/use-url-param';

export type HomeTab = 'camp' | 'phu' | 'nguon' | 'hatang' | 'doanhthu' | 'seo' | 'email' | 'duan';
export const HOME_TAB_MAC_DINH: HomeTab = 'camp';

export function HomeTabs({ items, right }: { items: TabItem<HomeTab>[]; right?: React.ReactNode }) {
  const [tab, setTab] = useUrlParam('tab', HOME_TAB_MAC_DINH);
  return <Tabs items={items} value={tab as HomeTab} onChange={setTab} right={right} />;
}
