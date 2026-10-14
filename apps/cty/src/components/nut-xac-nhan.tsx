'use client';
// Nút cho thao tác TỐN TIỀN hoặc PHẢI CHỜ (góp ý #1271): bấm lần đầu chỉ mở ô xác nhận NGAY DƯỚI NÚT (nói rõ tốn gì), bấm "Xác nhận"
// mới chạy; "Huỷ", Esc hoặc bấm ra ngoài thì thôi. Ô xác nhận NỔI (position absolute) — nút giữ nguyên chỗ, các nút bên cạnh không dịch
// (YDNI mục 6; bản đầu thay nút bằng cả dòng xác nhận, đẩy nút cạnh từ x=170 sang x=560 — đo 11/10/2026). Mọi nút gọi mô hình / chạy nền
// dùng chung nút này, không tự viết confirm riêng.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useBamNgoai } from './bam-ngoai';

export function NutXacNhan({ nhan, hoi, onXacNhan, disabled, chinh, title, lop, nhanXacNhan = 'Xác nhận', vaiTro }: {
  nhan: ReactNode; hoi: ReactNode; onXacNhan: () => void; disabled?: boolean; chinh?: boolean; title?: string;
  lop?: string;              // class của nút mở (mặc định cty-btn) — vd chấm bật/tắt cty-den-nut
  nhanXacNhan?: string;      // chữ nút xác nhận ("Tắt"…)
  vaiTro?: { role: string; 'aria-checked': boolean; 'aria-label': string };   // nút mở là công tắc (chấm Tự làm)
}) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const dong = useCallback(() => setMo(false), []); useBamNgoai(mo, [ref], dong);   // Esc / bấm ra ngoài / bấm vào khung nhúng → đóng
  const hien = mo && !disabled;
  return (
    <span ref={ref} className="cty-xn">
      <button type="button" className={lop ?? (chinh ? 'cty-btn chinh' : 'cty-btn')} disabled={disabled} title={title} aria-expanded={hien} {...vaiTro} onClick={() => setMo((m) => !m)}>{nhan}</button>
      {hien && (
        <span className="cty-xac-nhan" role="dialog">
          <span>{hoi}</span>
          <span className="cty-xac-nhan-nut">
            <button type="button" className="cty-btn chinh" autoFocus onClick={() => { setMo(false); onXacNhan(); }}>{nhanXacNhan}</button>
            <button type="button" className="cty-btn" onClick={() => setMo(false)}>Huỷ</button>
          </span>
        </span>
      )}
    </span>
  );
}
