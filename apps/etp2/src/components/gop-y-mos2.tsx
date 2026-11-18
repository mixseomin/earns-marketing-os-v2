'use client';

// HÒM GÓP Ý 💬 CỦA ETP2 = hòm dùng chung @mos2/gop-y/client theo chuẩn packages/gop-y/CHUAN.md (rung "AI đang làm" gy-rung, số đỏ chờ ý kiến,
// nạp 60 giây khi tab hiện — tất cả ở gói, etp2 không giữ hiệu ứng / nhịp riêng nữa; anh 17/11/2026 "Chuẩn hoá toàn bộ phần gopy").
// Phần riêng etp2: khung = Drawer, action = lib/actions/gop-y-mos2 (hòm mos2, lọc card gửi từ etp / etp2, rung theo hàng việc của Huy), vị trí nút góc phải TRÊN
// (anh 29/10/2026 "nút này để chỗ khác": bảng camp chiếm hết mép phải + dòng tổng dính chân).
// Dải đầu hòm ghi TÊN kỹ sư AI phụ trách phòng ("Huy đang làm: …" / "Huy đang rảnh") thay chữ "AI" của gói — anh 18/11/2026 góp ý #1673
// "Show tên con AI đang quản lý xử lý các tasks trong phòng tương ứng !!". Số lấy từ CHÍNH lượt nạp 60 giây của gói (bọc hd.demGopY, không nạp thêm);
// gói chưa có trường tên kỹ sư (packages/gop-y ngoài phần Ethopex) → dải của gói ẩn trong khung etp2, dải tên dưới đây đứng đúng chỗ đó.
import { createContext, useContext, useMemo, useState } from 'react';
import { HomGopY, type KhungHom } from '@mos2/gop-y/client';
import { Drawer } from '@/components/ui';
import * as hd from '@/lib/actions/gop-y-mos2';

/** Kỹ sư AI phụ trách góp ý etp / etp2 (Phòng Ethopex) — hàng việc etp-sua.json mà demGopY đọc là hàng của người này. */
const KY_SU_ETP = 'Huy';
type Dem = Awaited<ReturnType<typeof hd.demGopY>>;
const DemCtx = createContext<Dem>({ working: 0, dangLam: [], can_y_kien: 0, choYKien: [] });

/** Dải "<tên> đang làm / đang rảnh" — cùng chỗ, cùng kiểu dải đầu hòm của gói. */
function DaiKySu() {
  const dem = useContext(DemCtx);
  const viec = dem.dangLam.map((v) => v.replace(new RegExp(`^${KY_SU_ETP}\\s+`), ''));
  return (
    <div data-etp-ky-su="" title={`Kỹ sư AI phụ trách góp ý Ethopex: ${KY_SU_ETP} · nạp lại mỗi 60 giây`} style={{ fontSize: 11.5, padding: '5px 8px', marginBottom: 8, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: dem.working ? 'var(--fg-2)' : 'var(--fg-3)' }}>
      {dem.working ? <>🔧 <b>{KY_SU_ETP} đang làm:</b> {viec.join(' · ') || `${dem.working} việc`}</> : `🤖 ${KY_SU_ETP} đang rảnh`}
    </div>
  );
}

const Khung: KhungHom = ({ onClose, tieuDe, dau, children }) => (
  <Drawer onClose={onClose} width={560} padding={18}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      <b style={{ fontSize: 14 }}>{tieuDe}</b>
      <span style={{ marginLeft: 'auto' }}>{dau}</span>
      <button type="button" onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 15 }}>✕</button>
    </div>
    <style>{'.gy-etp2 [data-gy-dang-lam]{display:none}'}</style>
    <DaiKySu />
    <div className="gy-etp2">{children}</div>
  </Drawer>
);

export function GopYMos2() {
  const [dem, setDem] = useState<Dem>({ working: 0, dangLam: [], can_y_kien: 0, choYKien: [] });
  // bọc demGopY: gói vẫn tự nạp 60 giây như chuẩn, etp2 chỉ giữ lại bản số vừa nạp cho dải tên kỹ sư
  const hd2 = useMemo(() => ({ ...hd, demGopY: async () => { const d = await hd.demGopY(); setDem(d); return d; } }), []);
  return (
    <DemCtx.Provider value={dem}>
      <HomGopY ten="MOS2" khoa="mos2" hd={hd2} Khung={Khung} chonNgan='[data-comp="ui.Drawer"]' chonLoi="[data-loi]"
        nutStyle={{ right: 16, top: 12, bottom: 'auto', minWidth: 32, height: 32, fontSize: 14 }} />
    </DemCtx.Provider>
  );
}
