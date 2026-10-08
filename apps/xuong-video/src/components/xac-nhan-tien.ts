'use client';

// Xác nhận lần hai NGAY TẠI NÚT cho lượt sinh đắt (#1214: "cost > $0.5 thì phải confirm 1 lần nữa, inline"). Một cơ chế cho mọi nút có giá:
// Nut, MucMenu, nút trong bảng ＋. Bấm lần một → nút đổi thành "⚠ $X — bấm lại để xác nhận" trong 5 giây; bấm lần hai mới chạy.
import { useEffect, useState } from 'react';

export const NGUONG_XAC_NHAN_CENTS = 50;

export function useXacNhanTien(giaCents: number | undefined): { canHoi: boolean; dangHoi: boolean; bam: (chay: () => void) => void } {
  const [dangHoi, setDangHoi] = useState(false);
  useEffect(() => { if (!dangHoi) return; const t = setTimeout(() => setDangHoi(false), 5000); return () => clearTimeout(t); }, [dangHoi]);
  const canHoi = (giaCents ?? 0) > NGUONG_XAC_NHAN_CENTS;
  const bam = (chay: () => void) => {
    if (canHoi && !dangHoi) { setDangHoi(true); return; }
    setDangHoi(false); chay();
  };
  return { canHoi, dangHoi, bam };
}
