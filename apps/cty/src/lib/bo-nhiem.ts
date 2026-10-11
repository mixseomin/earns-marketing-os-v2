'use server';
// Giám đốc ký / bác đề cử sau thử việc (đổi người giữ vai = mức 3). Chỉ admin. Ký → sổ bổ nhiệm (worker), lượt sau người mới giữ vai.
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './auth';
import { kyDeCu } from '../../worker/cai-tien.mjs';

export async function kyDeCuCua(khoa: string, id: string, dongY: boolean): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ Giám đốc (admin) được ký bổ nhiệm.' };
  try { kyDeCu(khoa, id, dongY); } catch (e) { return { ok: false, loi: (e as Error).message }; }
  revalidatePath('/', 'layout');
  return { ok: true };
}
