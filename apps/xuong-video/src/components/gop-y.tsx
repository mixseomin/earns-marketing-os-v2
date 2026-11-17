'use client';

// HÒM GÓP Ý STUDIO — giao diện dùng chung @mos2/gop-y/client (cùng một bản với cty.on.tc, gom 10/10/2026). Phần riêng studio:
// khung = Ngan hẹp, nút xv-btn, xem ảnh bằng ngăn chung, ngữ cảnh gom từ .xv-drawer/.xv-loi. Card → mos2.on.tc/p/xuong-video/plays.
import { useEffect, useState } from 'react';
import { HomGopY, type KhungHom } from '@mos2/gop-y/client';
import * as hd from '@/lib/gop-y';
import { nhipKySu } from '@/lib/ky-su-nhip';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';

const Khung: KhungHom = ({ onClose, tieuDe, dau, children }) => <Ngan nho onClose={onClose} tieuDe={tieuDe} dau={dau}>{children}</Ngan>;
const xemAnh = (url: string) => moNgan({ loai: 'xem', url });

/** Nhãn nhịp Vinh ngay trên nút 💬 (anh 17/11/2026 "trong studio đéo biết bao giờ nó chạy"): rảnh + lượt kế · đang xử card nào · im bất thường. Đọc lại mỗi 30 giây. */
function NhipKySu() {
  const [n, setN] = useState<Awaited<ReturnType<typeof nhipKySu>>>(null);
  useEffect(() => { const doc = () => void nhipKySu().then(setN).catch(() => {}); doc(); const t = setInterval(doc, 30000); return () => clearInterval(t); }, []);
  if (!n) return null;
  return (
    <div title="Kỹ sư tự động của hòm góp ý studio (Vinh) — mỗi 5 phút tự nhận card cũ nhất, sửa, deploy, nộp Review. Bấm để mở hòm."
      onClick={() => window.dispatchEvent(new Event('gop-y:mo'))}
      style={{ position: 'fixed', right: 16, bottom: 62, zIndex: 60, maxWidth: 420, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 11.5,
        background: 'var(--bg-2, #16181d)', border: `1px solid ${n.canhBao ? 'var(--red, #f85149)' : 'var(--line, #333)'}`, color: n.canhBao ? 'var(--red, #f85149)' : 'var(--fg-2, #ccc)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxShadow: '0 2px 8px rgba(0,0,0,.3)' }}>
      {n.chu}
    </div>
  );
}

export function GopY() {
  return <>
    <NhipKySu />
    <HomGopY ten="Xưởng video" khoa="studio" hd={hd} Khung={Khung} nut={{ thuong: 'xv-btn', chinh: 'xv-btn chinh' }} xemAnh={xemAnh} chonNgan=".xv-drawer" chonLoi=".xv-loi" />
  </>;
}
