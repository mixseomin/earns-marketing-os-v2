'use client';
// Nút BẬT/TẮT cột "Tự làm" (anh 14/10/2026 "tao cần bật tắt cái này"): admin bấm → lưu cờ ở sổ dữ liệu (worker/nhip.mjs datBat), có hiệu lực
// ngay — nhịp box bỏ qua người bị tắt, việc chạy trên Mac hỏi cờ trước mỗi lượt. Lỗi hiện đỏ ngay dưới nút. Không phải admin: chỉ thấy chữ.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { batTatNhip } from '@/lib/nhip-chinh';

export function NutTuLam({ id, bat, admin }: { id: string; bat: boolean; admin: boolean }) {
  const [cho, chuyen] = useTransition(); const [loi, setLoi] = useState(''); const router = useRouter();
  const nhan = bat ? 'Tự làm đang bật — bấm để tắt' : 'Tự làm đã tắt — bấm để bật';
  // chỉ một chấm, không chữ (anh 14/10/2026): xanh nháy = đang bật, xám = đã tắt; admin bấm vào chấm để đổi
  if (!admin) return <span className={`cty-den${bat ? ' bat' : ''}`} role="img" aria-label={bat ? 'Tự làm đang bật' : 'Tự làm đã tắt'} title={bat ? 'Tự làm đang bật (việc máy chạy theo lịch của máy)' : 'Tự làm đã tắt'} />;
  const doi = () => chuyen(async () => { setLoi(''); const r = await batTatNhip(id, !bat); if (!r.ok) setLoi(r.loi ?? 'Máy chủ từ chối.'); router.refresh(); });
  return (
    <span className="cty-den-o">
      <button type="button" role="switch" aria-checked={bat} aria-label={nhan} title={nhan} className="cty-den-nut" disabled={cho} onClick={doi}><span className={`cty-den${bat ? ' bat' : ''}`} /></button>
      {loi && <span className="cty-bao-loi" data-loi="">{loi}</span>}
    </span>
  );
}
