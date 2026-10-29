'use server';
import { getCurrentUser } from '@/lib/auth';
import { mailwizzNguoiDangKy, type MailwizzNguoi } from '@/lib/mailwizz';

/** Ngăn kéo "Người đăng ký" của bảng Email lists (chỉ xem, chỉ admin). Lỗi trả về chữ để ngăn hiện lỗi ngay trong ngăn. */
export async function xemNguoiDangKy(listUid: string): Promise<{ ok: true; nguoi: MailwizzNguoi[]; tong: number } | { ok: false; loi: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, loi: 'Chỉ admin xem được danh sách email' };
  try { return { ok: true, ...(await mailwizzNguoiDangKy(listUid)) }; } catch (e) { return { ok: false, loi: (e as Error).message }; }
}
