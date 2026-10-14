'use client';
// Tab 📋 Hồ sơ của một tập (14/10/2026 — khuôn tiền kỳ chuẩn studio): bảy tài liệu của ngành dựng từ dữ liệu tập + shot bằng ĐÚNG bộ dựng
// của trang duyệt (lib/xuong-video/ho-so.ts › hoSoHtml), đặt trong iframe để style của hồ sơ không lẫn với studio. Chỉ đọc, 0đ.
import { useMemo } from 'react';
import { hoSoHtml, type HoSoVao } from '@/lib/xuong-video/ho-so';
import { docKinhThanh, type Canh, type NhanVat, type Phim, type Tap } from '@/lib/xuong-video/kieu';

export function HoSoTap({ tap, phim, canh, nhanVat }: { tap: Tap; phim: Phim; canh: Canh[]; nhanVat: NhanVat[] }) {
  const html = useMemo(() => {
    const kt = docKinhThanh(phim.kinh_thanh);
    const vao: HoSoVao = {
      phim: kt.series?.ten?.trim() || phim.ten, ten: tap.ten || phim.ten, so: tap.so, khong_loi: kt.khong_loi, ho_so: tap.ho_so ?? {}, phan_canh: tap.phan_canh,
      canh: canh.map((c) => ({ thu_tu: c.thu_tu, phan_doan: c.phan_doan, nhanh: c.nhanh, hanh_dong: c.hanh_dong, goc_may: c.goc_may, am_thanh: c.am_thanh, phat_s: c.phat_s, thoi_luong_s: c.thoi_luong_s, ky_thuat: c.ky_thuat, dan_dung: c.dan_dung, nhan_vat: c.nhan_vat, thoai: c.thoai, chu_man: c.chu_man })),
      nhanVat: nhanVat.map((v) => ({ id: v.id, ten: v.ten, loai: v.loai })),
    };
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${hoSoHtml(vao)}</head></html>`;
  }, [tap, phim, canh, nhanVat]);
  if (!tap.phan_canh.length) return <div className="xv-mono">Tập chưa có phân cảnh — viết kịch bản rồi ✂ Tách cảnh ở tab 📝 Kịch bản; hồ sơ 7 tài liệu dựng từ đó.</div>;
  return <iframe title="Hồ sơ tiền kỳ" srcDoc={html} style={{ width: '100%', height: 'calc(100vh - 150px)', minHeight: 520, border: '1px solid var(--line)', borderRadius: 8, background: 'transparent' }} />;
}
