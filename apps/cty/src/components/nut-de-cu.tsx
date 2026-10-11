'use client';
// Ký / bác đề cử bổ nhiệm (admin). Ký là đổi người giữ vai → xác nhận tại chỗ; lỗi hiện ngay dưới nút.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NutXacNhan } from './nut-xac-nhan';
import { kyDeCuCua } from '@/lib/bo-nhiem';

export function NutDeCu({ khoa, id, nguoi }: { khoa: string; id: string; nguoi: string }) {
  const router = useRouter(); const [dang, chay] = useTransition(); const [loi, setLoi] = useState<string | null>(null);
  const ky = (dongY: boolean) => chay(async () => { setLoi(null); try { const r = await kyDeCuCua(khoa, id, dongY); if (!r.ok) setLoi(r.loi ?? 'Máy chủ từ chối.'); router.refresh(); } catch (e) { setLoi(`Không gửi được (${(e as Error).message}).`); } });
  return (
    <span className="cty-thu-nut">
      <NutXacNhan chinh disabled={dang} nhan="Ký bổ nhiệm" hoi={`Bổ nhiệm ${nguoi} giữ vai này từ lượt sau (ghi sổ bổ nhiệm, đổi lại được bằng một đề cử khác).`} onXacNhan={() => ky(true)} />
      <NutXacNhan disabled={dang} nhan="Bác" hoi="Bác đề cử này — người đang giữ vai giữ nguyên." onXacNhan={() => ky(false)} />
      {loi && <span className="cty-bao-loi" data-loi>{loi}</span>}
    </span>
  );
}
