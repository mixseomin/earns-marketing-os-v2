'use client';
// Nút "Chạy lại ngay" trên việc máy trễ / lỗi (tab Dây chuyền, ngăn quy trình): xác nhận tại chỗ (NutXacNhan — lệnh này đăng công khai lên tài
// khoản thật), gửi lệnh vào hàng chờ, rồi NGAY DƯỚI NÚT hiện trạng thái lệnh: chờ máy nhận → đang chạy → xong / lỗi gì (đủ câu máy báo).
// Trong lúc chờ / chạy thì làm mới trang mỗi 5 giây (useLamMoiKhi) để trạng thái tự đổi, không phải F5.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NutXacNhan } from './nut-xac-nhan';
import { Gio } from './gio';
import { useLamMoiKhi } from './lam-moi';
import { guiLenh } from '@/lib/lenh-may';

export type LenhHien = { hien: 'cho' | 'dang' | 'xong' | 'loi' | 'ngu' | 'chet'; luc: string; nhan_luc?: string; xong_luc?: string; ket?: string } | null;

export function NutChayLai({ lenh, ten, may, truoc, nhan = 'Chạy lại ngay' }: { lenh: string; ten: string; may: string; truoc: LenhHien; nhan?: string }) {
  const router = useRouter(); const [dang, gui] = useTransition();
  const [loi, setLoi] = useState<string | null>(null);
  const cho = truoc && (truoc.hien === 'cho' || truoc.hien === 'dang');
  useLamMoiKhi(!!cho || dang, 5000);
  const chay = () => gui(async () => {
    setLoi(null);
    try { const r = await guiLenh(lenh); if (!r.ok) setLoi(r.loi ?? 'Máy chủ từ chối, không rõ lý do.'); router.refresh(); }
    catch (e) { setLoi(`Không gửi được (${(e as Error).message}). Tải lại trang rồi bấm lại.`); }
  });
  const T = ({ iso }: { iso?: string }) => <Gio iso={iso} ngay={false} giay={false} mui={false} />;
  return (
    <span className="cty-chay-lai">
      <NutXacNhan disabled={dang || !!cho} nhan={dang ? 'Đang gửi…' : truoc?.hien === 'cho' ? 'Chờ máy nhận…' : truoc?.hien === 'dang' ? 'Đang chạy…' : nhan} onXacNhan={chay}
        hoi={<>{ten} NGAY trên {may} (không tốn tiền). Máy nhận lệnh trong ≤ 1 phút{lenh.startsWith('video:') ? '; nền đã đăng hôm nay thì máy chỉ báo lại, không đăng thêm' : ''}.</>} />
      {loi ? <span className="cty-bao-loi" data-loi>{loi}</span>
        : truoc && <span className={truoc.hien === 'xong' ? 'cty-bao-ok' : ['loi', 'ngu', 'chet'].includes(truoc.hien) ? 'cty-bao-loi' : 'cty-muted cty-nho'} data-loi={['loi', 'ngu', 'chet'].includes(truoc.hien) ? '' : undefined}>
          {truoc.hien === 'cho' && <>Đã gửi <T iso={truoc.luc} /> — chờ {may} nhận (≤ 1 phút)</>}
          {truoc.hien === 'ngu' && <>Gửi <T iso={truoc.luc} /> mà {may} chưa nhận sau 5 phút — máy đang ngủ / tắt? Bấm lại khi máy thức.</>}
          {truoc.hien === 'dang' && <>{may} đang chạy (nhận <T iso={truoc.nhan_luc} />)</>}
          {truoc.hien === 'chet' && <>{may} nhận <T iso={truoc.nhan_luc} /> nhưng không báo về sau 30 phút.</>}
          {truoc.hien === 'xong' && <>Xong <T iso={truoc.xong_luc} />: {truoc.ket}</>}
          {truoc.hien === 'loi' && <>Lỗi <T iso={truoc.xong_luc} />: {truoc.ket}</>}
        </span>}
    </span>
  );
}
