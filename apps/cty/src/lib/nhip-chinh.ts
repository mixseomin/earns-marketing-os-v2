'use server';
// Admin chỉnh nhịp của một nhân sự ngay trên bảng nhân sự (anh 14/10/2026): ca · giờ điểm danh · kiểm mấy phút một lần. Lưu ở sổ dữ liệu
// (worker/nhip.mjs luuChinh), có hiệu lực ở nhịp kế tiếp — không sửa git, không cần deploy.
import { getCurrentUser } from './auth';
import { luuChinh, datBat, datGio } from '../../worker/nhip.mjs';

export async function chinhNhip(id: string, x: { ca: string; diem_danh: string; kiem_moi: number }): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được chỉnh nhịp.' };
  try { luuChinh(String(id), x, String(me.email ?? me.id)); return { ok: true }; } catch (e) { return { ok: false, loi: (e as Error).message }; }
}

/** Bật/tắt cột Tự làm (anh 14/10/2026). Chỉ admin. */
export async function batTatNhip(id: string, bat: boolean): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được bật/tắt.' };
  try { datBat(String(id), bat, String(me.email ?? me.id)); return { ok: true }; } catch (e) { return { ok: false, loi: (e as Error).message }; }
}

/** Đổi giờ chạy hằng ngày của việc trên máy Mac (Bảo dọn nhật ký). Chỉ admin. */
export async function chinhGio(id: string, gio: string): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được chỉnh giờ.' };
  try { datGio(String(id), gio, String(me.email ?? me.id)); return { ok: true }; } catch (e) { return { ok: false, loi: (e as Error).message }; }
}
