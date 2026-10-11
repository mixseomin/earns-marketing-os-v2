'use client';
// Nút "Bỏ" một bài học (admin): qua xác nhận tại chỗ vì bỏ là mất bài học khỏi kinh nghiệm của người đó; lỗi hiện ngay dưới nút.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NutXacNhan } from './nut-xac-nhan';
import { boBaiHocCua } from '@/lib/kinh-nghiem';

export function NutBoBaiHoc({ nguoi, ma }: { nguoi: string; ma: string }) {
  const router = useRouter(); const [dang, chay] = useTransition(); const [loi, setLoi] = useState<string | null>(null);
  return (
    <>
      <NutXacNhan disabled={dang} nhan={dang ? 'Đang bỏ…' : 'Bỏ'} hoi="Bỏ bài học này khỏi kinh nghiệm của người này (không nạp vào lời dặn nữa)."
        onXacNhan={() => chay(async () => { setLoi(null); try { const r = await boBaiHocCua(nguoi, ma); if (!r.ok) setLoi(r.loi ?? 'Máy chủ từ chối.'); router.refresh(); } catch (e) { setLoi(`Không gửi được (${(e as Error).message}).`); } })} />
      {loi && <span className="cty-bao-loi" data-loi>{loi}</span>}
    </>
  );
}
