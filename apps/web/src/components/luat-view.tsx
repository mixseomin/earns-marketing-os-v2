'use client';
// TAB "LUẬT CAMPAIGN" — bộ luật điều hành campaign nay sửa ở MỘT nơi: trang Luật campaign của be.adfond (anh chốt
// 28/09/2026). Nguồn luật vẫn nằm bên đó (luat-camp.ts + bảng luat / luat_gan / luat_cau_hinh); tab này chỉ còn lối sang,
// không giữ màn sửa thứ hai — hai màn sửa cùng một thư viện là hai chỗ lệch nhau (gán theo campaign, tên ngắn, A/B chỉ có ở bên đó).
import { EmptyState } from '@/components/ui';
import { wrapExternalUrl } from '@/lib/external-url';

const DUONG = 'https://be.adfond.com/luat';

export function LuatView() {
  return (
    <EmptyState icon="⚖" title="Luật campaign đã chuyển sang be.adfond"
      description="Thư viện luật, gán luật theo từng campaign (Nháp → Chạy → Tắt) và tham số theo tầng giờ sửa ở một nơi. Báo cáo của be.adfond gắn dấu luật cạnh Campaign / Ad group đang bị luật chạm."
      action={<a href={wrapExternalUrl(DUONG)} target="_blank" rel="noreferrer" className="btn">Mở trang Luật campaign ↗</a>} />
  );
}
