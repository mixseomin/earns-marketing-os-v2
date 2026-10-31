'use server';
// Phần nặng của etp (chi tiết chấm · phễu · điểm chạm · thư viện) — tải bù khi mở tab Creative › Quét / Điểm chạm hoặc Thư viện (xem PhanNang ở etp-doc).
import { getCurrentUser } from '@/lib/auth';
import { docEtp, phanNang, type PhanNang } from '@/lib/etp-doc';
import { quyenEtp, xemNha } from '@/lib/etp-quyen';

export async function taiNangEtp(ng?: string): Promise<PhanNang | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q) return { loi: 'không có quyền' };
  if (!xemNha(q)) return { chamCt: {}, pheu: [], diemCham: {}, thuVien: [] };   // phần nặng toàn dữ liệu nhà (chấm, phễu, thư viện) — vai người không có
  return phanNang(await docEtp(ng));
}
