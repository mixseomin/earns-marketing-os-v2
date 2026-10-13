'use client';
// "BAO LÂU TRƯỚC" chạy từng giây (anh 14/10/2026: "kiểu time ago, 3s trước…", không phải giờ kèm múi): 3 giây trước → 5 phút trước →
// 2 giờ trước → 3 ngày trước. Rê chuột thấy giờ chính xác. Đồng hồ trình duyệt đếm, không phải đợi trang làm mới.
import { useEffect, useState } from 'react';

export function truocChu(giay: number) {
  const s = Math.max(0, Math.floor(giay));
  return s < 60 ? `${s} giây trước` : s < 3600 ? `${Math.floor(s / 60)} phút trước` : s < 86400 ? `${Math.floor(s / 3600)} giờ trước` : `${Math.floor(s / 86400)} ngày trước`;
}
export function TruocDay({ iso }: { iso: string }) {
  const [gio, setGio] = useState<number | null>(null);   // null lúc dựng ở máy chủ → tránh lệch chữ giữa máy chủ và trình duyệt
  useEffect(() => { setGio(Date.now()); const t = setInterval(() => setGio(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Date.parse(iso);
  return <time dateTime={iso} title={new Date(iso).toLocaleString('vi-VN')}>{gio === null ? '…' : truocChu((gio - ms) / 1000)}</time>;
}
