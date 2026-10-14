'use client';
// CHẤM BẬT/TẮT dùng chung (anh 14/10/2026 "tao cần bật tắt cái này", "đổi chữ sang icon xanh nháy", "sao trên page đó không set tắt bật được"):
// ● xanh nháy = đang bật · ○ xám = đã tắt · viền cam đứt = đã bấm, máy chưa áp. Admin bấm chấm để đổi; việc lớn (tắt mọi việc máy của một người)
// hỏi lại ngay cạnh chấm (NutXacNhan dùng chung) trước khi làm. Ba loại muc: `nhip:<người>` nhịp cty (worker/nhip.mjs datBat) · `nguoi:<người>` mọi việc máy người đó ·
// `viec:<máy>:<mã>` một việc máy (worker/lich-may.mjs datBatMay). Lỗi hiện đỏ ngay cạnh chấm. Không phải admin: chỉ thấy chấm.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { batTatNhip, batTatMay } from '@/lib/nhip-chinh';
import { NutXacNhan } from './nut-xac-nhan';

export function NutTuLam({ muc, bat, admin, cho: choAp = false, hoi, khoa }: {
  muc: string; bat: boolean; admin: boolean;
  cho?: boolean;                                        // đã bấm, máy chưa áp
  hoi?: string;                                         // câu hỏi lại trước khi TẮT (vd "Tắt 34 việc máy của Lan?")
  khoa?: string;                                        // không cho tắt từ bảng, kèm lý do (đường nhận lệnh)
}) {
  const [dang, chuyen] = useTransition(); const [loi, setLoi] = useState(''); const router = useRouter();
  const trang = `${bat ? 'đang bật' : 'đã tắt'}${choAp ? ' — chờ máy áp' : ''}`;
  const cham = <span className={`cty-den${bat ? ' bat' : ''}${choAp ? ' cho' : ''}`} />;
  if (!admin || (khoa && bat)) return <span role="img" aria-label={trang} title={khoa ? `${trang} — ${khoa}` : trang}>{cham}</span>;
  const lam = () => chuyen(async () => {
    setLoi(''); const [loai, ...con] = muc.split(':'); const ma = con.join(':');
    const r = loai === 'nhip' ? await batTatNhip(ma, !bat) : await batTatMay(muc, !bat);
    if (!r.ok) setLoi(r.loi ?? 'Máy chủ từ chối.'); router.refresh();
  });
  return (
    <span className="cty-den-o">
      {bat && hoi   // tắt việc lớn: hỏi lại bằng nút xác nhận dùng chung (Esc / bấm ra ngoài đóng — #1358)
        ? <NutXacNhan lop="cty-den-nut" nhan={cham} hoi={hoi} nhanXacNhan="Tắt" disabled={dang} title={`${trang} — bấm để tắt`} onXacNhan={lam} vaiTro={{ role: 'switch', 'aria-checked': bat, 'aria-label': `${trang} — bấm để tắt` }} />
        : <button type="button" role="switch" aria-checked={bat} aria-label={`${trang} — bấm để ${bat ? 'tắt' : 'bật'}`} title={`${trang} — bấm để ${bat ? 'tắt' : 'bật'}`} className="cty-den-nut" disabled={dang} onClick={lam}>{cham}</button>}
      {loi && <span className="cty-bao-loi" data-loi="">{loi}</span>}
    </span>
  );
}
