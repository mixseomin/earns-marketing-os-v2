'use client';
// MẢNH CỦA cty.on.tc trong ô widget /home (nhóm M — Agents công ty AI). cty tự vẽ và tự ghi (bật / tắt, đổi mô hình, chỉnh lịch là server action của cty),
// /home chỉ xếp chỗ → không có bản thứ hai của bảng nhân sự, số luôn là số của cty.on.tc.
// Giao kèo với cty (repo cty: src/app/layout.tsx NHUNG_SCRIPT + src/components/ngan/links.tsx):
//   · TÊN KHUNG `hm-o-<dark|light>` = ô widget, `hm-tr-<dark|light>` = ngăn trang nhúng → cty bỏ thanh đầu, theo màu sáng / tối của MOS2;
//   · trong ô, link sang màn / thực thể khác cty gửi lên bằng postMessage { nguon: 'cty', mo: '/duong' } → /home mở ở ngăn trang nhúng (components/home/trang.tsx).
import { useEffect, useState } from 'react';
import { CTY_GOC } from '@/lib/cty-duong';

/** màu đang dùng của MOS2 (data-theme trên <html>); null tới khi gắn xong để máy chủ và trình duyệt vẽ giống nhau. Đổi màu → khung nạp lại theo màu mới. */
export function useGiaoMos2(): 'dark' | 'light' | null {
  const [giao, datGiao] = useState<'dark' | 'light' | null>(null);
  useEffect(() => {
    const doc = () => datGiao(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    doc();
    const mo = new MutationObserver(doc); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return giao;
}
/** đường mở trong ngăn trang nhúng có phải trang của cty không */
export const laTrangCty = (v: string) => v.startsWith(`${CTY_GOC}/`);

export function ManhCty({ duong, ten, thap }: { duong: string; ten: string; thap?: boolean }) {
  const giao = useGiaoMos2();
  if (!giao) return <div className="hm-cho">Đang mở {ten}…</div>;
  return <iframe key={giao} name={`hm-o-${giao}`} src={`${CTY_GOC}${duong}`} title={ten} loading="lazy" className={`hm-manh${thap ? ' hm-manh-thap' : ''}`} />;
}
