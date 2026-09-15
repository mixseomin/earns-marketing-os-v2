'use client';

// Tab cấp trang của TRANG CHỦ — chọn tab = đổi ?tab= trên URL để server chỉ đọc dữ liệu của tab đang mở
// (GSC/Gumroad/MailWizz đều là mạng ngoài chậm; đọc cả 8 tab mỗi lượt là tự làm chậm trang chủ).
// Kéo-thả đổi thứ tự pill → cookie `home-tabs` (1 năm), server đọc cookie mà xếp ngay lúc SSR nên F5 không nhấp nháy
// (cùng kiểu cookie `slf2` của Live Orders).
import { useState } from 'react';
import { Tabs, type TabItem } from '@/components/ui';
import { useUrlParam } from '@/lib/use-url-param';

export type HomeTab = 'camp' | 'phu' | 'nguon' | 'hatang' | 'lenh' | 'doanhthu' | 'seo' | 'email' | 'duan';
export const HOME_TAB_MAC_DINH: HomeTab = 'camp';
export const HOME_TABS_COOKIE = 'home-tabs';

export function HomeTabs({ items: goc, right }: { items: TabItem<HomeTab>[]; right?: React.ReactNode }) {
  const [tab, setTab] = useUrlParam('tab', HOME_TAB_MAC_DINH);
  const [items, setItems] = useState(goc);
  const sap = (keys: HomeTab[]) => {
    setItems(keys.map((k) => items.find((t) => t.key === k)!));
    document.cookie = `${HOME_TABS_COOKIE}=${keys.join(',')}; path=/; max-age=${365 * 86400}; samesite=lax`;
  };
  return <Tabs items={items} value={tab as HomeTab} onChange={setTab} right={right} onReorder={sap} />;
}
