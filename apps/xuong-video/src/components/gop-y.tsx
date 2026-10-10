'use client';

// HÒM GÓP Ý STUDIO — giao diện dùng chung @mos2/gop-y/client (cùng một bản với cty.on.tc, gom 10/10/2026). Phần riêng studio:
// khung = Ngan hẹp, nút xv-btn, xem ảnh bằng ngăn chung, ngữ cảnh gom từ .xv-drawer/.xv-loi. Card → mos2.on.tc/p/xuong-video/plays.
import { HomGopY, type KhungHom } from '@mos2/gop-y/client';
import * as hd from '@/lib/gop-y';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';

const Khung: KhungHom = ({ onClose, tieuDe, dau, children }) => <Ngan nho onClose={onClose} tieuDe={tieuDe} dau={dau}>{children}</Ngan>;
const xemAnh = (url: string) => moNgan({ loai: 'xem', url });

export function GopY() {
  return <HomGopY ten="Xưởng video" khoa="studio" hd={hd} Khung={Khung} nut={{ thuong: 'xv-btn', chinh: 'xv-btn chinh' }} xemAnh={xemAnh} chonNgan=".xv-drawer" chonLoi=".xv-loi" />;
}
