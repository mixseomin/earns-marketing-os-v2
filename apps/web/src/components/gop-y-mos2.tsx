'use client';

// HÒM GÓP Ý 💬 CỦA MOS2 + CITY = hòm dùng chung @mos2/gop-y/client (cùng một bản với studio.on.tc, cty.on.tc: gửi · Của tôi · Hỏi đáp,
// trả lời / làm lại / duyệt xong NGAY TRONG HÒM). Gom 25/10/2026: trước đó mos2 chạy một bản viết riêng, xem lại góp ý thì mở tab plays mới
// (anh chửi) trong khi hòm chung đã làm tại chỗ từ 10/10 — hai bản lệch nhau là gốc lỗi. Phần riêng mos2: khung = Drawer của mos2,
// action = lib/actions/gop-y-mos2 (card trên plays `mos2` hoặc `city`), ảnh lên R2 thư mục gop-y, vị trí nút (trái nút ⚙ Tweaks / trên cảnh city).
// Nơi khác mở hòm tại chỗ: window.dispatchEvent(new CustomEvent('gop-y:mo')). Trang có trạng thái DOM không thấy (city 3D) khai window.__nguCanhTrang.
import { HomGopY, type HanhDongGopY, type KhungHom } from '@mos2/gop-y/client';
import { Drawer } from '@/components/ui';
import { dsGopYCuaToi, guiGopYMos2, docTraoDoiCard, guiTraoDoiCard } from '@/lib/actions/gop-y-mos2';
import { uploadImage, deleteImage } from '@/lib/actions/uploads';

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

/** hom = hòm nhận góp ý: 'mos2' (mặc định) · 'city' (city.on.tc — card về plays project city, xử bằng /tasks-city). */
export function GopYMos2({ hom = 'mos2' }: { hom?: 'mos2' | 'city' }) {
  const hd: HanhDongGopY = {
    guiGopY: (i) => guiGopYMos2({ ...i, hom }),
    dsGopYCuaToi: () => dsGopYCuaToi(hom),
    docTraoDoi: docTraoDoiCard,
    guiTraoDoi: guiTraoDoiCard,
    taiAnhGopY: (du) => uploadImage(du, 'gop-y'),
    xoaAnhGopY: deleteImage,
  };
  // right 60 (mos2): góc phải-dưới là nút ⚙ Tweaks (z 2147483645) — trùng chỗ thì ⚙ che kín 💬 (05/10/2026). City: trái cụm nút điều hướng, nổi trên cảnh 3D.
  return <HomGopY ten={hom === 'city' ? 'Thành phố' : 'MOS2'} khoa={hom === 'city' ? 'city' : 'mos2'} hd={hd} Khung={Khung} chonNgan='[data-comp="ui.Drawer"]' chonLoi="[data-loi]"
    nutStyle={hom === 'city' ? { right: 112, zIndex: 10000 } : { right: 60 }} />;
}
