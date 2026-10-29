'use server';
// Phần nặng của etp (chi tiết chấm · phễu · điểm chạm · thư viện) — tải bù khi mở tab Creative › Quét / Điểm chạm hoặc Thư viện (xem PhanNang ở etp-doc).
import { getCurrentUser } from '@/lib/auth';
import { docEtp, phanNang, type PhanNang } from '@/lib/etp-doc';

export async function taiNangEtp(ng?: string): Promise<PhanNang | { loi: string }> {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'admin' && me.chiHost !== 'etp.on.tc')) return { loi: 'không có quyền' };   // chỉ ĐỌC — khách chỉ-xem etp cũng được
  return phanNang(await docEtp(ng));
}
