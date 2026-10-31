'use client';
// Ngăn THÀNH PHẦN (drawer chung, ngan-chung.tsx): bấm một thành phần ở bất cứ đâu (phiếu shot, bảng…) mở chi tiết ĐÈ LÊN màn đang xem, không rời trang
// (anh 01/11/2026: "các thành phần bấm vào phải mở ra drawer"). ma = 'nv-<id>' anchor (nhân vật / bối cảnh / cấu kiện / đạo cụ) · 'bt-<id>' một món look.
// Dùng lại đúng khối chi tiết của cây phim (NhanVatSection chiTiet / BienTheChiTiet) — một màn sửa, không bản chép.
import { useCallback, useEffect, useState } from 'react';
import { docPhim, trangThaiKhoa, type PhimDayDu } from '@/lib/actions';
import { NhanVatSection, BienTheChiTiet } from './nhan-vat';
import type { Khoa } from './ui';
import { mono } from './ui';

export function ThanhPhanNgan({ phimId, ma }: { phimId: number; ma: string }) {
  const [d, setD] = useState<PhimDayDu | null>(null);
  const [khoa, setKhoa] = useState<Khoa | null>(null);
  const tai = useCallback(async () => { const [p, k] = await Promise.all([docPhim(phimId), trangThaiKhoa()]); setD(p); setKhoa(k as Khoa); }, [phimId]);
  useEffect(() => { void tai(); }, [tai]);
  if (!d || !khoa) return <span style={mono}>…</span>;
  const id = Number(ma.slice(3));
  if (ma.startsWith('bt-')) {
    const x = d.nhanVat.flatMap((v) => (v.bien_the ?? []).map((b) => ({ b, v }))).find((y) => y.b.id === id);
    if (!x) return <span style={mono}>Món này không còn (đã xoá).</span>;
    return <BienTheChiTiet b={x.b} nvTen={x.v.ten} phimId={phimId} dangSinh={d.dangSinh.bienThe} loiBt={d.loiAnh.bienThe} onChanged={tai} />;
  }
  if (!d.nhanVat.some((v) => v.id === id)) return <span style={mono}>Thành phần này không còn (đã xoá).</span>;
  return <NhanVatSection phimId={phimId} nhanVat={d.nhanVat} kinhThanh={d.phim.kinh_thanh} khoa={khoa} dangSinh={d.dangSinh} loiAnh={d.loiAnh} onChanged={tai} chiTiet={id} />;
}
