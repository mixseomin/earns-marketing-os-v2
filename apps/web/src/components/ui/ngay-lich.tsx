'use client';
// NGÀY CÓ LỊCH — rê chuột vào một ngày trong bảng thì bung lịch tháng nhỏ: khoảng từ hôm nay tới ngày đó tô nhẹ, ngày đó
// có chấm màu, dưới ghi "còn N ngày" / "quá N ngày". Anh chốt card #1133 (06/10/2026): đọc "02/11" không hình dung được còn
// bao xa, lịch thì nhìn ra ngay. Lưới tháng = MiniMonth dùng chung của lịch plays; hover-card = AnchoredPopover(closeOnPointerOutside)
// nên không kẹt-mở. Bọc quanh bất kỳ ô ngày nào (Đăng dự kiến, hạn, ngày đăng…) — không chỉ Tài sản.
import { useRef, useState, type ReactNode } from 'react';
import { AnchoredPopover } from './anchored-popover';
import { MiniMonth, parseYmd, ymd } from './month-calendar';

export function NgayLich({ ngay, nhan = 'mốc', mau = 'var(--accent)', children }: {
  /** 'YYYY-MM-DD' */ ngay: string;
  /** mốc này gọi là gì — "đăng dự kiến", "hạn"… (tooltip chấm + chú thích) */ nhan?: string;
  mau?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [mo, datMo] = useState(false);
  const d = parseYmd(ngay);
  if (!d) return <>{children}</>;
  const hom = new Date(); hom.setHours(0, 0, 0, 0);
  const cach = Math.round((d.getTime() - hom.getTime()) / 86400000);
  // Khoảng hôm nay ↔ mốc tô nhẹ (sel); xa quá 120 ngày thì chỉ đánh dấu hai đầu, khỏi tô cả lưới.
  const sel = new Set<string>([ymd(hom), ngay]);
  if (Math.abs(cach) <= 120) { const [a, b] = cach >= 0 ? [hom, d] : [d, hom]; for (let x = new Date(a); x <= b; x.setDate(x.getDate() + 1)) sel.add(ymd(x)); }
  return (
    <span ref={ref} onMouseEnter={() => datMo(true)} style={{ display: 'inline-block' }}>
      {children}
      <AnchoredPopover anchorRef={ref} open={mo} onClose={() => datMo(false)} backdrop={false} closeOnPointerOutside>
        <div data-comp="ui.NgayLich" style={{ width: 216, padding: '8px 10px 6px', background: 'var(--bg-0, #0b0d12)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.45)', color: 'var(--fg-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <b style={{ fontSize: 12, textTransform: 'capitalize' }}>{d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</b>
            <span style={{ fontSize: 11, color: cach < 0 ? 'var(--warn)' : 'var(--fg-3)' }}>{cach === 0 ? 'hôm nay' : cach > 0 ? `còn ${cach} ngày` : `quá ${-cach} ngày`}</span>
          </div>
          <MiniMonth month={d} sel={sel} byDate={new Map([[ngay, [{ id: ngay, date: ngay, label: nhan, color: mau }]]])}
            onPick={() => {}} onNavMonth={() => {}} today={ymd(hom)} showNav={false} itemNoun={nhan} />
        </div>
      </AnchoredPopover>
    </span>
  );
}
