'use client';
// Nút BẬT/TẮT cột "Tự làm" (anh 14/10/2026 "tao cần bật tắt cái này"): admin bấm → lưu cờ ở sổ dữ liệu (worker/nhip.mjs datBat), có hiệu lực
// ngay — nhịp box bỏ qua người bị tắt, việc chạy trên Mac hỏi cờ trước mỗi lượt. Lỗi hiện đỏ ngay dưới nút. Không phải admin: chỉ thấy chữ.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { batTatNhip } from '@/lib/nhip-chinh';

export function NutTuLam({ id, bat, admin }: { id: string; bat: boolean; admin: boolean }) {
  const [cho, chuyen] = useTransition(); const [loi, setLoi] = useState(''); const router = useRouter();
  if (!admin) return <span className={bat ? 'cty-bao-ok' : 'cty-muted'}>{bat ? 'đang bật' : 'đang tắt'}</span>;
  const doi = () => chuyen(async () => { setLoi(''); const r = await batTatNhip(id, !bat); if (!r.ok) setLoi(r.loi ?? 'Máy chủ từ chối.'); router.refresh(); });
  return (
    <span>
      <button type="button" className="cty-btn cty-nho" disabled={cho} onClick={doi} aria-pressed={bat} title={bat ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}>
        {cho ? 'Đang lưu…' : bat ? '● Bật' : '○ Tắt'}
      </button>
      {loi && <span className="cty-bao-loi" data-loi="">{loi}</span>}
    </span>
  );
}
