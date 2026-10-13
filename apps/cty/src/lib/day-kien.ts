'use server';
// Dạy người phụ trách mail bảo mật một tên miền (site nhà / nhà quen / giả) từ cty — cùng sổ với ba nút dưới tin Telegram (worker/mail-bao-mat.mjs
// dayMien). Chỉ admin: sổ này quyết định thư nào bị báo giả.
import { getCurrentUser } from './auth';
import { dayMien } from '../../worker/mail-bao-mat.mjs';

export async function dayKien(nhom: string, mien: string): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được dạy Kiên.' };
  try { await dayMien(nhom, mien, String(me.email ?? me.id)); return { ok: true }; } catch (e) { return { ok: false, loi: (e as Error).message }; }
}
