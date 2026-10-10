'use client';
// Hòm góp ý 💬 của cty.on.tc = hòm dùng chung @mos2/gop-y/client (cùng bản với studio: gửi, Của tôi, Hỏi đáp, trả lời /
// làm lại / duyệt xong ngay trong hòm). Phần riêng cty: khung = Drawer của cty, nút cty-btn, ngữ cảnh gom từ .cty-drawer.
import { HomGopY, type KhungHom } from '@mos2/gop-y/client';
import * as hd from '@/lib/gop-y';
import { Drawer } from './drawer';

const Khung: KhungHom = ({ onClose, tieuDe, dau, children }) => (
  <Drawer title={tieuDe} onClose={onClose}><div className="cty-gopy-dau">{dau}</div>{children}</Drawer>
);

export function GopY() {
  return <HomGopY ten="Công ty" khoa="cty" hd={hd} Khung={Khung} nut={{ thuong: 'cty-btn', chinh: 'cty-btn chinh' }} chonNgan=".cty-drawer" chonLoi=".cty-thu-loi, .cty-bao-loi" />;
}
