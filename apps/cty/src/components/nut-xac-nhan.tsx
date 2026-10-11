'use client';
// Nút cho thao tác TỐN TIỀN hoặc PHẢI CHỜ (góp ý #1271): bấm lần đầu chỉ mở dòng xác nhận NGAY TẠI CHỖ (nói rõ tốn gì),
// bấm "Xác nhận" mới chạy; "Huỷ" hoặc Esc thì thôi. Mọi nút gọi mô hình / chạy nền dùng chung nút này, không tự viết confirm riêng.
import { useState, type ReactNode } from 'react';

export function NutXacNhan({ nhan, hoi, onXacNhan, disabled, chinh, title }: {
  nhan: ReactNode; hoi: ReactNode; onXacNhan: () => void; disabled?: boolean; chinh?: boolean; title?: string;
}) {
  const [mo, setMo] = useState(false);
  if (!mo || disabled) {
    return <button type="button" className={chinh ? 'cty-btn chinh' : 'cty-btn'} disabled={disabled} title={title} onClick={() => setMo(true)}>{nhan}</button>;
  }
  return (
    <span className="cty-xac-nhan" role="group" onKeyDown={(e) => { if (e.key === 'Escape') setMo(false); }}>
      <span>{hoi}</span>
      <button type="button" className="cty-btn chinh" autoFocus onClick={() => { setMo(false); onXacNhan(); }}>Xác nhận</button>
      <button type="button" className="cty-btn" onClick={() => setMo(false)}>Huỷ</button>
    </span>
  );
}
