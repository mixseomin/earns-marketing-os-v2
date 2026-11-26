'use client';
// Ô WIDGET ETHOPEX DÙNG CHUNG MÃ VỚI etp2 (anh 26/11/2026 "thêm các widget mới giống widget của etp2.on.tc"): KHÔNG chép, KHÔNG nhúng trang —
// gọi thẳng useVeSo của apps/etp2/src/components/etp-tong2-widget.tsx qua alias @etp2/tong2 (apps/web/next.config.mjs, cùng đường với Thành phố #1605).
// Số đọc bằng taiTong2 của etp2 (cùng phiên mos2-session, cùng quyền etp) — mọi ô cùng màn chung MỘT lượt tải (useSoNho 'tong2').
// Kỳ = kỳ riêng của ô (O.ky, chọn trên tiêu đề ô — components/home/chon-ky-o.tsx); chưa đặt = '7' mặc định của etp2 (ngày Ethopex = ngày UTC).
// Cùng widget hai ô hai kỳ vẫn chung một lượt tải: kỳ chỉ lọc trên trình duyệt (useVeSo).
import { useEffect, useRef, useState } from 'react';
import { useVeSo } from '@etp2/tong2';
import { khoangKyO } from './chon-ky-o';

export default function Etp2O({ ma, moc }: { ma: string; moc?: string }) {
  const ve = useVeSo(khoangKyO(moc));
  const ref = useRef<HTMLDivElement | null>(null);
  const [kt, setKt] = useState<{ rong: number; cao: number } | null>(null);
  useEffect(() => {
    const el = ref.current, o = el?.closest('.hm-ob') as HTMLElement | null; if (!el || !o) return;
    const cs = getComputedStyle(o), dem = (a: string, b: string) => (parseFloat(a) || 0) + (parseFloat(b) || 0);
    const doKt = () => setKt({ rong: Math.max(0, o.clientWidth - dem(cs.paddingLeft, cs.paddingRight)), cao: Math.max(0, o.clientHeight - dem(cs.paddingTop, cs.paddingBottom)) });
    doKt(); const ro = new ResizeObserver(doKt); ro.observe(o); return () => ro.disconnect();
  }, []);
  const f = ve[ma];
  return <div ref={ref}>{!f ? <div role="alert" style={{ color: '#f87171', fontSize: 12 }}>widget etp2 "{ma}" không có trong bộ vẽ của etp2 (useVeSo)</div> : kt ? f(kt) : <div className="hm-cho">đang đọc…</div>}</div>;
}
