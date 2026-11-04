'use client';
// NGĂN SẢN XUẤT etp (góp ý #1528 anh 04/11/2026 "thêm drawer sản xuất để bấm vào ko phải mở page mới, xem luôn") — loại 'etp-sx' của EntityDrawerHost (?ed=etp-sx~<mã phim>).
// Bấm đồng hồ sản xuất ở dòng phim (cây camp, tab Phim) → ngăn này; Ctrl/⌘ + bấm vẫn sang tab Sản xuất. Nội dung = ĐÚNG bảng tab Sản xuất (TabDong) khoá vào một phim.
import { Drawer } from '@/components/ui';
import { TabDong } from '@/components/etp-dong';

export function EtpSxDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  return <Drawer onClose={onClose} width={1400} zIndex={300} padding={0}>
    <div className="modal-head"><div><div className="id-line">phim #{id}</div><h2 style={{ margin: 0 }}>Sản xuất</h2></div>
      <a href={`?t=dong&sxq=${id}`} style={{ marginLeft: 'auto', marginRight: 12, fontSize: 12, color: '#60a5fa' }}>mở tab Sản xuất →</a><button className="modal-close" onClick={onClose}>✕</button></div>
    <div style={{ padding: 12 }}><TabDong phim={id} /></div>
  </Drawer>;
}
