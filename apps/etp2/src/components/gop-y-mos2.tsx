'use client';

// HÒM GÓP Ý 💬 CỦA MOS2 + CITY = hòm dùng chung @mos2/gop-y/client (cùng một bản với studio.on.tc, cty.on.tc: gửi · Của tôi · Hỏi đáp,
// trả lời / làm lại / duyệt xong NGAY TRONG HÒM). Gom 25/10/2026: trước đó mos2 chạy một bản viết riêng, xem lại góp ý thì mở tab plays mới
// (anh chửi) trong khi hòm chung đã làm tại chỗ từ 10/10 — hai bản lệch nhau là gốc lỗi. Phần riêng mos2: khung = Drawer của mos2,
// action = lib/actions/gop-y-mos2 (card trên plays `mos2` hoặc `city`), ảnh lên R2 thư mục gop-y, vị trí nút (trái nút ⚙ Tweaks / trên cảnh city).
// Nơi khác mở hòm tại chỗ: window.dispatchEvent(new CustomEvent('gop-y:mo')). Trang có trạng thái DOM không thấy (city 3D) khai window.__nguCanhTrang.
import { useEffect, useRef, useState } from 'react';
import { HomGopY, type HanhDongGopY, type KhungHom } from '@mos2/gop-y/client';
import { Drawer } from '@/components/ui';
import { dsGopYCuaToi, guiGopYMos2, docTraoDoiCard, guiTraoDoiCard } from '@/lib/actions/gop-y-mos2';
import { uploadImage, deleteImage } from '@/lib/actions/uploads';
import { nhip } from '@/lib/nhip';   // tự làm mới chỉ khi tab hiện (12/11/2026)

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
/** tren = nút ở góc phải TRÊN (etp.on.tc: hàng tiêu đề trống, bảng camp chiếm hết mép phải + dòng tổng dính chân — anh 29/10/2026 "nút này để chỗ khác") */
// HUY ĐANG LÀM (anh 12/11/2026 "khi nào Huy đang nhận việc và làm thì icon này chạy chuyển động, xong thì dừng lại, nháy 1 cái" · "cứ realtime, ko phụ thuộc focus"):
// hỏi /etp/huy mỗi 3 giây bất kể cửa sổ có focus; đang làm → nút nhún + viền vàng, vừa xong (đang → không) → nháy xanh một lần rồi đứng yên
const NHIP_HUY = 3000;
function useHuy() {
  const [dang, setDang] = useState(false), [nhay, setNhay] = useState(0), truoc = useRef(false);
  useEffect(() => { let song = true;
    const hoi = async () => { try { const r = await fetch('/etp/huy', { cache: 'no-store' }); if (!r.ok) return; const j = await r.json() as { dang: unknown };
      if (!song) return; const d = !!j.dang; if (truoc.current && !d) setNhay((n) => n + 1); truoc.current = d; setDang(d); } catch { /* mạng chập: lượt sau hỏi lại */ } };
    void hoi(); const t = nhip(hoi, NHIP_HUY); return () => { song = false; t(); }; }, []);
  return { dang, nhay };
}
export function GopYMos2({ hom = 'mos2', tren = false }: { hom?: 'mos2' | 'city'; tren?: boolean }) {
  const huy = useHuy();
  // scale / box-shadow (không dùng transform) để không đè translateY của nút mép phải
  const dong = huy.dang ? { animation: 'huyChay 0.9s ease-in-out infinite', borderColor: '#f59e0b' } : huy.nhay ? { animation: `huyNhay${huy.nhay % 2} 0.7s ease-out 1` } : {};
  const hd: HanhDongGopY = {
    guiGopY: (i) => guiGopYMos2({ ...i, hom }),
    dsGopYCuaToi: () => dsGopYCuaToi(hom),
    docTraoDoi: docTraoDoiCard,
    guiTraoDoi: guiTraoDoiCard,
    taiAnhGopY: (du) => uploadImage(du, 'gop-y'),
    xoaAnhGopY: deleteImage,
  };
  // City: trái cụm nút điều hướng, nổi trên cảnh 3D. (mos2 cũ: right 60 tránh nút ⚙ Tweaks góc phải-dưới — 05/10/2026)
  return <><style>{'@keyframes huyChay{0%,100%{scale:1;box-shadow:0 0 0 0 rgba(245,158,11,.6)}50%{scale:1.12;box-shadow:0 0 0 6px rgba(245,158,11,0)}}'
    + '@keyframes huyNhay0{0%{box-shadow:0 0 0 0 rgba(74,222,128,.9);border-color:#4ade80}100%{box-shadow:0 0 0 12px rgba(74,222,128,0)}}'
    + '@keyframes huyNhay1{0%{box-shadow:0 0 0 0 rgba(74,222,128,.9);border-color:#4ade80}100%{box-shadow:0 0 0 12px rgba(74,222,128,0)}}'}</style>
  <HomGopY ten={hom === 'city' ? 'Thành phố' : 'MOS2'} khoa={hom === 'city' ? 'city' : 'mos2'} hd={hd} Khung={Khung} chonNgan='[data-comp="ui.Drawer"]' chonLoi="[data-loi]"
    // mos2: tab nhỏ ở MÉP PHẢI GIỮA MÀN (anh 29/10/2026 etp "nút này để chỗ khác") — góc phải-dưới đè dòng tổng dính chân của mọi DataTable (+ nút ⚙ Tweaks)
    nutStyle={{ ...(hom === 'city' ? { right: 112, zIndex: 10000 } : tren ? { right: 16, top: 12, bottom: 'auto', minWidth: 32, height: 32, fontSize: 14 } : { right: 0, bottom: 'auto', top: '50%', transform: 'translateY(-50%)', minWidth: 30, width: 30, height: 44, borderRadius: '10px 0 0 10px', borderRight: 'none', fontSize: 15 }), ...dong }} /></>;
}
