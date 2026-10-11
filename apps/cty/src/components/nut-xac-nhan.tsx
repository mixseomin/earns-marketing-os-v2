'use client';
// Nút cho thao tác TỐN TIỀN hoặc PHẢI CHỜ (góp ý #1271): bấm lần đầu chỉ mở ô xác nhận NGAY DƯỚI NÚT (nói rõ tốn gì), bấm "Xác nhận"
// mới chạy; "Huỷ", Esc hoặc bấm ra ngoài thì thôi. Ô xác nhận NỔI (position absolute) — nút giữ nguyên chỗ, các nút bên cạnh không dịch
// (YDNI mục 6; bản đầu thay nút bằng cả dòng xác nhận, đẩy nút cạnh từ x=170 sang x=560 — đo 11/10/2026). Mọi nút gọi mô hình / chạy nền
// dùng chung nút này, không tự viết confirm riêng.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function NutXacNhan({ nhan, hoi, onXacNhan, disabled, chinh, title }: {
  nhan: ReactNode; hoi: ReactNode; onXacNhan: () => void; disabled?: boolean; chinh?: boolean; title?: string;
}) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMo(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    document.addEventListener('mousedown', ngoai); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', ngoai); document.removeEventListener('keydown', esc); };
  }, [mo]);
  const hien = mo && !disabled;
  return (
    <span ref={ref} className="cty-xn">
      <button type="button" className={chinh ? 'cty-btn chinh' : 'cty-btn'} disabled={disabled} title={title} aria-expanded={hien} onClick={() => setMo((m) => !m)}>{nhan}</button>
      {hien && (
        <span className="cty-xac-nhan" role="dialog">
          <span>{hoi}</span>
          <span className="cty-xac-nhan-nut">
            <button type="button" className="cty-btn chinh" autoFocus onClick={() => { setMo(false); onXacNhan(); }}>Xác nhận</button>
            <button type="button" className="cty-btn" onClick={() => setMo(false)}>Huỷ</button>
          </span>
        </span>
      )}
    </span>
  );
}
