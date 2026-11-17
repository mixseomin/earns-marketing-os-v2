'use client';

// HÒM GÓP Ý 💬 CỦA ETP2 = hòm dùng chung @mos2/gop-y/client theo chuẩn packages/gop-y/CHUAN.md (rung "AI đang làm" gy-rung, số đỏ chờ ý kiến,
// nạp 60 giây khi tab hiện — tất cả ở gói, etp2 không giữ hiệu ứng / nhịp riêng nữa; anh 17/11/2026 "Chuẩn hoá toàn bộ phần gopy").
// Phần riêng etp2: khung = Drawer, action = lib/actions/gop-y-mos2 (hòm mos2, lọc card gửi từ etp / etp2, rung theo hàng việc của Huy), vị trí nút góc phải TRÊN
// (anh 29/10/2026 "nút này để chỗ khác": bảng camp chiếm hết mép phải + dòng tổng dính chân).
import { HomGopY, type KhungHom } from '@mos2/gop-y/client';
import { Drawer } from '@/components/ui';
import * as hd from '@/lib/actions/gop-y-mos2';

const Khung: KhungHom = ({ onClose, tieuDe, dau, children }) => (
  <Drawer onClose={onClose} width={560} padding={18}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      <b style={{ fontSize: 14 }}>{tieuDe}</b>
      <span style={{ marginLeft: 'auto' }}>{dau}</span>
      <button type="button" onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 15 }}>✕</button>
    </div>
    {children}
  </Drawer>
);

export function GopYMos2() {
  return <HomGopY ten="MOS2" khoa="mos2" hd={hd} Khung={Khung} chonNgan='[data-comp="ui.Drawer"]' chonLoi="[data-loi]"
    nutStyle={{ right: 16, top: 12, bottom: 'auto', minWidth: 32, height: 32, fontSize: 14 }} />;
}
